"""Cloud Connector API routes."""

from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from sqlmodel import Session, select
from app.db.database import get_session
from app.models.cloud_connector import CloudConnector
from app.db import cloud_connector_repository

router = APIRouter()

# @router.post("/", response_model=CloudConnector, status_code=status.HTTP_201_CREATED)
# def create_cloud_connector(cloud_connector: CloudConnector, session: Session = Depends(get_session),
#                            access_token: str = Header(..., alias="Access-Token")
#                            ):
#     """Create a new cloud connector record."""
#     session.add(cloud_connector)
#     session.commit()
#     session.refresh(cloud_connector)
#     return cloud_connector

@router.get("/", response_model=list[CloudConnector])
def read_cloud_connectors(session: Session = Depends(get_session),
                access_token: str = Header(..., alias="Access-Token")
         ):
    """Retrieve a list of all cloud_connectors."""
    cloud_connectors = cloud_connector_repository.find_all_cloud_connectors(session)
    if not cloud_connectors:
        raise HTTPException(status_code=204, detail="No cloud connectors found")
    return cloud_connectors

@router.get("/{cloud_connector_id}", response_model=CloudConnector)
def read_cloud_connector(cloud_connector_id: int, session: Session = Depends(get_session),
               access_token: str = Header(..., alias="Access-Token")
               ):
    """Retrieve a single cloud_connector by ID."""
    cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=400, detail="cloud_connector not found")
    return cloud_connector
