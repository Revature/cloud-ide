"""Main application file for the API."""
import re
import os
from http import HTTPStatus
from fastapi import APIRouter
from app.api.routes import user_auth, machine_auth, registration, users, endpoint_permissions
from app.api.routes import runners, machines, cloud_connectors, images, scripts
from app.api.routes import app_requests
from fastapi import FastAPI, Request, Response
from app.business import runner_management
from contextlib import asynccontextmanager
from app.business.workos import authenticate_sealed_session, get_workos_client, refresh_sealed_session
from app.util import constants
from app.db.database import create_db_and_tables
from app.business.resource_setup import fill_runner_pools, setup_resources, setup_endpoint_permissions
# from app.business.runner_management import shutdown_all_runners
from app.business.pkce import verify_token_exp
from app.exceptions.authentication_exceptions import NoMatchingKeyException
from app.models.workos_session import get_refresh_token, refresh_session
from workos import exceptions as workos_exceptions
from app.exceptions.authentication_exceptions import NoRefreshSessionFound
from typing import Optional

API_ROOT_PATH: str = '/api' #stripped out of request.url.path by the proxy
API_VERSION: str = '/v1' #still present in the path, not for docs

# Update route patterns with proper regex patterns
# I think we may need to anchor these patterns to the beginning of the string? with the '^' regex character
UNSECURE_ROUTES: tuple = (
    f'{API_VERSION}/machine_auth/?$',
    f'{API_VERSION}/user_auth/authkit_url/',
    f'{API_VERSION}/user_auth/authkit_redirect/',
    f'{API_VERSION}/user_auth/callback/',
    f'{API_VERSION}/runners/\\d+/state/?$',
    f'{API_VERSION}/app_requests/runner_status/?$', # Getting runner status websocket connection
    f'{API_VERSION}/runners/connect/\\d+/?$'  # Terminal WebSocket connection
    )

RUNNER_ACCESS_ROUTES: tuple = (
    f'{API_VERSION}/runners/\\d+/state/?$',
    f'{API_VERSION}/runners/\\d+/devserver/?$',
    f'{API_VERSION}/runners/\\d+/extend_session/?$',
    f'{API_VERSION}/runners/\\d+/?$'
    )

DEV_ROUTES: tuple = (
    '/docs/?$',
    '/openapi.json/?$'
)

def path_in_route_patterns(path: str, patterns: tuple) -> bool:
    """Check if our route matches a regex in our tuple of routes."""
    for pattern in patterns:
        if re.match(pattern, path):
            return True
    return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager to handle startup and shutdown of the FastAPI application."""
    # Create DB and tables
    create_db_and_tables()

    # Set up default resources
    setup_resources()
    setup_endpoint_permissions()

    # Find all images with pool size > 0 and launch runners for each
    await fill_runner_pools()

    # API is started, yield to start handling requests.
    yield

    # On shutdown: terminate all runners
    await shutdown_api()

def start_api():
    """Start the API."""
    api = FastAPI(
        lifespan=lifespan,
        root_path=API_ROOT_PATH,
        redirect_slashes=False
        )

    api.include_router(users.router, prefix=f"{API_VERSION}/users", tags=["users"])
    api.include_router(runners.router, prefix=f"{API_VERSION}/runners", tags=["runners"])
    api.include_router(machine_auth.router, prefix=f"{API_VERSION}/machine_auth", tags=["machine_auth"])
    api.include_router(user_auth.router, prefix=f"{API_VERSION}/user_auth", tags=["user_auth"])
    api.include_router(registration.router, prefix=f"{API_VERSION}/registration", tags=["registration"])
    api.include_router(images.router, prefix=f"{API_VERSION}/images", tags=["images"])
    api.include_router(machines.router, prefix=f"{API_VERSION}/machines", tags=["machines"])
    api.include_router(cloud_connectors.router, prefix=f"{API_VERSION}/cloud_connectors", tags=["cloud_connectors"])
    api.include_router(app_requests.router, prefix=f"{API_VERSION}/app_requests", tags=["app_requests"])
    api.include_router(scripts.router, prefix=f"{API_VERSION}/scripts", tags=["scripts"])
    api.include_router(endpoint_permissions.router, prefix=f"{API_VERSION}/endpoint_permissions", tags=["endpoint_permissions"])

    # Middleware to protect all routes, passes unsecure route requests through
    @api.middleware("http")
    async def route_guard(request: Request, call_next):
        """
        Protects routes.

        This middleware will intercept all requests to the API and perform its logic before passing the request on.
        If the route is among the unsecured routes, the request is simply passed. Otherwise there must be an access-token header
        with a valid token. This initiates the token verification and refresh behavior with workos.

        Before the response is sent, execution returns to the middleware, where we make sure the access_token is updated before responding.
        """
        import logging
        logger = logging.getLogger(__name__) #logs getting buried by ASGI, only exception logs are forced to stdout
        print(f'Request Path: {request.url.path}')

        # Use pattern matching for runner state endpoints
        path = request.url.path
        path_parts = path.split('/')
        runner_path_prefix = f"{API_ROOT_PATH}{API_VERSION}/runners/"
        print(f"Checking if path {path} starts with {runner_path_prefix}")

        workos = get_workos_client()

        """
        This response object will eventually be used as the response. Instead of returning too many times with
        different response objects, at the end of the method just respond with whichever is assigned to this ref.
        Once final_response is no longer None, the remaining checks will bypass.
        """
        final_response: Response = None

        access_token = request.headers.get("Access-Token")

        #print route
        print(f"\n\nRequest Path: {request.url.path}")

        if not access_token:
            print('not access-token')

        try:
            # Check exact matches for bypassing middleware
            if (path_in_route_patterns(path, UNSECURE_ROUTES) or
                constants.auth_mode=="OFF") or (path_in_route_patterns(path, DEV_ROUTES) and
                                                constants.auth_mode!="PROD"):
                    print('Unsecured route entered.')
                    final_response = await call_next(request)

            # Check for runner access paths
            if (not final_response and path_in_route_patterns(request.url.path, RUNNER_ACCESS_ROUTES)):
                print('Runner access route entered.')
                if (access_token and access_token == constants.jwt_secret):
                    final_response = await call_next(request)
                elif (request.headers.get("Runner-Token")):
                    runner_id = re.search(r'/runners/(\d+)(?:/.*)?$', path).group(1) if re.search(r'/runners/(\d+)(?:/.*)?$', path) else None
                    runner_token = request.headers.get("Runner-Token")
                    if runner_management.auth_runner(runner_id, runner_token):
                        final_response = await call_next(request)

            # If none of the above, we must find an access token
            if not final_response and not access_token:
                print('no auth methods present, error 400...')
                final_response = Response(status_code = 400, content = "Missing Access Token")

            # Verify expiration on access token, if expired try to refresh
            if (not final_response) and access_token:
                print('access-token secured route entered.')
                if verify_token_exp(access_token):
                    # Continue with request
                    response: Response = await call_next(request)
                    response.headers['Access-Token'] = access_token
                    final_response = response
                else:
                    print('Failed to auth with token, refreshing...')
                    refresh_response = workos.user_management.authenticate_with_refresh_token(refresh_token = get_refresh_token(access_token))
                    refresh_session(access_token, refresh_response.access_token, refresh_response.refresh_token)
                    access_token = refresh_response.access_token
                    response: Response = await call_next(request)
                    response.headers['Access-Token'] = access_token
                    final_response = response

        except workos_exceptions.BadRequestException as e:
            logger.exception(f'WorkOS raised BadRequestException in middleware.')
            final_response = Response(
                status_code = HTTPStatus.BAD_REQUEST,
                content = "Invalid workos session")
        except NoMatchingKeyException as e:
            logger.exception(f'No PKCE key matched token header')
            final_response = Response(
                status_code = HTTPStatus.BAD_REQUEST,
                content = "Bad Token Header")
        except NoRefreshSessionFound as e:
            logger.exception(f'No PKCE key matched token header')
            final_response = Response(
                status_code = HTTPStatus.UNAUTHORIZED,
                content = "Session expired, unable to refresh.")
        except Exception as e:
            logger.exception(f'Exception raised in the authentication middleware.')
            final_response = Response(
                status_code = HTTPStatus.INTERNAL_SERVER_ERROR,
                content = '{"response":"Internal Server Error: ' + str(e) + '"}'
            )
        print('returning final response.')
        return final_response

    return api

async def shutdown_api():
    """Shut down the API and terminate runners."""
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Starting application shutdown process...")

        # # Set a reasonable timeout for the shutdown process
        # import asyncio
        # shutdown_task = asyncio.create_task(shutdown_all_runners())

        # # Wait with a timeout to ensure we don't hang forever
        # try:
        #     await asyncio.wait_for(shutdown_task, timeout=120)  # 60 second timeout
        #     logger.info("All runners successfully terminated")
        # except asyncio.TimeoutError:
        #     logger.error("Timeout while shutting down runners - some may remain active")
    except Exception as e:
        import traceback
        logger.error(f"Error during shutdown application: {e}\n{traceback.format_exc()}")
