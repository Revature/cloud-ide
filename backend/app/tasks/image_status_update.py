"""This module contains a Celery task to monitor the status of an image being created in AWS."""
import logging
from celery import shared_task
from sqlmodel import Session
from app.db.database import engine
from app.models import Image
from app.db import image_repository, cloud_connector_repository
from app.business import cloud_services
import asyncio

@shared_task(bind=True)
def update_image_status_task(self, image_id: int, image_identifier: str, cloud_connector_id: int):
    """
    Background task to check if an AWS image is available and update its status.

    Uses the wait_for_image_available method which handles retries internally.

    Args:
        image_id: The database ID of the image
        image_identifier: The AWS AMI ID
        cloud_connector_id: The ID of the cloud connector to use
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Checking status of image {image_id} (AMI: {image_identifier})")

    try:
        # Get the cloud connector
        cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
            cloud_connector_id
        )
        if not cloud_connector:
            logger.error(f"Cloud connector with id {cloud_connector_id} not found")
            return

        # Check if the image exists and is still in "creating" status
        db_image = image_repository.find_image_by_id(image_id)
        if not db_image:
            logger.error(f"Image with id {image_id} not found")
            return

        if db_image.status != "creating":
            logger.info(f"Image {image_id} is no longer in 'creating' status (current: {db_image.status})")
            return

        # Get the cloud service
        cloud_service = cloud_services.cloud_service_factory.get_cloud_service(cloud_connector)

        try:
            # Create a new event loop for this task
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # The wait_for_image_available method now handles retries internally
            # No need for Celery to retry, as the method will retry up to 5 times
            image_available = loop.run_until_complete(
                cloud_service.wait_for_image_available(image_identifier)
            )
            loop.close()

            # If we get here, the image is available, so update the status
            with Session(engine) as session:
                db_image = image_repository.find_image_by_id(image_id)
                if db_image and db_image.status == "creating":
                    db_image.status = "active"
                    session.add(db_image)
                    session.commit()
                    logger.info(f"Image {image_id} (AMI: {image_identifier}) is now active")
                else:
                    logger.warning(f"Image {image_id} not found or not in 'creating' status")

        except Exception as e:
            # If the wait_for_image_available method failed after its internal retries,
            # update the image status to failed
            logger.error(f"Error waiting for image {image_identifier} to become available after retries: {e!s}")

            with Session(engine) as session:
                db_image = image_repository.find_image_by_id(image_id)
                if db_image and db_image.status == "creating":
                    db_image.status = "failed"
                    session.add(db_image)
                    session.commit()
                    logger.error(f"Marked image {image_id} as failed after multiple retries")

    except Exception as e:
        logger.error(f"Unexpected error in update_image_status_task: {e!s}")

        # For unexpected errors, update the image status to failed
        try:
            with Session(engine) as session:
                db_image = image_repository.find_image_by_id(image_id)
                if db_image and db_image.status == "creating":
                    db_image.status = "failed"
                    session.add(db_image)
                    session.commit()
                    logger.error(f"Marked image {image_id} as failed due to unexpected error")
        except Exception as inner_e:
            logger.error(f"Error updating image status to failed: {inner_e!s}")
