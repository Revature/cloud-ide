"""Main application file for the API."""

from fastapi import APIRouter
from app.api.routes import auth, users, runners, machines, images, app_requests, theia_requests  # Import your new images route

API_ROOT_PATH: str = '/api'
API_VERSION: str = '/v1'
UNSECURE_ROUTES: tuple = (
    f'{API_ROOT_PATH}{API_VERSION}/machine_auth',
    f'{API_ROOT_PATH}{API_VERSION}/',
    f'{API_ROOT_PATH}/docs'
    )

api_router = APIRouter()
api_router.include_router(users.router, prefix=f"{API_VERSION}/users", tags=["users"])
api_router.include_router(runners.router, prefix=f"{API_VERSION}/runners", tags=["runners"])
api_router.include_router(auth.router, prefix=f"{API_VERSION}/machine_auth", tags=["auth"])
api_router.include_router(images.router, prefix=f"{API_VERSION}/images", tags=["images"])
api_router.include_router(app_requests.router, prefix=f"{API_VERSION}/app_requests", tags=["app_requests"]) # include your new images route
api_router.include_router(theia_requests.router, prefix=f"{API_VERSION}/theia_requests", tags=["theia_requests"]) # include your new images route
