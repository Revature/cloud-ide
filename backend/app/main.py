"""Main module to start the FastAPI application."""

from fastapi import FastAPI, Request, Response
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from workos import exceptions

# Import business modules
from app.business.pkce import verify_token_exp
from app.business.workos import get_workos_client
from app.db.database import create_db_and_tables, engine
from app.api.main import API_ROOT_PATH, UNSECURE_ROUTES, api_router
from app.business.resource_setup import setup_resources
from app.business.runner_management import launch_runners, shutdown_all_runners
from app.exceptions.no_matching_key import NoMatchingKeyException
from app.models.image import Image
from app.models.workos_session import get_refresh_token, refresh_session

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
    await shutdown_all_runners()

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

    # return await call_next(request)



    if request.url.path in UNSECURE_ROUTES:
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

    except exceptions.BadRequestException:
        return Response(status_code = 400, content = "Invalid workos session")
    except NoMatchingKeyException as e:
        return Response(status_code = 400, content = "Bad Token Header")
    except Exception as e:
        print(e)
        return Response(status_code = 500, content = "Something went wrong when verifying the access token")

app.include_router(api_router)

@app.get("/")
def read_root():
    """Check if the application is running."""
    return {"message": "Hello, welcome to the cloud ide dev backend API!"}
