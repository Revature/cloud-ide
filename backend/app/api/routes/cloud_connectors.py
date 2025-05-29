"""Cloud Connector API routes."""

from fastapi import APIRouter, HTTPException, Header, Request, responses
from app.models.cloud_connector import CloudConnector
from app.business import cloud_connector_management, endpoint_permission_decorator
from app.exceptions import cloud_connector_exceptions
from app.util.transactions import with_database_resilience, with_background_resilience
from pydantic import BaseModel

router = APIRouter()

class CloudConnectorCreate(BaseModel):
    """Data model for creating a new cloud connector."""

    provider: str
    region: str
    access_key: str
    secret_key: str

@router.get("/", response_model=list[CloudConnector])
@with_database_resilience
@endpoint_permission_decorator.permission_required("cloud_connectors")
def read_cloud_connectors(request: Request):
    """Retrieve a list of all cloud_connectors."""
    try:
        cloud_connectors = cloud_connector_management.get_all_cloud_connectors()

        if not cloud_connectors:
            raise HTTPException(status_code=204, detail="No cloud connectors found")

        return cloud_connectors

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e!s}") from e

@router.get("/{cloud_connector_id}", response_model=CloudConnector)
@with_database_resilience
@endpoint_permission_decorator.permission_required("cloud_connectors")
def read_cloud_connector(cloud_connector_id: int,
               request: Request
               ):
    """Retrieve a single cloud_connector by ID."""
    cloud_connector = cloud_connector_management.get_cloud_connector_by_id(cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=400, detail="cloud_connector not found")
    return cloud_connector

@router.put("/{cloud_connector_id}", response_model=CloudConnector)
@with_database_resilience
@endpoint_permission_decorator.permission_required("cloud_connectors")
def update_cloud_connector(
    cloud_connector_id: int,
    updated_cloud_connector: CloudConnector,
    request: Request
):
    """Update an existing cloud_connector."""
    # Get the existing cloud_connector
    success = cloud_connector_management.update_cloud_connector(cloud_connector_id, updated_cloud_connector)
    if not success:
        raise HTTPException(status_code=404, detail="Cloud Connector not found")
    return {"message": f"Cloud Connector {cloud_connector_id} updated successfully"}

class CloudConnectorStatusUpdate(BaseModel):
    """Data model for updating the status of a cloud connector."""

    is_active: bool

@router.patch("/{cloud_connector_id}/toggle", response_model=CloudConnector)
@endpoint_permission_decorator.permission_required("cloud_connectors")
def toggle_cloud_connector_status(
    cloud_connector_id: int,
    status_update: CloudConnectorStatusUpdate,
    request: Request
):
    """Update the active status of a cloud connector."""
    try:
        # Call business logic to update the status
        updated_connector = cloud_connector_management.update_cloud_connector_status(
            cloud_connector_id,
            status_update.is_active
        )

        if not updated_connector:
            raise HTTPException(status_code=404, detail="Cloud connector not found")

        return updated_connector
    except Exception as e:
        # Log the error for debugging
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update cloud connector status: {e!s}"
        ) from e

# Removed temporarily so this isn't accidentally used - keep the comment until we revisit this
# @router.delete("/{cloud_connector_id}", response_model=dict)
# async def delete_cloud_connector(cloud_connector_id: int):
#     """Delete a cloud connector."""
#     # Call business logic to delete the cloud connector
#     success = await cloud_connector_management.delete_cloud_connector(cloud_connector_id)
#     if not success:
#         raise HTTPException(status_code=404, detail="Cloud Connector not found")
#     return {"message": f"Cloud Connector {cloud_connector_id} deleted successfully"}

@router.post("/", response_model=dict)
@endpoint_permission_decorator.permission_required("cloud_connectors")
async def create_cloud_connector(cloud_connector: CloudConnectorCreate, request: Request):
    """Create a new cloud connector and test its connection."""
    try:
        # This will raise exceptions on validation failure
        connector = await cloud_connector_management.create_and_validate_cloud_connector(
            provider=cloud_connector.provider,
            region=cloud_connector.region,
            access_key=cloud_connector.access_key,
            secret_key=cloud_connector.secret_key,
        )

        # If we get here, validation was successful
        return {"success": True, "connector": connector}

    except cloud_connector_exceptions.AuthenticationError as e:
        # 401 Unauthorized for credential issues
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": str(e.message),
                "denied_actions": e.denied_actions
            }
        ) from e
    except cloud_connector_exceptions.PermissionError as e:
        # 403 Forbidden for permission issues
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "message": str(e.message),
                "denied_actions": e.denied_actions
            }
        ) from e
    except cloud_connector_exceptions.ConfigurationError as e:
        # 400 Bad Request for configuration issues
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "message": str(e.message),
                "denied_actions": getattr(e, "denied_actions", [])
            }
        ) from e
    except Exception as e:
        # 500 Internal Server Error for unexpected issues
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": f"An unexpected error occurred: {e!s}",
                "denied_actions": []
            }
        ) from e

@router.post("/{cloud_connector_id}/test", response_model=dict)
@endpoint_permission_decorator.permission_required("cloud_connectors")
async def test_cloud_connector(cloud_connector_id: int, request: Request):
    """Test an existing cloud connector's connection and permissions."""
    # Get the cloud connector
    cloud_connector = cloud_connector_management.get_cloud_connector_by_id(cloud_connector_id)
    if not cloud_connector:
        raise HTTPException(status_code=404, detail="Cloud connector not found")

    try:
        # Validate the connector - will raise exceptions on failure
        await cloud_connector_management.validate_cloud_connector(cloud_connector)

        # If we get here, validation was successful
        return {"success": True}

    except cloud_connector_exceptions.AuthenticationError as e:
        # 401 Unauthorized for credential issues
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": str(e.message),
                "denied_actions": e.denied_actions
            }
        ) from e
    except cloud_connector_exceptions.PermissionError as e:
        # 403 Forbidden for permission issues
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "message": str(e.message),
                "denied_actions": e.denied_actions
            }
        ) from e
    except cloud_connector_exceptions.ConfigurationError as e:
        # 400 Bad Request for configuration issues
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "message": str(e.message),
                "denied_actions": getattr(e, "denied_actions", [])
            }
        ) from e
    except Exception as e:
        # 500 Internal Server Error for unexpected issues
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": f"An unexpected error occurred: {e!s}",
                "denied_actions": []
            }
        ) from e
