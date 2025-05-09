"""Module for managing cloud connectors, which are responsible for connecting to cloud services."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import CloudConnector
from app.db import cloud_connector_repository
from app.business.cloud_services import cloud_service_factory
from app.exceptions import cloud_connector_exceptions as cc_exceptions
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

async def validate_cloud_connector(cloud_connector: CloudConnector):
    """
    Validate that a cloud connector has proper permissions.

    Raises:
    - AuthenticationError: When credentials are invalid
    - PermissionError: When credentials are valid but permissions are insufficient
    - ConfigurationError: When there's a configuration issue
    - Exception: For other unexpected errors
    """
    print(f"Validating cloud connector: {cloud_connector}")
    try:
        # Create a cloud service instance to test the connection
        cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

        # Validate the account and check for missing permissions
        validation_result = await cloud_service.validate_account()

        if validation_result["status"] == "success":
            return  # Success - no exception raised

        # Determine the type of error
        denied_actions = validation_result.get("denied_actions", [])
        message = validation_result.get("message", "")

        # Authentication error (STS failure)
        if "sts:GetCallerIdentity" in denied_actions or any(
            auth_err in message.lower() for auth_err in
            ["invalid client", "security token", "signature", "unauthorized"]
        ):
            raise cc_exceptions.AuthenticationError(message, denied_actions)

        # Permission error (STS works but other permissions missing)
        elif denied_actions:
            raise cc_exceptions.PermissionError(message, denied_actions)

        # Other configuration issues
        else:
            raise cc_exceptions.ConfigurationError(message, denied_actions)

    except (cc_exceptions.AuthenticationError, cc_exceptions.PermissionError, cc_exceptions.ConfigurationError):
        # Re-raise these specific exceptions
        raise
    except Exception as e:
        # Wrap general exceptions
        raise cc_exceptions.ConfigurationError(f"Error validating cloud connector: {e!s}") from e


async def create_and_validate_cloud_connector(region: str, provider: str, access_key: str, secret_key: str):
    """
    Create a new cloud connector and validate it works.

    Returns the created connector on success.

    Raises:
    - AuthenticationError: When credentials are invalid
    - PermissionError: When credentials are valid but permissions are insufficient
    - ConfigurationError: When there's a configuration issue
    """
    # Create the connector
    created_connector = create_cloud_connector(provider=provider, region=region,
                                              access_key=access_key, secret_key=secret_key)

    try:
        # Validate the connector - will raise exceptions on failure
        await validate_cloud_connector(created_connector)
        # Validation successful
        return created_connector
    except (cc_exceptions.AuthenticationError, cc_exceptions.PermissionError, cc_exceptions.ConfigurationError) as e:
        # If validation failed, delete the connector
        with Session(engine) as session:
            db_connector = cloud_connector_repository.find_cloud_connector_by_id(
                session, created_connector.id)
            if db_connector:
                session.delete(db_connector)
                session.commit()

        # Re-raise the exception
        raise

def update_cloud_connector(cloud_connector_id: int, updated_cloud_connector: CloudConnector) -> bool:
    """Update an existing cloud connector."""
    with Session(engine) as session:
        # Get the updated cloud connector from repository
        db_cloud_connector = cloud_connector_repository.update_cloud_connector(session, cloud_connector_id, updated_cloud_connector)
        session.commit()
        
    return True

def update_cloud_connector_status(cloud_connector_id: int, is_active: bool) -> CloudConnector:
    """
    Update the active status of a cloud connector.

    Args:
        cloud_connector_id: The ID of the cloud connector to update
        is_active: The new status to set (True for active, False for inactive)

    Returns:
        Updated CloudConnector object or None if not found
    """
    with Session(engine) as session:
        try:
            # Get the cloud connector from repository
            updated_connector = cloud_connector_repository.update_connector_status(
                session, 
                cloud_connector_id, 
                is_active
            )

            if not updated_connector:
                return None

            # Commit the transaction
            session.commit()
            session.refresh(updated_connector)

            return updated_connector
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error in update_cloud_connector_status: {str(e)}")
            raise