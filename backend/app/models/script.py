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

class ScriptUpdate(TimestampMixin, SQLModel):
    """Script update model."""

    id: int
    name: str | None = None
    description: str | None = None
    event: str | None = None
    script: str | None = None

def create_script(script: Script):
    """Create a script record in the database."""
    with next(database.get_session()) as session:
        session.add(script)
        session.refresh()
    return script

def update_script(script: ScriptUpdate):
    """Update a script record in the database."""
    with next(database.get_session()) as session:
        script_from_db = session.get(Script, script.id)
        script_data = script.model_dump(exclude_unset=True)
        script_from_db.sqlmodel_update(script_data)
        session.add(script_from_db)
        session.commit()
        session.refresh(script_from_db)
        return script_from_db


def get_script(script_id: int):
    """Retrieve a script record from the database."""
    with next(database.get_session()) as session:
        return session.get(Script, script_id)

def delete_script(script_id: int):
    """Delete a script record from the database."""
    with next(database.get_session()) as session:
        session.delete(script_id)
        session.commit()

