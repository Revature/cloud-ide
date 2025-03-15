"""User model."""

from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy.orm import Mapped
from app.models.mixins import TimestampMixin
from app.db.database import get_session
from sqlmodel import Field, SQLModel, create_engine, select
from app.models import role, user_role

# Relationships
# runners: Mapped[List["Runner"]] = Relationship(back_populates="user")
# user_roles: Mapped[List["UserRole"]] = Relationship(back_populates="user")

class User(TimestampMixin, SQLModel, table=True):
    """User model for the application."""

    id: int | None = Field(default=None, primary_key=True)
    first_name: str
    last_name: str
    email: str
    workos_id: str | None = None

class UserUpdate(TimestampMixin, SQLModel):
    """User update model."""

    id: int
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None

def get_user(user_id: int):
    """Get a user record from the database."""
    with next(get_session()) as session:
        return session.get(User, user_id)

# In my mind there should be another step between the routes and models, like a service layer.
# The service would call create_user() here, and then after that's complete would call assign_role() to
# fill in the reference in the junction table -Kyle
def create_user(user: User):
    """Create a user record in the database."""
    with next(get_session()) as session:
        session.add(user)
        session.commit()
        session.refresh(user)
        user_role.assign_role(user, 2) # Default to "user" role
        return user

def update_user(user: UserUpdate):
    """Update a user record in the database."""
    with next(get_session()) as session:
        user_from_db = session.get(User, user.id)
        user_data = user.model_dump(exclude_unset=True)
        user_from_db.sqlmodel_update(user_data)
        session.add(user_from_db)
        session.commit()
        session.refresh(user_from_db)
        return user_from_db

def delete_user(user_id: int):
    """Delete a user record from the database."""
    with next(get_session()) as session:
        user = get_user(user_id)
        session.delete(user)
        session.commit()
