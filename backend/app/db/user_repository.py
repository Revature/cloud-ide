"""Repository layer for the User entity."""
from app.db.database import get_session
from app.models import User
from app.models import UserRole
from sqlmodel import Session, select
from app.exceptions.user_exceptions import NoSuchRoleException
from app.models.role import Role
from app.models.user import UserUpdate

def get_all_users(session: Session = next(get_session())):
    """Read all users from the user table."""
    return session.exec(select(User)).all()

def get_user_by_email(email: str, session: Session = next(get_session()))->User:
    """Retrieve the user by their email."""
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()

def get_user_by_id(user_id: int, session: Session = next(get_session())):
    """Get a user record from the database."""
    return session.get(User, user_id)

def persist_user(user: User, session: Session = next(get_session())):
    """Create a user record in the database."""
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def update_user(user: UserUpdate, session: Session = next(get_session())):
    """Update a user record in the database."""
    user_from_db = session.get(User, user.id)
    user_data = user.model_dump(exclude_unset=True)
    user_from_db.sqlmodel_update(user_data)
    session.add(user_from_db)
    session.commit()
    session.refresh(user_from_db)
    return user_from_db

def delete_user(user_id: int, session: Session = next(get_session())):
    """Delete a user record from the database."""
    user = get_user_by_id(user_id)
    session.delete(user)
    session.commit()

def assign_role(user: User, role_id: int, session: Session = next(get_session())):
    """Assign a role to a user."""
    user_role: UserRole = UserRole(user_id = user.id, role_id = role_id)
    session.add(user_role)
    session.commit()

def remove_role(role_id: int, session: Session = next(get_session())):
    """Remove a role from the database."""
    session.delete(role_id)

def read_role(name: str, session: Session = next(get_session())):
    """Get a role from db."""
    role: Role = session.exec(select(Role).where(Role.name == name)).first()
    if not role:
        raise NoSuchRoleException('Role not found.')
    return role
