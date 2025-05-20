"""Image model."""

from __future__ import annotations
from typing import Optional, Literal
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy.orm import Mapped
from sqlalchemy import JSON
from app.models.mixins import TimestampMixin
from app.db import database


# Relationships
# machine: Mapped[Optional["Machine"]] = Relationship(back_populates="images")
# runners: Mapped[List["Runner"]] = Relationship(back_populates="image")
# scripts: Mapped[List["Script"]] = Relationship(back_populates="image")

# Statuses
# creating
# active
# inactive
# deleted

# Image status type
ImageStatus = Literal["creating", "active", "inactive", "deleted"]

class Image(TimestampMixin, SQLModel, table=True):
    """Image model."""

    # id: Optional[int] = Field(default=None, primary_key=True)
    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    identifier: str
    runner_pool_size: int = Field(default=0)
    machine_id: int | None = Field(default=None, foreign_key="machine.id")
    cloud_connector_id: int = Field(foreign_key="cloud_connector.id")
    status: str = Field(default="creating", description="Current status of the image")
    tags: list[str] = Field(
        default=[],
        sa_column=Column(JSON, nullable=True),
        description="List of tags associated with the image"
    )
