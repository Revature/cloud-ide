"""Schema for username/password auth objects."""
from pydantic import BaseModel

class PasswordAuth(BaseModel):
    """Auth object to carry username and password in request."""

    email: str
    password: str

class WorkOSAuthDTO(BaseModel):
    """Work OS Auth object to carry username and password plus optional params."""

    email: str
    password: str
    ip_address: str = ""
    user_agent: str = ""
