"""Main module to start the FastAPI application."""

from http import HTTPStatus
import re
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from workos import exceptions

# Import business modules
from app.business.pkce import verify_token_exp
from app.business.workos import get_workos_client
from app.db.database import create_db_and_tables, engine
from app.api.main import API_ROOT_PATH, UNSECURE_ROUTES, api_router, API_VERSION, API_ROOT_PATH, DEV_ROUTES, RUNNER_ACCESS_ROUTES
from app.business.resource_setup import setup_resources
from app.business.runner_management import launch_runners, shutdown_all_runners
from app.business import runner_management
from app.exceptions.no_matching_key import NoMatchingKeyException
from app.models.image import Image
from app.models.workos_session import get_refresh_token, refresh_session
from app.util import constants

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager to handle startup and shutdown of the FastAPI application."""
    # Create DB and tables
    create_db_and_tables()

    # Set up default resources
    setup_resources()

    # Find all images with pool size > 0 and launch runners for each
    with Session(engine) as session:
        stmt = select(Image).where(Image.runner_pool_size > 0)
        images = session.exec(stmt).all()

        for image in images:
            # Launch runners for each image based on its pool size
            await launch_runners(
                image_identifier=image.identifier,
                runner_count=image.runner_pool_size,
                initiated_by="app_startup"
            )

    # Yield so the app can start serving requests
    yield

    # On shutdown: terminate all alive runners
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Starting application shutdown process...")

        # Set a reasonable timeout for the shutdown process
        import asyncio
        shutdown_task = asyncio.create_task(shutdown_all_runners())

        # Wait with a timeout to ensure we don't hang forever
        try:
            await asyncio.wait_for(shutdown_task, timeout=60)  # 60 second timeout
            logger.info("All runners successfully terminated")
        except asyncio.TimeoutError:
            logger.error("Timeout while shutting down runners - some may remain active")

    except Exception as e:
        import traceback
        logger.error(f"Error during shutdown_all_runners: {e}\n{traceback.format_exc()}")

workos = get_workos_client()

app = FastAPI(
    lifespan=lifespan,
    root_path=API_ROOT_PATH,
    redirect_slashes=False
    )

# Middleware to protect all routes, passes unsecure route requests through
@app.middleware("http")
async def route_guard(request: Request, call_next):
    """
    Protects routes.

    This middleware will intercept all requests to the API and perform its logic before passing the request on.
    If the route is among the unsecured routes, the request is simply passed. Otherwise there must be an access-token header
    with a valid token. This initiates the token verification and refresh behavior with workos.

    Before the response is sent, execution returns to the middleware, where we make sure the access_token is updated before responding.
    """
    print(f'\n\nDEBUG PATH: {request.url.path}\n\n')

    # Use pattern matching for runner state endpoints
    path = request.url.path
    path_parts = path.split('/')

    runner_path_prefix = f"{API_ROOT_PATH}{API_VERSION}/runners/"

    print(f"Checking if path {path} starts with {runner_path_prefix}")

    print(f"passed through route guard 1: {request.url.path}")

    # Check exact matches
    if (path_in_route_patterns(path, UNSECURE_ROUTES) or
        constants.auth_mode=="OFF") or (path_in_route_patterns(path, DEV_ROUTES) and
                                        constants.auth_mode!="PROD"):
            return await call_next(request)

    if (path_in_route_patterns(request.url.path, RUNNER_ACCESS_ROUTES) and request.headers.get("Runner-Token")):
        runner_id = re.search(r'/runners/(\d+)(?:/.*)?$', path).group(1) if re.search(r'/runners/(\d+)(?:/.*)?$', path) else None
        runner_token = request.headers.get("Runner-Token")
        if runner_management.auth_runner(runner_id, runner_token):
            return await call_next(request)

    access_token = request.headers.get("Access-Token")
    if not access_token:
        return Response(status_code = 400, content = "Missing Access Token")

    try:
        if not verify_token_exp(access_token):
            refresh_response = workos.user_management.authenticate_with_refresh_token(refresh_token=get_refresh_token(access_token))
            refresh_session(access_token, refresh_response.access_token, refresh_response.refresh_token)
            access_token = refresh_response.access_token
        response: Response = await call_next(request)
        response.headers['Access-Token'] = access_token
        return response

    except (exceptions.BadRequestException, NoMatchingKeyException) as e:
        error_message = "Invalid workos session" if isinstance(e, exceptions.BadRequestException) else "Bad Token Header"
        return Response(status_code=400, content=error_message)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f'Exception raised in the backend middleware.')
        return Response(
            status_code = HTTPStatus.INTERNAL_SERVER_ERROR,
            content = '{"response":"Internal Server Error: ' + str(e) + '"}'
        )

def path_in_route_patterns(path: str, patterns: tuple) -> bool:
    """Check if our route matches a regex in our tuple of routes."""
    for pattern in patterns:
        if re.match(pattern, path):
            return True
    return False

app.include_router(api_router)

@app.get("/")
def read_root():
    """Check if the application is running."""
    return {"message": "Hello, welcome to the cloud ide dev backend API!"}

