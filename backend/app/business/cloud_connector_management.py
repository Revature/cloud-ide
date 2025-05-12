"""Module for managing cloud connectors, which are responsible for connecting to cloud services."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import CloudConnector
from app.db import cloud_connector_repository
from app.business.cloud_services import cloud_service_factory
from app.business import image_management
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
            logger.error(f"Error in update_cloud_connector_status: {e!s}")
            raise

async def delete_cloud_connector(cloud_connector_id: int) -> bool:
    """
    Delete an existing cloud connector and all associated images.

    This function:
    1. Checks if the cloud connector exists
    2. Gets all associated images
    3. Properly deletes each image using image_management.delete_image
    4. Deletes the cloud connector itself
    5. Handles any errors during the process

    Args:
        cloud_connector_id: ID of the cloud connector to delete

    Returns:
        bool: True if the cloud connector was successfully deleted

    Raises:
        RunnerExecException: If an error occurs during image deletion or connector deletion
    """
    logger.info(f"Deleting cloud connector with ID {cloud_connector_id} and all associated images")

    # Get the cloud connector and associated images
    try:
        with Session(engine) as session:
            # Verify the cloud connector exists
            db_connector = cloud_connector_repository.find_cloud_connector_by_id(session, cloud_connector_id)
            if not db_connector:
                logger.error(f"Cloud connector with ID {cloud_connector_id} not found")
                return False

            # Get all images associated with this cloud connector
            images = image_management.get_images_by_cloud_connector_id(cloud_connector_id)
            logger.info(f"Found {len(images)} images associated with cloud connector {cloud_connector_id}")

            # Track the images for deletion
            image_ids = [image.id for image in images]

        # Process image deletion first - outside the main session to allow for new transactions
        deletion_results = []
        for image_id in image_ids:
            try:
                logger.info(f"Deleting image {image_id} associated with cloud connector {cloud_connector_id}")
                # Use await since delete_image is an async function
                result = await image_management.delete_image(image_id)
                deletion_results.append({"image_id": image_id, "success": result})
                logger.info(f"Image {image_id} deletion result: {result}")
            except Exception as e:
                logger.error(f"Error deleting image {image_id}: {e!s}")
                deletion_results.append({"image_id": image_id, "success": False, "error": str(e)})
                # Continue with other images rather than failing completely

        # Log the summary of image deletion results
        logger.info(f"Image deletion results: {deletion_results}")

        # Finally delete the cloud connector
        with Session(engine) as session:
            success = cloud_connector_repository.delete_cloud_connector(session, cloud_connector_id)
            if not success:
                logger.error(f"Failed to delete cloud connector {cloud_connector_id} from database")
                return False

            session.commit()
            logger.info(f"Cloud connector {cloud_connector_id} successfully deleted")

        return True

    except Exception as e:
        logger.error(f"Error deleting cloud connector {cloud_connector_id}: {e!s}")
        # Re-raise the exception for proper error handling at API level
        raise RuntimeError(f"Error deleting cloud connector: {e!s}") from e
