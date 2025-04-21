"""Authorization route."""
import os
import logging
from workos import exceptions as workos_exceptions
from app.business.authentication import password_authentication
from app.business.workos import handle_authkit_code, get_authkit_url, get_workos_client
from app.schemas.auth_schema import PasswordAuth, WorkOSAuthDTO
from fastapi import APIRouter, Header, Request, Response, status

router = APIRouter()
workos = get_workos_client()
logger = logging.getLogger(__name__)

@router.post("/machine_auth")
@router.post("/machine_auth/")
def machine_auth(request: Request, passwordAuth: PasswordAuth):
    """Authenticate with username and password, receive access token in Access-Token header."""
    workos_auth_dto = WorkOSAuthDTO(
        email = passwordAuth.email,
        password = passwordAuth.password,
        ip_address = request.client.host,
        user_agent = request.headers.get("User-Agent")
        )

    try:
        access_token = password_authentication(workos_auth_dto)
        return Response(
            status_code = status.HTTP_200_OK,
            content = '{"response": "Access-Token granted"}',
            headers = {'Access-Token': access_token}
            )
    except workos_exceptions.BadRequestException as e:
        logger.exception(f'Bad request exception during machine authorization.')
        return Response(
            status_code = status.HTTP_401_UNAUTHORIZED,
            content = '{"response": "Bad username or password"}'
            )

    except Exception as e:
        logger.exception(f'Exception during machine authorization.')
        return Response(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            content = '{"response": "Internal Server Error"}'
            )

@router.get("/authkit_url")
@router.get("/authkit_url/")
def get_auth_url():
    """Get a WorkOS AuthKit URL."""
    try:
        auth_url = get_authkit_url()
        return Response(
            status_code = status.HTTP_200_OK,
            content='{"url":"' + auth_url + '"}'
        )
    except Exception as e:
        logger.exception('Exception while getting authkit URL from WorkOS.')
        return Response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content='{"response":"Error getting authorization URL."}'
        )

@router.get("/authkit_callback")
@router.get("/authkit_callback/")
def authkit_callback(code: str):
    """Handle the WorkOS redirect auth code."""
    try:
        auth_response = handle_authkit_code(code = code)
        response = Response(
            status_code = status.HTTP_200_OK,
            content = {"response":"Ok"}
        )
        response.set_cookie(
            key = 'wos_session',
            value = auth_response.sealed_session,
            secure = True,
            httponly = True,
            samesite = "lax"
        )
        return response

    except Exception as e:
        logger.exception('Exception while handling auth callback.')
        return Response(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            content = '{"response":"Error while handling auth code."}'
        )
