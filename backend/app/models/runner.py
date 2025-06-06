"""Runner model."""

from __future__ import annotations
from typing import Any
from datetime import datetime
from sqlmodel import SQLModel, Field, Session
from sqlalchemy import Column, JSON
from app.models.mixins import TimestampMixin
from pydantic import BaseModel
from app.db.database import engine

# states
# runner_starting
# app_starting
# ready
# setup
# awaiting_client
# active
# disconnecting
# disconnected
# closed
# terminated

# runner_alive states = [runner_starting, app_starting, ready, setup, awaiting_client, active, disconnecting, disconnected]
# runner_dead states = [closed, terminated]

# Relationships
# machine: Mapped["Machine"] = Relationship(back_populates="runners")
# image: Mapped["Image"] = Relationship(back_populates="runners")
# user: Mapped["User"] = Relationship(back_populates="runners")
# runner_histories: Mapped[List["RunnerHistory"]] = Relationship(back_populates="runner")

class Runner(TimestampMixin, SQLModel, table=True):
    """Runner model for the application."""

    id: int | None = Field(default=None, primary_key=True)
    machine_id: int = Field(foreign_key="machine.id")
    image_id: int = Field(foreign_key="image.id")
    user_id: int | None = Field(default=None, foreign_key="user.id")
    key_id: int | None = Field(default=None, foreign_key="key.id")
    state: str
    url: str
    lifecycle_token: str | None = None
    terminal_token: str | None = None
    user_ip: str | None = None
    identifier: str
    external_hash: str
    env_data: dict[str, Any] = Field(
        default={},
        sa_column=Column(JSON, nullable=False)
    )
    session_start: datetime | None = None
    session_end: datetime | None = None
    ended_on: datetime | None = None

    @property
    def is_alive_state(self) -> bool:
        """Return True if the runner's state is considered 'alive'."""
        alive_states = {
            "runner_starting", "app_starting", "ready", "runner_starting_claimed",
            "ready_claimed", "setup",
            "awaiting_client", "active", "disconnecting", "disconnected"
        }
        return self.state in alive_states

    @property
    def should_run_terminate_script(self) -> bool:
        """Return True if the runner's state is considered 'in use'."""
        do_not_run = {
            "ready", "ready_claimed", "runner_starting_claimed",
            "runner_starting", "app_starting", "terminated", "closed"
        }
        return self.state not in do_not_run

class RunnerResponse(BaseModel):
    """Runner response model with user email."""

    id: int
    machine_id: int
    image_id: int
    user_id: int | None = None
    key_id: int | None = None
    state: str
    url: str
    lifecycle_token: str | None = None
    terminal_token: str | None = None
    user_ip: str | None = None
    identifier: str
    external_hash: str
    env_data: dict[str, Any]
    session_start: datetime | None = None
    session_end: datetime | None = None
    ended_on: datetime | None = None

    # Add timestamp fields from TimestampMixin
    created_on: datetime | None = None
    updated_on: datetime | None = None
    modified_by: str | None = None
    created_by: str | None = None

    # Add user email field
    user_email: str | None = None

    class Config:
        """config for runner response model."""

        orm_mode = True

class RunnerUpdate(TimestampMixin, SQLModel):
    """Runner update model."""

    id: int
    state: str
    url: str
    user_ip: str | None = None
    external_hash: str
    env_data: dict[str, Any] | None = None
    session_start: datetime | None = None
    session_end: datetime | None = None
    ended_on: datetime | None = None

def create_runner(runner: Runner):
    """Create a runner record in the database."""
    with Session(engine) as session:
        session.add(runner)
        session.commit()
        session.refresh()
    return runner

def update_runner(runner: RunnerUpdate):
    """Update a runner record in the database."""
    with Session(engine) as session:
        runner_from_db = session.get(Runner, runner.id)
        runner_data = runner.model_dump(exclude_unset=True)
        runner_from_db.sqlmodel_update(runner_data)
        session.add(runner_from_db)
        session.commit()
        session.refresh(runner_from_db)
        return runner_from_db


def get_runner(runner_id: int):
    """Get a runner record from the database."""
    with Session(engine) as session:
        return session.get(Runner, runner_id)

def delete_runner(runner_id: int):
    """Delete a runner record from the database."""
    with Session(engine) as session:
        session.delete(runner_id)
        session.commit()
