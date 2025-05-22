"""Repository layer for the User entity."""
from app.models import User
from app.models import UserRole
from sqlmodel import Session, select
from app.exceptions.user_exceptions import NoSuchRoleException
from app.models.role import Role
from app.models.user import UserUpdate
from app.db.database import engine

def get_all_users():
    """Read all users from the user table."""
    with Session(engine) as session:
        return session.exec(select(User)).all()

def get_user_by_email(email: str)->User:
    """Retrieve the user by their email."""
    with Session(engine) as session:
        statement = select(User).where(User.email == email)
        return session.exec(statement).first()

def get_user_by_id(user_id: int):
    """Get a user record from the database."""
    with Session(engine) as session:
        return session.get(User, user_id)

def persist_user(user: User):
    """Create a user record in the database."""
    with Session(engine) as session:
        session.add(user)
        session.commit()
        session.refresh(user)
        print(f"Persisted user: {user}")
        return user

def update_user(user: UserUpdate):
    """Update a user record in the database."""
    with Session(engine) as session:
        user_from_db = session.get(User, user.id)
        user_data = user.model_dump(exclude_unset=True)
        user_from_db.sqlmodel_update(user_data)
        session.add(user_from_db)
        session.commit()
        session.refresh(user_from_db)
        return user_from_db

def delete_user(user_id: int):
    """
    Soft delete a user record by setting status to 'deleted'.

    Previously this physically deleted the record.
    """
    with Session(engine) as session:
        user = get_user_by_id(user_id, session=session)
        if user:
            user.status = "deleted"
            session.add(user)
            session.commit()
            session.refresh(user)
            return user
        return None

def assign_role(user: User, role_id: int):
    """Assign a role to a user."""
    with Session(engine) as session:
        user_role: UserRole = UserRole(user_id = user.id, role_id = role_id)
        session.add(user_role)
        session.commit()

def remove_role(role_id: int):
    """Remove a role from the database."""
    with Session(engine) as session:
        session.delete(role_id)

def read_role(name: str):
    """Get a role from db."""
    with Session(engine) as session:
        role: Role = session.exec(select(Role).where(Role.name == name)).first()
        if not role:
            raise NoSuchRoleException('Role not found.')
        return role
