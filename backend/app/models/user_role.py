"""User Role model."""

from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy.orm import Mapped
from app.models.mixins import TimestampMixin
from app.db.database import get_session
from app.models import user, role

# Relationships
# user: Mapped["User"] = Relationship(back_populates="user_roles")
# role: Mapped["Role"] = Relationship(back_populates="user_roles")

class UserRole(TimestampMixin, SQLModel, table=True):
    """User Role model for the application."""

    __tablename__ = "user_role"
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    role_id: int = Field(foreign_key="role.id")

def assign_role(user: user.User, role_id: int):
    """Assign a role to a user."""
    user_role: UserRole = UserRole(user_id = user.id, role_id = role_id)
    with next(get_session()) as session:
        session.add(user_role)
        session.commit()

def remove_role(role_id: int):
    """Remove a role from the database."""
    with next(get_session()) as session:
        session.delete(role_id)

