"""Module for managing images, templates for runners (AWS AMI & their config)."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import Image, Runner
from app.db import image_repository, machine_repository, cloud_connector_repository, runner_repository
from app.business import runner_management, cloud_services
from app.exceptions.runner_exceptions import RunnerExecException
import logging

logger = get_task_logger(__name__)

def get_all_images() -> list[Image]:
    """Get all images."""
    with Session(engine) as session:
        return image_repository.find_all_images(session)

def get_image_by_identifier(identifier:str) -> Image:
    """Get an image by its identifier (AWS string)."""
    with Session(engine) as session:
        return image_repository.find_image_by_identifier(session, identifier)

def get_image_by_id(id:int) -> Image:
    """Get an image by its id (numeric)."""
    with Session(engine) as session:
        return image_repository.find_image_by_id(session, id)

def update_image(image_id: int, updated_image: Image) -> bool:
    """Update an existing image with new values."""
    with Session(engine) as session:
        # Get the existing image first to check if pool size will change
        existing_image = image_repository.find_image_by_id(session, image_id)
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
    3. Creates and returns a new Image record
    """
    logger = logging.getLogger(__name__)

    with Session(engine) as session:
        # Get the runner
        runner = runner_repository.find_runner_by_id(session, runner_id)
        if not runner:
            logger.error(f"Runner with id {runner_id} not found")
            raise RunnerExecException(f"Runner with id {runner_id} not found")

        # Get the cloud connector
        cloud_connector_id = image_data["cloud_connector_id"]
        cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, cloud_connector_id)
        if not cloud_connector:
            logger.error(f"Cloud connector with id {cloud_connector_id} not found")
            raise RunnerExecException(f"Cloud connector with id {cloud_connector_id} not found")

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
            image_identifier = await cloud_service.create_runner_image(
                instance_id=runner.identifier,
                image_name=image_name,
                image_tags=image_tags
            )

            if not image_identifier or image_identifier.startswith("An error occurred"):
                logger.error(f"Failed to create AMI: {image_identifier}")
                raise RunnerExecException(f"Failed to create AMI: {image_identifier}")

            # Create the Image record in the database
            new_image = Image(
                name=image_data["name"],
                description=image_data.get("description", ""),
                identifier=image_identifier,
                machine_id=image_data.get("machine_id"),
                cloud_connector_id=cloud_connector_id,
                runner_pool_size=0  # Default to 0, can be updated later
            )

            # Save the new image to the database
            db_image = image_repository.create_image(session, new_image)
            session.commit()
            logger.info(f"Image created with ID: {db_image.id}")
            return db_image

        except Exception as e:
            logger.error(f"Error creating image from runner {runner_id}: {e!s}")
            raise RunnerExecException(f"Error creating image from runner: {e!s}") from e
