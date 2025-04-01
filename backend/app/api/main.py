"""Main application file for the API."""

from fastapi import APIRouter
from app.api.routes import auth, registration, users, runners, machines, cloud_connectors, images, app_requests, theia_requests

API_ROOT_PATH: str = '/api' #stripped out of request.url.path by the proxy
API_VERSION: str = '/v1' #still present in the path, not for docs
UNSECURE_ROUTES: tuple = (
    f'{API_VERSION}/machine_auth/',
    # f'{API_VERSION}/machine_auth',
    f'{API_VERSION}/machine_auth/'
    '/docs',
    '/openapi.json',
    '/docs/',
    '/openapi.json/',
    '/api/openapi.json',
    '/api/openapi.json/'
    )

api_router = APIRouter()
api_router.include_router(users.router, prefix=f"{API_VERSION}/users", tags=["users"])
api_router.include_router(runners.router, prefix=f"{API_VERSION}/runners", tags=["runners"])
api_router.include_router(auth.router, prefix=f"{API_VERSION}/machine_auth", tags=["auth"])
api_router.include_router(registration.router, prefix=f"{API_VERSION}/registration", tags=["registration"])
api_router.include_router(images.router, prefix=f"{API_VERSION}/images", tags=["images"])
api_router.include_router(machines.router, prefix=f"{API_VERSION}/machines", tags=["machines"])
api_router.include_router(cloud_connectors.router, prefix=f"{API_VERSION}/cloud_connectors", tags=["cloud_connectors"])
api_router.include_router(app_requests.router, prefix=f"{API_VERSION}/app_requests", tags=["app_requests"])
api_router.include_router(theia_requests.router, prefix=f"{API_VERSION}/theia_requests", tags=["theia_requests"])
