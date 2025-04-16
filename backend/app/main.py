"""Main module to start the FastAPI application."""

from http import HTTPStatus
import logging
from fastapi import FastAPI, Request, Response
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from workos import exceptions

# Import business modules
from app.business.pkce import verify_token_exp
from app.business.workos import authenticate_sealed_session, get_workos_client
from workos.types.user_management.session import RefreshWithSessionCookieSuccessResponse
from app.db.database import create_db_and_tables, engine
from app.api.main import API_ROOT_PATH, UNSECURE_ROUTES, api_router, API_VERSION, API_ROOT_PATH, DEV_ROUTES
from app.business.resource_setup import setup_resources
from app.business.runner_management import launch_runners, shutdown_all_runners
from app.exceptions.pkce_exceptions import NoMatchingKeyException
from app.models.image import Image
from app.db.workos_session_repository import get_refresh_token, refresh_session
from app.util import constants

load_dotenv()
logger = logging.getLogger(__name__)

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
    If the route shouldn't be secured, the request is passed without authentication. Otherwise the request must
    carry either a WorkOS session cookie ("wos_session") or a WorkOS "access-token" header.

    Before the response is sent, execution returns to the middleware, where we make sure the session cookie or
    access-token is updated before responding.
    """
    logger.info(f'Request Path: {request.url.path}')

    """
    This response object will eventually be used as the response. Instead of returning too many times with
    different response objects, at the end of the method just respond with whichever is assigned to this ref.
    We shouldn't ever see this default response, it should always be replaced with an actual response.
    """
    final_response: Response = Response(
        status_code = HTTPStatus.SERVICE_UNAVAILABLE,
        content = '{"response":"Default response."}'
    )

    # Use pattern matching for runner state endpoints
    path = request.url.path
    path_parts = path.split('/')
    runner_path_prefix = f"{API_ROOT_PATH}{API_VERSION}/runners/"

    logger.info(f"Checking if path {path} starts with {runner_path_prefix}")

    session_cookie = request.cookies.get("wos_session")
    access_token = request.headers.get("Access-Token")

    try:
        # Check if the structure is correct and the runner ID is a digit
        if (path.startswith(runner_path_prefix) and
            'state' in path_parts and
            path_parts[4].isdigit()):
            logger.info("Matched runner state endpoint")
            # return await call_next(request)
            final_response = await call_next(request)

        # Check exact matches
        elif (request.url.path in UNSECURE_ROUTES or
            constants.auth_mode=="OFF") or (request.url.path in DEV_ROUTES and constants.auth_mode!="PROD"):
            # return await call_next(request)
            final_response = await call_next(request)

        # Authenticate with sealed session or access token

        elif session_cookie:
            auth_result = authenticate_sealed_session(session_cookie = session_cookie)
            response: Response = await call_next(request)
            if isinstance(auth_result, RefreshWithSessionCookieSuccessResponse):
                response.set_cookie(
                    key = "wos_session",
                    value = auth_result.sealed_session,
                    secure = True,# True for HTTPS
                    httponly = True,
                    samesite = "lax"
                )
            # return response
            final_response = response

        elif access_token:
            if not verify_token_exp(access_token):
                refresh_response = workos.user_management.authenticate_with_refresh_token(refresh_token=get_refresh_token(access_token))
                refresh_session(access_token, refresh_response.access_token, refresh_response.refresh_token)
                access_token = refresh_response.access_token
            response: Response = await call_next(request)
            response.headers['Access-Token'] = access_token
            final_response = response
            # return response

        # Neither bearer token is present in request
        logger.warning('Unable to authenticate request, no access-token and no session cookie present.')
        final_response = Response(status_code = 400, content = '{"error":"Missing Access Token"')

    except (exceptions.BadRequestException, NoMatchingKeyException) as e:
        error_message = "Invalid workos session" if isinstance(e, exceptions.BadRequestException) else "Bad Token Header"
        # return Response(status_code=400, content=error_message)
        final_response = Response(status_code=400, content=error_message)
    except Exception as e:
        logger.exception('Exception raised in the backend middleware.')
        final_response = Response(
            status_code = HTTPStatus.INTERNAL_SERVER_ERROR,
            content = '{"response":"Internal Server Error: ' + str(e) + '"}'
        )

    return final_response

app.include_router(api_router)

@app.get("/")
def read_root():
    """Check if the application is running."""
    return {"message": "Hello, welcome to the cloud ide dev backend API!"}
