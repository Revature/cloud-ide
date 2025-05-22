"""User Role model."""

from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Session
from sqlalchemy.orm import Mapped
from app.models.mixins import TimestampMixin
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
