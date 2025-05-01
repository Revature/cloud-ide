"""Module for managing cloud connectors, which are responsible for connecting to cloud services."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import CloudConnector
from app.db import cloud_connector_repository
from app.business.cloud_services import cloud_service_factory
import asyncio

logger = get_task_logger(__name__)

def get_all_cloud_connectors() -> list[CloudConnector]:
    """Get all cloud connectors."""
    with Session(engine) as session:
        return cloud_connector_repository.find_all_cloud_connectors(session)

def get_cloud_connector_by_id(id:int) -> CloudConnector:
    """Get an cloud_connector by its id (numeric)."""
    with Session(engine) as session:
        return cloud_connector_repository.find_cloud_connector_by_id(session, id)



def create_cloud_connector(provider: str, region: str, access_key: str, secret_key: str) -> CloudConnector:
    """
    Create a new cloud connector.

    Handles credential encryption and database creation.
    """
    # Create the cloud connector object
    cloud_connector = CloudConnector(
        provider=provider,
        region=region
    )

    # Set and encrypt the credentials
    cloud_connector.set_decrypted_access_key(access_key)
    cloud_connector.set_decrypted_secret_key(secret_key)

    # Create the connector in the database
    with Session(engine) as session:
        created_connector = cloud_connector_repository.create_cloud_connector(session, cloud_connector)
        return created_connector

async def validate_cloud_connector(cloud_connector: CloudConnector) -> dict:
    """
    Validate that a cloud connector has proper permissions.

    Returns:
    - On success: {"success": True}
    - On failure: {"error": True, "message": str, "denied_actions": list[str]}
    """
    print(f"Validating cloud connector: {cloud_connector}")
    try:
        # Create a cloud service instance to test the connection
        cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

        # Validate the account and check for missing permissions
        validation_result = await cloud_service.validate_account()

        if validation_result["status"] == "success":
            return {"success": True}
        else:
            return {
                "success": False,
                "message": validation_result["message"],
                "denied_actions": validation_result["denied_actions"]
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error validating cloud connector: {e!s}",
            "denied_actions": []
        }

async def create_and_validate_cloud_connector(region: str, provider: str, access_key: str, secret_key: str) -> dict:
    """
    Create a new cloud connector and validate it works.

    This function:
    1. Creates the cloud connector in the database
    2. Tests the connection using the cloud service validate_account method
    3. If validation fails, deletes the connector from the database

    Returns:
    - On success: {"success": True, "connector": CloudConnector}
    - On failure: {"success": False, "message": str, "denied_actions": list[str]}
    """
    # Create the connector
    created_connector = create_cloud_connector(provider=provider, region=region, access_key=access_key, secret_key=secret_key)

    # Validate the connector
    validation_result = await validate_cloud_connector(created_connector)

    # If validation failed, delete the connector
    if not validation_result.get("success", False):
        with Session(engine) as session:
            db_connector = cloud_connector_repository.find_cloud_connector_by_id(session, created_connector.id)
            if db_connector:
                session.delete(db_connector)
                session.commit()
        
        # Return the validation result directly
        return validation_result

    # Validation successful
    return {"success": True, "connector": created_connector}