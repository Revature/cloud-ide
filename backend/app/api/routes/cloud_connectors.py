"""Cloud Connector API routes."""

from fastapi import APIRouter, HTTPException, Header
from app.models.cloud_connector import CloudConnector
from app.business import cloud_connector_management
from pydantic import BaseModel

router = APIRouter()

@router.get("/", response_model=list[CloudConnector])
def read_cloud_connectors(
                #access_token: str = Header(..., alias="Access-Token")
         ):
    """Retrieve a list of all cloud_connectors."""
    cloud_connectors = cloud_connector_management.get_all_cloud_connectors()
    if not cloud_connectors:
        raise HTTPException(status_code=204, detail="No cloud connectors found")
    return cloud_connectors

@router.get("/{cloud_connector_id}", response_model=CloudConnector)
def read_cloud_connector(cloud_connector_id: int,
               #access_token: str = Header(..., alias="Access-Token")
               ):
    """Retrieve a single cloud_connector by ID."""
    cloud_connector = cloud_connector_management.get_cloud_connector_by_id(cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=400, detail="cloud_connector not found")
    return cloud_connector

class CloudConnectorCreate(BaseModel):
    """Data model for creating a new cloud connector."""

    provider: str
    region: str
    access_key: str
    secret_key: str

@router.post("/", response_model=dict)
async def create_cloud_connector(cloud_connector: CloudConnectorCreate):
    """
    Create a new cloud connector and test its connection.

    If successful, returns the created connector.
    If validation fails, returns a list of missing permissions.
    """
    result = await cloud_connector_management.create_and_validate_cloud_connector(
        provider=cloud_connector.provider,
        region=cloud_connector.region,
        access_key=cloud_connector.access_key,
        secret_key=cloud_connector.secret_key,
    )

    if "error" in result:
        # Return an error response with the missing permissions
        return {"success": False, "message": result["message"], "denied_actions": result["denied_actions"]}
    else:
        # Return success with the created connector
        return {"success": True, "connector": result["connector"]}

@router.post("/{cloud_connector_id}/test", response_model=dict)
async def test_cloud_connector(cloud_connector_id: int):
    """
    Test an existing cloud connector's connection and permissions.

    Returns:
    - On success: {"success": true}
    - On failure: {"success": false, "message": error message, "denied_actions": [list of missing permissions]}
    """
    # Get the cloud connector
    cloud_connector = cloud_connector_management.get_cloud_connector_by_id(cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=404, detail="Cloud connector not found")

    # Validate the cloud connector
    validation_result = await cloud_connector_management.validate_cloud_connector(cloud_connector)

    if "error" in validation_result:
        # Return an error response with the missing permissions
        return {
            "success": False,
            "message": validation_result["message"],
            "denied_actions": validation_result["denied_actions"]
        }
    else:
        # Return success
        return {"success": True}
