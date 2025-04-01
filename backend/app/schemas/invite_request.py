"""Schema used in requests for email invitations."""
from pydantic import BaseModel

class EmailInviteRequest(BaseModel):
    """Schema used when requesting email invitation."""

    email: str
