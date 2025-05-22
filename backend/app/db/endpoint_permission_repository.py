# app/repositories/endpoint_permission_repository.py
"""Repository layer for the EndpointPermission entity."""
from sqlmodel import Session, select
from app.models.endpoint_permission import EndpointPermission
from typing import Optional
from app.db.database import engine

def find_all_endpoint_permissions() -> list[EndpointPermission]:
    """Select all endpoint permissions."""
    with Session(engine) as session:
        statement = select(EndpointPermission)
        return session.exec(statement).all()

def find_endpoint_permission_by_id(id: int) -> Optional[EndpointPermission]:
    """Select an endpoint permission by its ID."""
    with Session(engine) as session:
        statement = select(EndpointPermission).where(EndpointPermission.id == id)
        return session.exec(statement).first()

def find_endpoint_permission_by_resource_endpoint(
    resource: str,
    endpoint: str
) -> Optional[EndpointPermission]:
    """Find permission for a specific resource and endpoint."""
    with Session(engine) as session:
        statement = select(EndpointPermission).where(
            (EndpointPermission.resource == resource) &
            (EndpointPermission.endpoint == endpoint)
        )
        return session.exec(statement).first()

def create_endpoint_permission(
    endpoint_permission: EndpointPermission
) -> EndpointPermission:
    """Insert a new endpoint permission."""
    with Session(engine) as session:
        session.add(endpoint_permission)
        session.commit()
        session.refresh(endpoint_permission)
        return endpoint_permission

def update_endpoint_permission(
    endpoint_permission_id: int,
    endpoint_permission_data: dict
) -> Optional[EndpointPermission]:
    """Update an existing endpoint permission."""
    with Session(engine) as session:
        db_endpoint_permission = find_endpoint_permission_by_id(session, endpoint_permission_id)
        if not db_endpoint_permission:
            return None

        for key, value in endpoint_permission_data.items():
            if hasattr(db_endpoint_permission, key) and key != "id":
                setattr(db_endpoint_permission, key, value)

        session.add(db_endpoint_permission)
        session.commit()
        session.refresh(db_endpoint_permission)
        return db_endpoint_permission

def update_endpoint_permission_by_resource_endpoint(
    resource: str,
    endpoint: str,
    permission: str,
    modified_by: str
) -> Optional[EndpointPermission]:
    """Update an endpoint permission by resource and endpoint."""
    db_endpoint_permission = find_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

    if not db_endpoint_permission:
        return None

    db_endpoint_permission.permission = permission
    db_endpoint_permission.modified_by = modified_by

    with Session(engine) as session:
        session.add(db_endpoint_permission)
        session.commit()
        session.refresh(db_endpoint_permission)
        return db_endpoint_permission

def delete_endpoint_permission(endpoint_permission_id: int) -> bool:
    """Delete an endpoint permission."""
    db_endpoint_permission = find_endpoint_permission_by_id(endpoint_permission_id)
    if not db_endpoint_permission:
        return False

    with Session(engine) as session:
        session.delete(db_endpoint_permission)
        session.commit()
        return True

def delete_endpoint_permission_by_resource_endpoint(
    resource: str,
    endpoint: str
) -> bool:
    """Delete an endpoint permission by resource and endpoint."""
    db_endpoint_permission = find_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

    if not db_endpoint_permission:
        return False
    with Session(engine) as session:
        session.delete(db_endpoint_permission)
        session.commit()
        return True
