"""User model."""

from __future__ import annotations
from enum import Enum
from typing import Optional, Literal
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Session
from sqlalchemy.orm import Mapped
from app.models.mixins import TimestampMixin
from app.db.database import get_session
from sqlmodel import Field, SQLModel, create_engine, select
from app.models import role, user_role

# Relationships
# runners: Mapped[List["Runner"]] = Relationship(back_populates="user")
# user_roles: Mapped[List["UserRole"]] = Relationship(back_populates="user")

# Define valid status values as a Literal type
UserStatus = Literal["active", "inactive", "suspended", "deleted"]

class User(TimestampMixin, SQLModel, table=True):
    """User model for the application."""

    id: int | None = Field(default=None, primary_key=True)
    first_name: str
    last_name: str
    email: str
    workos_id: str | None = None
    status: str = Field(default="active")

class UserUpdate(TimestampMixin, SQLModel):
    """User update model."""

    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    status: str | None = None
