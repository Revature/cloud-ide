"""Cloud Connector API routes."""

from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from sqlmodel import Session, select
from app.db.database import get_session
from app.models.cloud_connector import CloudConnector

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
                #access_token: str = Header(..., alias="Access-Token")
         ):
    """Retrieve a list of all cloud_connectors."""
    cloud_connectors = session.exec(select(CloudConnector)).all()
    return cloud_connectors

@router.get("/{cloud_connector_id}", response_model=CloudConnector)
def read_cloud_connector(cloud_connector_id: int, session: Session = Depends(get_session),
               #access_token: str = Header(..., alias="Access-Token")
               ):
    """Retrieve a single cloud_connector by ID."""
    cloud_connector = session.get(CloudConnector, cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=404, detail="cloud_connector not found")
    return cloud_connector
