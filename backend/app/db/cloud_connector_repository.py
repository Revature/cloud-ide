"""Repository layer for the CloudConnector entity."""
from app.models import CloudConnector
from sqlmodel import Session, select

def find_all_cloud_connectors(session:Session) -> list[CloudConnector]:
    """Select all cloud connectors."""
    statement = select(CloudConnector)
    return session.exec(statement).all()

def find_cloud_connector_by_id(session:Session, id:str) -> CloudConnector:
    """Select a cloud connector by its ID."""
    statement = select(CloudConnector).where(CloudConnector.id == id)
    return session.exec(statement).first()
