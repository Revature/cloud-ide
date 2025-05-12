"""Module for managing images, templates for runners (AWS AMI & their config)."""

import asyncio
import logging
from celery.utils.log import get_task_logger
from sqlmodel import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
from app.db.database import engine
from app.models import Image, Runner
from app.db import image_repository, machine_repository, cloud_connector_repository, runner_repository, runner_history_repository
from app.business import runner_management, cloud_services, security_group_management
from app.exceptions.runner_exceptions import RunnerExecException
from app.util import constants

logger = get_task_logger(__name__)

def get_all_images() -> list[Image]:
    """Get all images."""
    with Session(engine) as session:
        return image_repository.find_all_images(session)

def get_image_by_identifier(identifier: str) -> Image:
    """Get an image by its identifier (AWS string)."""
    with Session(engine) as session:
        return image_repository.find_image_by_identifier(session, identifier)

def get_image_by_id(id: int,  include_deleted: bool = False, include_inactive: bool = False) -> Image:
    """Get an image by its id (numeric)."""
    with Session(engine) as session:
        return image_repository.find_image_by_id(session, id, include_deleted, include_inactive)

def get_images_by_cloud_connector_id(cloud_connector_id: int) -> list[Image]:
    """Get all images associated with a specific cloud connector."""
    with Session(engine) as session:
        return image_repository.find_images_by_cloud_connector_id(session, cloud_connector_id)

def update_image(image_id: int, updated_image: Image) -> bool:
    """Update an existing image with new values."""
    with Session(engine) as session:
        # Get the existing image first to check if pool size will change
        existing_image = image_repository.find_image_by_id(session, image_id, include_deleted=False, include_inactive=True)
        if not existing_image:
            logger.error(f"Image with id {image_id} not found for updating")
            return False

        # Check if runner_pool_size is changing
        pool_size_changed = (
            hasattr(updated_image, "runner_pool_size") and
            existing_image.runner_pool_size != updated_image.runner_pool_size
        )

        # Get the updated image from repository
        db_image = image_repository.update_image(session, image_id, updated_image)
        session.commit()

        # If pool size changed, trigger the runner pool management task
        if pool_size_changed:
            logger.info(f"Runner pool size changed for image {image_id}. Triggering pool management task.")
            from app.tasks.runner_pool_management import manage_runner_pool
            # Queue the task to run immediately (using .delay() for async execution)
            manage_runner_pool.delay()

        return True

def update_runner_pool(image_id: int, runner_pool_size: int) -> bool:
    """Update the runner pool of an existing image."""
    # Validate the runner pool size
    if runner_pool_size > constants.max_runner_pool_size:
        logger.warning(f"Requested pool size {runner_pool_size} exceeds maximum allowed {constants.max_runner_pool_size}")
        return False

    with Session(engine) as session:
        # Get the existing image first to check if pool size will change
        existing_image = image_repository.find_image_by_id(session, image_id)
        if not existing_image:
            logger.error(f"Image with id {image_id} not found for updating")
            return False

        # Check if runner_pool_size is changing
        current_pool_size = existing_image.runner_pool_size
        pool_size_changed = current_pool_size != runner_pool_size

        # Apply the new pool size
        existing_image.runner_pool_size = runner_pool_size

        # Get the updated image from repository
        db_image = image_repository.update_image(session, image_id, existing_image)
        session.commit()

        # If pool size changed, trigger the runner pool management task
        if pool_size_changed:
            logger.info(f"Runner pool size changed for image {image_id} from {current_pool_size} to {runner_pool_size}.")
            from app.tasks.runner_pool_management import manage_runner_pool
            # Queue the task to run immediately (using .delay() for async execution)
            manage_runner_pool.delay()

        return True

async def update_image_status(image_id: int, is_active: bool) -> Optional[Image]:
    """
    Update the status of an image to active or inactive.

    Args:
        image_id: The ID of the image to update
        is_active: The new status to set (True for active, False for inactive)

    Returns:
        Updated Image object or None if not found

    Raises:
        RuntimeError: If there's an error updating the image status
    """
    logger = logging.getLogger(__name__)

    try:
        with Session(engine) as session:
            # Get the image using find_image_by_id which excludes deleted images
            # but can retrieve inactive ones
            image = image_repository.find_image_by_id(
                session,
                image_id,
                include_deleted=False,  # Don't include deleted images
                include_inactive=True   # Do include inactive images
            )

            if not image:
                logger.warning(f"Image with ID {image_id} not found or is deleted")
                return None

            # Determine the new status
            new_status = "active" if is_active else "inactive"

            # Update the image status
            updated_image = image_repository.update_image_status(session, image.id, new_status)

            # Commit changes
            session.commit()
            return updated_image

    except Exception as e:
        logger.error(f"Error updating image status for image {image_id}: {e!s}")
        raise RuntimeError(f"Error updating image status: {e!s}") from e

def get_image_config(image_id: int, initiated_by: str = "default") -> dict:
    """Get all the config necessary for cloud manipulation on an image. TODO: Refactor to use sql joins."""
    # Open one DB session for reading resources.
    results:dict = {}
    with Session(engine) as session:
        # 1) Fetch the Image.
        db_image : Image = image_repository.find_image_by_id(session, image_id)
        if not db_image:
            logger.error(f"[{initiated_by}] Image with id not found: {image_id}")
            raise RunnerExecException("Image not found")
        results["image"]=db_image

        # 2) Fetch the Machine associated with the image.
        if db_image.machine_id is None:
            logger.error(f"[{initiated_by}] No machine associated with image {db_image.id}")
            raise RunnerExecException("No machine associated with the image")

        db_machine = machine_repository.find_machine_by_id(session, db_image.machine_id)
        if not db_machine:
            logger.error(f"[{initiated_by}] Machine not found: {db_image.machine_id}")
            raise RunnerExecException("Machine not found")
        results["machine"]=db_machine

        # 3) Get the cloud connector
        db_cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, db_image.cloud_connector_id)
        if not db_cloud_connector:
            logger.error(f"[{initiated_by}] Cloud connector not found: {db_image.cloud_connector_id}")
            raise RunnerExecException("Cloud connector not found")
        results["cloud_connector"]=db_cloud_connector

        # 4) Get the appropriate cloud service
        cloud_service = cloud_services.cloud_service_factory.get_cloud_service(db_cloud_connector)
        results["cloud_service"] = cloud_service
        return results

async def create_image(image_data: dict, runner_id: int) -> Image:
    """
    Create a new Image record from a runner instance.

    This function:
    1. Gets the runner information
    2. Uses the appropriate cloud service to create an AMI
    3. Creates a new Image record with status 'creating'
    4. Schedules a background task to monitor the image creation and update status

    Returns:
        Image: The newly created image record with initial status of 'creating'
    """
    logger = logging.getLogger(__name__)

    with Session(engine) as session:
        # Get the runner
        print(f"Runner ID: {runner_id}")
        runner = runner_repository.find_runner_by_id(session, runner_id)
        if not runner:
            print(f"Runner not found with ID: {runner_id}")
            logger.error(f"Runner with id {runner_id} not found")
            raise RunnerExecException(f"Runner with id {runner_id} not found")
        print(f"Runner: {runner}")

        # Get the cloud connector
        cloud_connector_id = image_data["cloud_connector_id"]
        print(f"Cloud Connector ID: {cloud_connector_id}")
        cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, cloud_connector_id)
        if not cloud_connector:
            print(f"Cloud Connector not found with ID: {cloud_connector_id}")
            logger.error(f"Cloud connector with id {cloud_connector_id} not found")
            raise RunnerExecException(f"Cloud connector with id {cloud_connector_id} not found")
        print(f"Cloud Connector: {cloud_connector}")

        # Get the cloud service for the connector
        cloud_service = cloud_services.cloud_service_factory.get_cloud_service(cloud_connector)

        image_name = image_data["name"]

        # Create tags for the image
        image_tags = [
            {'Key': 'Name', 'Value': image_name},
            {'Key': 'Description', 'Value': image_data.get('description', '')},
            {'Key': 'SourceRunnerId', 'Value': str(runner_id)}
        ]

        # Create the AMI from the runner instance
        try:
            print(f"Creating AMI from runner {runner_id} with tags: {image_tags}")
            image_identifier = await cloud_service.create_runner_image(
                instance_id=runner.identifier,
                image_name=image_name,
                image_tags=image_tags
            )
            print(f"Image Identifier: {image_identifier}")

            if not image_identifier or image_identifier.startswith("An error occurred"):
                print(f"Failed to create AMI: {image_identifier}")
                logger.error(f"Failed to create AMI: {image_identifier}")
                raise RunnerExecException(f"Failed to create AMI: {image_identifier}")

            # Create the Image record in the database with status 'creating'
            new_image = Image(
                name=image_data["name"],
                description=image_data.get("description", ""),
                identifier=image_identifier,
                machine_id=image_data.get("machine_id"),
                cloud_connector_id=cloud_connector_id,
                runner_pool_size=0,
                status="creating"  # Set initial status to 'creating'
            )

            # Save the new image to the database
            db_image = image_repository.create_image(session, new_image)
            session.commit()

            logger.info(f"Image created with ID: {db_image.id}, status: creating")

            # Schedule a background task to monitor the image creation and update status
            # Use Celery for this to allow the API to return immediately
            from app.tasks.image_status_update import update_image_status_task
            update_image_status_task.delay(db_image.id, image_identifier, cloud_connector_id)

            return db_image

        except Exception as e:
            logger.error(f"Error creating image from runner {runner_id}: {e!s}")
            raise RunnerExecException(f"Error creating image from runner: {e!s}") from e

async def delete_image(image_id: int) -> bool:
    """
    Mark an image as deleted by its ID.

    This function:
    1. Finds the image in the database
    2. Terminates all runners associated with this image using proper runner management methods
    3. Cleans up security groups using security_group_management
    4. Uses the appropriate cloud service to deregister the AMI
    5. Updates the image status to "deleted" without removing it from the database

    Returns:
        bool: True if the image was successfully marked as deleted

    Raises:
        RunnerExecException: If the image cannot be found or deregistered
    """
    logger = logging.getLogger(__name__)

    with Session(engine) as session:
        # Get the image
        db_image = image_repository.find_image_by_id(session, image_id, include_deleted=False, include_inactive=True)
        if not db_image:
            logger.error(f"Image with id {image_id} not found")
            raise RunnerExecException(f"Image with id {image_id} not found")

        # Get the cloud connector
        cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, db_image.cloud_connector_id)
        if not cloud_connector:
            logger.error(f"Cloud connector with id {db_image.cloud_connector_id} not found")
            raise RunnerExecException(f"Cloud connector with id {db_image.cloud_connector_id} not found")

        # Get all runners associated with this image
        runners = runner_repository.find_runners_by_image_id(session, image_id)
        logger.info(f"Found {len(runners)} runners associated with image {image_id}")

        # Store instance IDs and runner IDs for termination
        instance_ids_to_terminate = []
        runner_ids = []
        for runner in runners:
            runner_ids.append(runner.id)
            if runner.state not in ["terminated", "closed"]:
                instance_ids_to_terminate.append(runner.identifier)

    # Get the cloud service for cloud operations
    cloud_service = cloud_services.cloud_service_factory.get_cloud_service(cloud_connector)

    # Terminate all running instances using runner management functions
    if instance_ids_to_terminate:
        logger.info(f"Terminating {len(instance_ids_to_terminate)} instances for image {image_id}")
        try:
            # Use the shutdown_runners function from runner management
            termination_results = await runner_management.shutdown_runners(
                instance_ids_to_terminate,
                initiated_by="image_deletion"
            )
            logger.info(f"Instance termination results: {termination_results}")

            # Wait a bit for termination to process
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Error terminating instances: {e!s}")
            # Continue with AMI deregistration even if some instances fail to terminate

    # Clean up security groups for all runners
    security_group_cleanup_results = []
    for runner_id in runner_ids:
        try:
            logger.info(f"Cleaning up security groups for runner {runner_id}")
            result = await security_group_management.handle_runner_termination(runner_id, cloud_service)
            security_group_cleanup_results.append({"runner_id": runner_id, "success": result})
            logger.info(f"Security group cleanup for runner {runner_id}: {result}")
        except Exception as e:
            logger.error(f"Error cleaning up security groups for runner {runner_id}: {e!s}")
            security_group_cleanup_results.append({"runner_id": runner_id, "success": False, "error": str(e)})

    # Deregister the AMI using the cloud service
    try:
        deregister_response = await cloud_service.deregister_runner_image(db_image.identifier)

        # Check if the response is a status code string (success case)
        if str(deregister_response) == "200":
            logger.info(f"Successfully deregistered AMI for image {image_id}")

            # Update the image status to "deleted" using the repository function
            with Session(engine) as image_session:
                result = image_repository.delete_image(image_session, image_id)
                if result:
                    logger.info(f"Image with ID {image_id} marked as deleted successfully")
                else:
                    logger.error(f"Image with ID {image_id} not found when trying to mark as deleted")
                    raise RunnerExecException(f"Image with ID {image_id} not found when trying to mark as deleted")

            return True
        else:
            # Handle error case - the response contains an error message
            logger.error(f"Failed to deregister AMI: {deregister_response}")
            raise RunnerExecException(f"Failed to deregister AMI: {deregister_response}")
    except Exception as e:
        logger.error(f"Error marking image {image_id} as deleted: {e!s}")
        raise RunnerExecException(f"Error marking image as deleted: {e!s}") from e
