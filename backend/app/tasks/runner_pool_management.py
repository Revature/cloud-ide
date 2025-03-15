"""Runner pool management task."""

from datetime import datetime
from sqlmodel import Session, select
from app.celery_app import celery_app
from app.db.database import engine
from app.models.runner import Runner
from app.models.image import Image
from app.models.cloud_connector import CloudConnector
from sqlalchemy import func
from celery.utils.log import get_task_logger
import asyncio

logger = get_task_logger(__name__)

@celery_app.task
def manage_runner_pool():
    """
    Task that manages the runner pool for each image.

    Ensures the number of "ready" runners matches the configured runner_pool_size for each image.
    """
    logger.info("Starting runner pool management task.")

    with Session(engine) as session:
        # 1) Fetch all images and their configured runner_pool_size, along with their cloud connectors
        stmt_images = select(Image, CloudConnector).join(
            CloudConnector, Image.cloud_connector_id == CloudConnector.id
        )

        image_results = session.exec(stmt_images).all()

        for image, cloud_connector in image_results:
            # Skip images with no pool
            if image.runner_pool_size <= 0:
                continue

            # 2) Get the current number of "ready" runners for the image
            stmt_ready_runners = select(Runner).where(Runner.state == "ready", Runner.image_id == image.id)
            ready_runners = session.exec(stmt_ready_runners).all()
            ready_runners_count = len(ready_runners)

            # 3) Compare the ready runner count with the pool size
            if ready_runners_count < image.runner_pool_size:
                from app.business.runner_management import launch_runners
                # If there are fewer ready runners than required, launch new ones
                runners_to_create = image.runner_pool_size - ready_runners_count
                logger.info(f"Launching {runners_to_create} new runners for image {image.id}")
                logger.info(f"Cloud Connector: {cloud_connector} with id {cloud_connector.id}")
                try:
                    asyncio.run(launch_runners(image.identifier, runners_to_create))
                except Exception as e:
                    logger.error(f"Error launching runners for image {image.id}: {e!s}")

            elif ready_runners_count > image.runner_pool_size:
                from app.business.runner_management import shutdown_runners
                # If there are excess ready runners, terminate the extra ones
                runners_to_terminate = ready_runners_count - image.runner_pool_size
                logger.info(f"Terminating {runners_to_terminate} extra runners for image {image.id}.")

                # Get excess ready runners
                stmt_excess_runners = select(Runner).where(
                    Runner.state == "ready",
                    Runner.image_id == image.id
                ).order_by(Runner.created_on).limit(runners_to_terminate)

                excess_runners = session.exec(stmt_excess_runners).all()

                # Terminate the extra runners
                instance_ids_to_terminate = [runner.identifier for runner in excess_runners]
                try:
                    asyncio.run(shutdown_runners(instance_ids_to_terminate))
                except Exception as e:
                    logger.error(f"Error terminating runners for image {image.id}: {e!s}")

    logger.info("Runner pool management task completed.")
