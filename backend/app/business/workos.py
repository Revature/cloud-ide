"""Simple module to grab the workos session rather than repeating the same snippet."""

import os
from workos import WorkOSClient, exceptions as workos_exceptions

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
