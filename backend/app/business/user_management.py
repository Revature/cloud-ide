"""Business layer for user management."""

from app.db import user_repository
from sqlmodel import Session
from app.db.database import engine

def get_user_by_email(email: str):
    """Retrieve the user by their email."""
    with Session(engine) as session:
        return user_repository.find_user_by_email(session, email)