"""Image model."""

from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy.orm import Mapped
from app.models.mixins import TimestampMixin
from app.db import database


# Relationships
# machine: Mapped[Optional["Machine"]] = Relationship(back_populates="images")
# runners: Mapped[List["Runner"]] = Relationship(back_populates="image")
# scripts: Mapped[List["Script"]] = Relationship(back_populates="image")

class Image(TimestampMixin, SQLModel, table=True):
    """Image model."""

    # id: Optional[int] = Field(default=None, primary_key=True)
    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    identifier: str
    runner_pool_size: int = Field(default=1)
    machine_id: int | None = Field(default=None, foreign_key="machine.id")
    cloud_connector_id: int = Field(foreign_key="cloud_connector.id")

class ImageUpdate(TimestampMixin, SQLModel):
    """Image update model."""

    id: int
    name: str | None = None
    description: str | None = None
    identifier: str | None = None

def create_image(image: Image):
    """Create an image record in the database."""
    with next(database.get_session()) as session:
        session.add(image)
        session.refresh()
    return image

def update_image(image: ImageUpdate):
    """Update an image record in the database."""
    with next(database.get_session()) as session:
        image_from_db = session.get(Image, image.id)
        image_data = image.model_dump(exclude_unset=True)
        image_from_db.sqlmodel_update(image_data)
        session.add(image_from_db)
        session.commit()
        session.refresh(image_from_db)
        return image_from_db


def get_image(image_id: int):
    """Retrieve an image record from the database."""
    with next(database.get_session()) as session:
        return session.get(Image, image_id)

def delete_image(image_id: int):
    """Delete an image record from the database."""
    with next(database.get_session()) as session:
        session.delete(image_id)
