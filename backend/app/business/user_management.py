"""Business layer for user management."""
import logging
import os
from app.db import user_repository
from sqlmodel import Session
from app.util.constants import default_role_name
from app.db.database import engine
from app.exceptions.user_exceptions import EmailInUseException
from app.models.user import User, UserUpdate
from app.business.workos import create_workos_user, create_organization_membership, delete_workos_user

logger = logging.getLogger(__name__)

def get_all_users():
    """Read all users from the database."""
    return user_repository.get_all_users()

def get_user_by_email(email: str):
    """
    Retrieve the user by their email.

    If a session object is passed, uses that session. Otherwise will get a new session.
    """
    return user_repository.get_user_by_email(email = email)

def get_user_by_id(user_id: int):
    """Retrieve the user by id."""
    return user_repository.get_user_by_id(user_id = user_id)

def create_user(*, password: str, user: User) -> User:
    """
    Create a new user. Assigns the default role.

    If a session object is passed, uses that session. Otherwise will get a new session.

    Can raise workos.BadRequestException, EmailInUseException, NoSuchRoleException.
    """
    # Make sure email is not already in use
    if get_user_by_email(email=user.email):
        error_msg = f'Unable to create new user, email: {user.email} is already in use.'
        logger.exception(error_msg)
        raise EmailInUseException(error_msg)

    # Create the user in workos - no need to create a dictionary here anymore
    user.workos_id = create_workos_user(
        password=password,
        user=user  # Pass the user object directly
    )

    organization_membership = create_organization_membership(
        workos_user_id=user.workos_id,
        organization_id=os.getenv('WORKOS_ORG_ID')
    )

    # Persist and refresh user
    user = user_repository.persist_user(user)
    print(f"Persisted user: {user}")

    # Set default role
    default_role = user_repository.read_role(default_role_name)
    user_repository.assign_role(user=user, role_id=default_role.id)
    return user

def update_user(user: UserUpdate):
    """Update a user with UserUpdate object."""
    return user_repository.update_user(user = user)

def delete_user(user_id: int):
    """
    Mark a user as deleted in our database and delete them from WorkOS.

    This is a soft delete operation that maintains the user record with 'deleted' status.
    """
    # Get the user to be deleted
    user = get_user_by_id(user_id)
    if not user:
        return None

    # If the user has a WorkOS ID, delete them from WorkOS
    if user.workos_id:
        try:
            delete_workos_user(user.workos_id)
            logger.info(f"Deleted user {user.email} from WorkOS (ID: {user.workos_id})")
        except Exception as e:
            # Log the error but continue with soft delete
            logger.error(f"Failed to delete user from WorkOS: {e}")

    # Use the repository layer to perform the soft delete
    updated_user = user_repository.delete_user(user_id=user_id)

    return updated_user
