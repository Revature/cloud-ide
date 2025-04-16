"""Simple module to grab the workos session rather than repeating the same snippet."""

import os
from workos import WorkOSClient
from app.exceptions.auth_exceptions import InvalidSealedSessionException
from app.models.user import User

workos = WorkOSClient(
    api_key=os.getenv("WORKOS_API_KEY"),
    client_id=os.getenv("WORKOS_CLIENT_ID"))

def get_workos_client() -> WorkOSClient:
    """Get the workos client."""
    return workos

def request_email_invite(email: str) -> str:
    """Call workos to send an invite email."""
    invitation = workos.user_management.send_invitation(
        email = email
    )
    return invitation.accept_invitation_url

def create_workos_user(*, password: str, user: User):
    """
    Create a user in workos orginization.

    If the process fails, workos will raise BadRequestException
    """
    return workos.user_management.create_user(
        password=password,
        **user
    ).id

def get_authkit_url():
    """Get a WorkOS AuthKit URL."""
    return workos.user_management.get_authorization_url(
        provider="authkit",
        redirect_uri=os.getenv("WORKOS_REDIRECT_URI") #This must match the redirect URI in workos dashboard
    )

def handle_authkit_code(code: str):
    """Handle the WorkOS redirect auth code."""
    return workos.user_management.authenticate_with_code(
        code = code,
        session = {"seal_session": True, "cookie_password": os.getenv("WORKOS_COOKIE_PASSCODE")}
    )

def authenticate_sealed_session(session_cookie: str):
    """Authenticate user with sealed session."""
    session = workos.user_management.load_sealed_session(
        sealed_session = session_cookie,
        cookie_password = os.getenv("WORKOS_COOKIE_PASSCODE")
    )

    auth_response = session.authenticate()
    if auth_response.authenticated:
        return auth_response

    refresh_result = session.refresh()
    if refresh_result.authenticated:
        return refresh_result

    raise InvalidSealedSessionException("Unable to authenticate or refresh sealed session.")
