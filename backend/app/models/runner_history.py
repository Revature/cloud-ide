"""Runner History model."""

from __future__ import annotations
from typing import Optional, Any
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON
from sqlalchemy.orm import Mapped
from app.models.mixins import TimestampMixin

# Relationships
# runner: Mapped["Runner"] = Relationship(back_populates="runner_histories")

class RunnerHistory(TimestampMixin, SQLModel, table=True):
    """Runner History model for the application."""

    __tablename__ = "runner_history"
    id: int | None = Field(default=None, primary_key=True)
    runner_id: int = Field(foreign_key="runner.id")
    event_name: str
    event_data: dict[str, Any] = Field(
        default={},
        sa_column=Column(JSON, nullable=False)
    )

