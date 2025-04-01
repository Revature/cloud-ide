"""Registration route for creating user accounts."""
from http import HTTPStatus
from fastapi import APIRouter, Response
from app.business.workos import request_email_invite
from app.schemas.invite_request import EmailInviteRequest
from workos import exceptions as workos_exceptions

router = APIRouter()

@router.post("/email_invite", status_code=HTTPStatus.OK)
def email_invite(email_invite_request: EmailInviteRequest):
    """Generate a workos email invite for new users."""
    try:
        invitation = request_email_invite(email_invite_request.email)
        return Response(
            status_code = HTTPStatus.OK,
            content = '{"response": "An invite has been sent."}'
            )
    except workos_exceptions.BadRequestException as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f'Request for email invite failed: {e.message}, {email_invite_request.email}')
        return Response(
            status_code = HTTPStatus.BAD_REQUEST,
            content = '{"response":"Invite failed: ' + e.message + '"}'
        )
