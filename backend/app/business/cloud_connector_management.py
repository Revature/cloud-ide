"""Module for managing cloud connectors, which are responsible for connecting to cloud services."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import CloudConnector
from app.db import cloud_connector_repository

logger = get_task_logger(__name__)

def get_all_cloud_connectors() -> list[CloudConnector]:
    """Get all cloud connectors."""
    with Session(engine) as session:
        return cloud_connector_repository.find_all_cloud_connectors(session)

def get_cloud_connector_by_id(id:int) -> CloudConnector:
    """Get an cloud_connector by its id (numeric)."""
    with Session(engine) as session:
        return cloud_connector_repository.find_cloud_connector_by_id(session, id)
