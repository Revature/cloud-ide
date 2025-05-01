"""Simple module to grab the workos session rather than repeating the same snippet."""
import os
from workos import WorkOSClient, exceptions as workos_exceptions

from app.exceptions.authentication_exceptions import BadRefreshException
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

def generate_auth_url():
    """Return an authkit URL for login."""
    return workos.user_management.get_authorization_url(
        provider = 'authkit',
        redirect_uri = os.getenv('WORKOS_CALLBACK_URL')
    )

def handle_callback_code(code: str):
    """Handle the code after workos authkit redirects user back."""
    return workos.user_management.authenticate_with_code(
        code = code,
        session = {"seal_session": True, "cookie_password": os.getenv('WORKOS_COOKIE_PASSCODE')}
    )

def open_sealed_session(sealed_session: str):
    """Unseal a sealed session using workos cookie passcode."""
    return workos.user_management.load_sealed_session(
        sealed_session = sealed_session,
        cookie_password = os.getenv('WORKOS_COOKIE_PASSCODE')
    )

def authenticate_sealed_session(sealed_session: str):
    """Open a sealed session and attempt to authenticate."""
    auth_result = open_sealed_session(sealed_session = sealed_session).authenticate()
    return auth_result

def refresh_sealed_session(sealed_session: str):
    """Refresh an expired sealed session."""
    refresh_result = open_sealed_session(sealed_session = sealed_session).refresh()
    if not refresh_result.authenticated:
        raise BadRefreshException('Authentication failed after WorkOS token refresh.')
    return refresh_result
