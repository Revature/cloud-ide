# app/models/mixins.py
"""Module for defining the database model mixins."""

from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from typing import Optional
from sqlalchemy import Column, DateTime

class TimestampMixin(SQLModel):
    """Mixin for adding timestamp fields to a model."""

    created_on: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Database timestamp when the record was created.",
    )
    updated_on: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_column_kwargs={
            "onupdate": lambda: datetime.now(timezone.utc),
        },
    )

    # Audit fields
    modified_by: Optional[str] = Field(default=None, description="User who last modified the record.")
    created_by: Optional[str] = Field(default=None, description="User who created the record.")
