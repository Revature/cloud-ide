"""User authorization route."""

import logging
import os

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import RedirectResponse
from workos import exceptions as workos_exceptions
from app.business.workos import generate_auth_url, get_workos_client, handle_callback_code


workos = get_workos_client()
router = APIRouter()
logger = logging.getLogger(__name__)
auth_landing_url = os.getenv('AUTH_LANDING_URL')

@router.get('/authkit_url/', status_code=status.HTTP_200_OK)
def get_auth_url():
    """Generate an authkit URL for login."""
    auth_url = generate_auth_url()
    return Response(
        status_code = status.HTTP_200_OK,
        content = '{"url":"' + auth_url + '"}'
        )

@router.get('/authkit_redirect/')
def auth_redirect():
    """Redirect user to authkit for login."""
    auth_url = generate_auth_url()
    return RedirectResponse(auth_url)

@router.get('/callback/')
def authkit_callback(request: Request, code: str):
    """Handle users returning from workos authkit login flow."""
    try:
        auth_result = handle_callback_code(code = code)
        response = RedirectResponse(
            url = auth_landing_url
        )
        response.set_cookie(
            key = "wos_session",
            value = auth_result.sealed_session,
            secure = True,
            httponly = True,
            samesite = "lax"
        )

    except workos_exceptions.BadRequestException as e:
        logger.exception('An exception ocurred while parsing the workos callback code.')
        return Response(
            status_code = status.HTTP_400_BAD_REQUEST,
            content = '{"response":"Internal Server Error: ' + str(e) + '"}'
        )
