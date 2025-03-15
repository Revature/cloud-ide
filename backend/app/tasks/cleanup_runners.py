# app/tasks/cleanup_runners.py
"""Cleanup task for active runners whose session_end has passed."""

from datetime import datetime
from sqlmodel import Session, select
from celery.utils.log import get_task_logger
from app.celery_app import celery_app
from app.db.database import engine
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.models.image import Image
from app.models.cloud_connector import CloudConnector
from app.business.cloud_services.factory import get_cloud_service
from sqlalchemy import not_
import asyncio

logger = get_task_logger(__name__)

@celery_app.task
def cleanup_active_runners():
    """Task to cleanup active runners whose session_end has passed."""
    logger.info("Starting cleanup of active runners whose session_end has passed.")
    now = datetime.utcnow()

    with Session(engine) as session:
        # Query all runners that are active and whose session_end is in the past
        results = session.exec(
            select(Runner).where(
                ~Runner.state.in_(["terminated", "ready", "closed"]),
                Runner.session_end < now
            )
        ).all()

        count = 0
        for runner in results:
            logger.info(f"Processing expired runner {runner.id} (instance {runner.identifier})")

            try:
                # Get the image and cloud connector
                image = session.get(Image, runner.image_id)
                if not image:
                    logger.error(f"Image not found for runner {runner.id}")
                    continue

                cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
                if not cloud_connector:
                    logger.error(f"Cloud connector not found for image {image.id}")
                    continue

                # Get the cloud service
                cloud_service = get_cloud_service(cloud_connector)

                # Call the terminate_runner function (uses the on_terminate script)
                from app.business.runner_management import terminate_runner

                # Use asyncio.run to execute the async terminate_runner function
                result = asyncio.run(terminate_runner(runner.id))

                if result["status"] == "success":
                    logger.info(f"Successfully terminated runner {runner.id}")
                    count += 1
                else:
                    logger.error(f"Failed to terminate runner {runner.id}: {result['message']}")

            except Exception as e:
                logger.error(f"Error processing runner {runner.id}: {e!s}")

                # Try to update the runner state anyway to prevent retrying forever
                try:
                    runner.state = "error"
                    runner.ended_on = now
                    session.add(runner)

                    # Create a runner history record for the error
                    event_data = {
                        "previous_state": runner.state,
                        "new_state": "error",
                        "error_time": now.isoformat(),
                        "error": str(e)
                    }
                    history_record = RunnerHistory(
                        runner_id=runner.id,
                        event_name="runner_cleanup_error",
                        event_data=event_data,
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(history_record)
                    session.commit()
                except Exception as inner_e:
                    logger.error(f"Error updating runner {runner.id} state: {inner_e!s}")

    logger.info(f"Cleanup complete. Processed {count} runners.")
