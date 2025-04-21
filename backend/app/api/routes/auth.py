"""Authorization route for acquiring bearer tokens."""
import logging
import os
from workos import exceptions as workos_exceptions
from app.business.authentication import password_authentication
from app.business.workos import get_workos_client
from app.schemas.auth_schema import PasswordAuth, WorkOSAuthDTO
from fastapi import APIRouter, Header, Request, Response, status

workos = get_workos_client()
router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", status_code=200)
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
        logger.exception(str(e))
        return Response(
            status_code = status.HTTP_401_UNAUTHORIZED,
            content = '{"response": "Bad username or password"}'
            )
    except Exception as e:
        logger.exception(str(e))
        return Response(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            content = '{"response": "Internal Server Error"}'
            )
