"""User schema."""
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    """User create model."""

    first_name: str
    last_name: str
    email: EmailStr
