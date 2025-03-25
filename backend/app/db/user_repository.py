"""Repository layer for the User entity."""
from app.models import User
from sqlmodel import Session, select

def find_user_by_email(session: Session, email: str)->User:
    """Retrieve the user by their email."""
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()
