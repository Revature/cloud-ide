"""Script model."""
from __future__ import annotations
from typing import Optional
from sqlmodel import SQLModel, Field, Column, TEXT
from app.models.mixins import TimestampMixin
from app.db import database


# Relationship
# image: Mapped["Image"] = Relationship(back_populates="scripts")

class Script(TimestampMixin, SQLModel, table=True):
    """Script model."""

    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    event: str
    image_id: int = Field(foreign_key="image.id")
    script: str = Field(sa_column=Column(TEXT, nullable=False))

# script events
# 1. on_create
# 2. on_awaiting_client
# 3. on_connect
# 4. on_disconnect
# 5. on_terminate