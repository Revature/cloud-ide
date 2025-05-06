"""Cloud Connector API routes."""

from fastapi import APIRouter, HTTPException, Header, Request, responses
from app.models.cloud_connector import CloudConnector
from app.business import cloud_connector_management
from app.exceptions import cloud_connector_exceptions
from pydantic import BaseModel

router = APIRouter()

@router.get("/", response_model=list[CloudConnector])
async def read_cloud_connectors(request: Request):
    """Retrieve a list of all cloud_connectors."""
    # Log request details
    print(f"Request received for cloud_connectors endpoint")
    print(f"Client host: {request.client.host}")

    # Log all headers to see what's being sent
    print("Request headers:")
    for header_name, header_value in request.headers.items():
        print(f"  {header_name}: {header_value}")

    # Log query parameters if any
    print("Query parameters:")
    for param_name, param_value in request.query_params.items():
        print(f"  {param_name}: {param_value}")

    try:
        # Log before the database call
        print("Attempting to fetch cloud connectors from database")
        cloud_connectors = cloud_connector_management.get_all_cloud_connectors()

        # Log the result
        if not cloud_connectors:
            print("No cloud connectors found in database")
            raise HTTPException(status_code=204, detail="No cloud connectors found")

        print(f"Successfully retrieved {len(cloud_connectors)} cloud connectors")

        # Optionally log some data about what's being returned
        for i, connector in enumerate(cloud_connectors):
            print(f"Connector {i+1}: ID={connector.id}, Provider={connector.provider}")

        return cloud_connectors

    except Exception as e:
        # Log any exceptions that occur
        print(f"Error fetching cloud connectors: {e!s}")
        print("Detailed exception information:")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e!s}") from e

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
async def test_cloud_connector(cloud_connector_id: int):
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
