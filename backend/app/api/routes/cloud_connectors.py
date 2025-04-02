"""Cloud Connector API routes."""

from fastapi import APIRouter, HTTPException, Header
from app.models.cloud_connector import CloudConnector
from app.business import cloud_connector_management

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
def read_cloud_connectors(
                access_token: str = Header(..., alias="Access-Token")
         ):
    """Retrieve a list of all cloud_connectors."""
    cloud_connectors = cloud_connector_management.get_all_cloud_connectors()
    if not cloud_connectors:
        raise HTTPException(status_code=204, detail="No cloud connectors found")
    return cloud_connectors

@router.get("/{cloud_connector_id}", response_model=CloudConnector)
def read_cloud_connector(cloud_connector_id: int,
               access_token: str = Header(..., alias="Access-Token")
               ):
    """Retrieve a single cloud_connector by ID."""
    cloud_connector = cloud_connector_management.get_cloud_connector_by_id(cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=400, detail="cloud_connector not found")
    return cloud_connector
