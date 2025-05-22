"""Machine model."""

from __future__ import annotations
from sqlmodel import SQLModel, Field, Session
from app.models.mixins import TimestampMixin
from app.db.database import engine


# Relationships
# images: Mapped[List["Image"]] = Relationship(back_populates="machine")
# runners: Mapped[List["Runner"]] = Relationship(back_populates="machine")

class Machine(TimestampMixin, SQLModel, table=True):
    """Machine model."""

    id: int | None = Field(default=None, primary_key=True)
    name: str
    identifier: str
    cpu_count: int
    memory_size: int
    storage_size: int
    cloud_connector_id: int = Field(foreign_key="cloud_connector.id")

class MachineUpdate(TimestampMixin, SQLModel):
    """Machine update model."""

    id: int
    name: str | None = None
    identifier: str | None = None
    cpu_count: int | None = None
    memory_size: int | None = None
    storage_size: int | None = None

def create_machine(machine: Machine):
    """Create a machine record in the database."""
    with Session(engine) as session:
        session.add(machine)
        session.refresh()
    return machine

def update_machine(machine: MachineUpdate):
    """Update a machine record in the database."""
    with Session(engine) as session:
        machine_from_db = session.get(Machine, machine.id)
        machine_data = machine.model_dump(exclude_unset=True)
        machine_from_db.sqlmodel_update(machine_data)
        session.add(machine_from_db)
        session.commit()
        session.refresh(machine_from_db)
        return machine_from_db


def get_machine(machine_id: int):
    """Get a machine record from the database."""
    with Session(engine) as session:
        return session.get(Machine, machine_id)

def delete_machine(machine_id: int):
    """Delete a machine record from the database."""
    with Session(engine) as session:
        session.delete(machine_id)
