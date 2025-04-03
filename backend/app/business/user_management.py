"""Business layer for user management."""
import logging
from app.db import user_repository
from sqlmodel import Session
from app.util.constants import default_role_name
from app.db.database import get_session
from app.exceptions.user_exceptions import EmailInUseException
from app.models.user import User, UserUpdate
from app.business.workos import create_workos_user

logger = logging.getLogger(__name__)

def get_all_users(session: Session = next(get_session())):
    """Read all users from the database."""
    return user_repository.get_all_users(session)

def get_user_by_email(email: str, session: Session = next(get_session())):
    """
    Retrieve the user by their email.

    If a session object is passed, uses that session. Otherwise will get a new session.
    """
    return user_repository.get_user_by_email(email = email, session = session)

def get_user_by_id(user_id: int, session: Session = next(get_session())):
    """Retrieve the user by id."""
    return user_repository.get_user_by_id(user_id = user_id, session = session)

def create_user(*, password: str, user: User, session: Session = next(get_session())) -> User:
    """
    Create a new user. Assigns the default role.

    If a session object is passed, uses that session. Otherwise will get a new session.

    Can raise workos.BadRequestException, EmailInUseException, NoSuchRoleException.
    """
    # Make sure email is not already in use
    if get_user_by_email(email = user.email, session = session):
        error_msg = f'Unable to create new user, email: {user.email} is already in use.'
        logger.exception(error_msg)
        raise EmailInUseException(error_msg)

    # Create the user in workos
    user.workos_id = create_workos_user(
        password=password,
        **user
        )

    # Persist and refresh user
    user = user_repository.persist_user(user, session = session)

    # Set default role
    default_role = user_repository.read_role(default_role_name, session = session)
    user_repository.assign_role(user = user, role = default_role.id, session = session)
    return user

def update_user(user: UserUpdate, session: Session = next(get_session())):
    """Update a user with UserUpdate object."""
    return user_repository.update_user(user = user, session = session)

def delete_user(user_id: int, session: Session = next(get_session())):
    """Delete a user."""
    user_repository.delete_user(user_id = user_id, session = session)
