"""Repository layer for the CloudConnector entity."""
from backend.app.models import CloudConnector
from sqlmodel import Session, select

def find_cloud_connector_by_id(session:Session, id:str) -> CloudConnector:
    """Select a cloud connector by its ID."""
    statement: Select[CloudConnector] = select(CloudConnector).where(CloudConnector.id == id)
    return session.exec(statement).first()
