"""Repository layer for the CloudConnector entity."""
from app.models import CloudConnector
from sqlmodel import Session, select
from app.db.database import engine

def find_all_cloud_connectors() -> list[CloudConnector]:
    """Select all cloud connectors."""
    with Session(engine) as session:
        statement = select(CloudConnector)
        return session.exec(statement).all()

def find_cloud_connector_by_id(id: str) -> CloudConnector:
    """Select a cloud connector by its ID."""
    with Session(engine) as session:
        statement = select(CloudConnector).where(CloudConnector.id == id)
        return session.exec(statement).first()

def create_cloud_connector(cloud_connector: CloudConnector) -> CloudConnector:
    """Insert a new cloud connector."""
    with Session(engine) as session:
        session.add(cloud_connector)
        session.commit()
        session.refresh(cloud_connector)
        return cloud_connector

def update_cloud_connector(cloud_connector_id: int, cloud_connector_data: CloudConnector) -> CloudConnector:
    """Update an existing cloud connector."""
    with Session(engine) as session:
        db_cloud_connector = find_cloud_connector_by_id(cloud_connector_id)
        if not db_cloud_connector:
            return None

        for key, value in cloud_connector_data.dict(exclude_unset=True).items():
            if hasattr(db_cloud_connector, key) and key != "id":
                setattr(db_cloud_connector, key, value)
        session.add(db_cloud_connector)
        session.commit()
        return db_cloud_connector

def update_connector_status(cloud_connector_id: int, is_active: bool) -> CloudConnector:
    """
    Update the status of a cloud connector.

    Args:
        session: Database session
        cloud_connector_id: ID of the cloud connector
        is_active: New status value (True for active, False for inactive)

    Returns:
        Updated CloudConnector object or None if not found
    """
    with Session(engine) as session:
        # Find the cloud connector
        cloud_connector = find_cloud_connector_by_id(cloud_connector_id)
        if not cloud_connector:
            return None

        new_status = "active" if is_active else "inactive"

        # Only update if the status is different from current
        if cloud_connector.status != new_status:
            # Update the status field
            cloud_connector.status = new_status

            # Save changes to the database
            session.add(cloud_connector)
            session.commit()
            session.refresh(cloud_connector)

        return cloud_connector

def delete_cloud_connector(cloud_connector_id: int) -> CloudConnector:
    """Delete a cloud connector."""
    with Session(engine) as session:
        db_cloud_connector = find_cloud_connector_by_id(cloud_connector_id)
        if not db_cloud_connector:
            return False

        db_cloud_connector.status = "deleted"
        session.add(db_cloud_connector)
        session.commit()
        return True
