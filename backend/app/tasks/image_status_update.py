"""This module contains a Celery task to monitor the status of an image being created in AWS."""
import logging
from celery import shared_task
from sqlmodel import Session
from app.db.database import engine
from app.models import Image
from app.db import image_repository, cloud_connector_repository
from app.business import cloud_services
import asyncio

@shared_task(bind=True, max_retries=None)
def update_image_status_task(self, image_id: int, image_identifier: str, cloud_connector_id: int):
    """
    Background task to check if an AWS image is available and update its status.

    Args:
        image_id: The database ID of the image
        image_identifier: The AWS AMI ID
        cloud_connector_id: The ID of the cloud connector to use
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Checking status of image {image_id} (AMI: {image_identifier})")

    try:
        # Get the cloud connector
        with Session(engine) as session:
            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                session, cloud_connector_id
            )
            if not cloud_connector:
                logger.error(f"Cloud connector with id {cloud_connector_id} not found")
                return

        # Get the cloud service
        cloud_service = cloud_services.cloud_service_factory.get_cloud_service(cloud_connector)

        # Check if image is available - this is synchronous in boto3
        try:
            # Use the boto3 client directly without asyncio
            # The waiter handles all the polling internally
            ec2_client = cloud_service.ec2_client
            waiter = ec2_client.get_waiter('image_available')
            waiter.wait(ImageIds=[image_identifier])

            # If we get here, the image is available, so update the status
            with Session(engine) as session:
                db_image = image_repository.find_image_by_id(session, image_id)
                if db_image and db_image.status == "creating":
                    db_image.status = "active"
                    session.add(db_image)
                    session.commit()
                    logger.info(f"Image {image_id} (AMI: {image_identifier}) is now active")
                else:
                    logger.warning(f"Image {image_id} not found or not in 'creating' status")

        except Exception as e:
            logger.error(f"Error waiting for image {image_identifier} to become available: {e!s}")
            # Retry after delay
            self.retry(countdown=60, exc=e)

    except Exception as e:
        logger.error(f"Unexpected error in update_image_status_task: {e!s}")
        self.retry(countdown=60, exc=e)
