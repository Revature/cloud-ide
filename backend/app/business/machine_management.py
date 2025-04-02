"""Module for managing cloud connectors, which are responsible for connecting to cloud services."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import Machine
from app.db import machine_repository

logger = get_task_logger(__name__)

def get_all_machines() -> list[Machine]:
    """Get all machines."""
    with Session(engine) as session:
        return machine_repository.find_all_machines(session)

def get_machine_by_id(id:int) -> Machine:
    """Get an machine by its id (numeric)."""
    with Session(engine) as session:
        return machine_repository.find_machine_by_id(session, id)
