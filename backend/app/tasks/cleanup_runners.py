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
    now = datetime.utcnow()

    # Identifier for this specific cleanup run
    cleanup_run_id = f"cleanup_job_{now.strftime('%Y%m%d_%H%M%S')}"

    logger.info(f"[{cleanup_run_id}] Starting cleanup of active runners whose session_end has passed")

    with Session(engine) as session:
        # Query all runners that are active and whose session_end is in the past
        results = session.exec(
            select(Runner).where(
                ~Runner.state.in_(["terminated", "ready", "closed"]),
                Runner.session_end < now
            )
        ).all()

        # Log summary of found expired runners
        logger.info(f"[{cleanup_run_id}] Found {len(results)} expired runners to terminate")

        count_success = 0
        count_error = 0

        for runner in results:
            logger.info(f"[{cleanup_run_id}] Processing expired runner {runner.id} (instance {runner.identifier})")

            try:
                # Get the image and cloud connector
                image = session.get(Image, runner.image_id)
                if not image:
                    logger.error(f"[{cleanup_run_id}] Image not found for runner {runner.id}")
                    count_error += 1
                    continue

                cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
                if not cloud_connector:
                    logger.error(f"[{cleanup_run_id}] Cloud connector not found for image {image.id}")
                    count_error += 1
                    continue

                # Add a specific history record for this runner before termination to show it was expired
                expiry_record = RunnerHistory(
                    runner_id=runner.id,
                    event_name="runner_expired",
                    event_data={
                        "timestamp": now.isoformat(),
                        "session_end": runner.session_end.isoformat() if runner.session_end else None,
                        "current_state": runner.state,
                        "cleanup_job_id": cleanup_run_id,
                        "minutes_expired": round((now - runner.session_end).total_seconds() / 60, 2) if runner.session_end else None
                    },
                    created_by=cleanup_run_id,
                    modified_by=cleanup_run_id
                )
                session.add(expiry_record)
                session.commit()

                # Call the terminate_runner function with the cleanup job identifier
                from app.business.runner_management import terminate_runner

                # Use asyncio.run to execute the async terminate_runner function
                # Pass the cleanup job ID as the initiator
                result = asyncio.run(terminate_runner(runner.id, initiated_by=cleanup_run_id))

                if result["status"] == "success":
                    logger.info(f"[{cleanup_run_id}] Successfully terminated runner {runner.id}")
                    count_success += 1
                else:
                    logger.error(f"[{cleanup_run_id}] Failed to terminate runner {runner.id}: {result['message']}")
                    count_error += 1

            except Exception as e:
                logger.error(f"[{cleanup_run_id}] Error processing runner {runner.id}: {e!s}")
                count_error += 1

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
                        "error": str(e),
                        "cleanup_job_id": cleanup_run_id
                    }
                    history_record = RunnerHistory(
                        runner_id=runner.id,
                        event_name="runner_cleanup_error",
                        event_data=event_data,
                        created_by=cleanup_run_id,
                        modified_by=cleanup_run_id
                    )
                    session.add(history_record)
                    session.commit()
                except Exception as inner_e:
                    logger.error(f"[{cleanup_run_id}] Error updating runner {runner.id} state: {inner_e!s}")

    # Log the final summary instead of creating a system-level record
    duration_seconds = (datetime.utcnow() - now).total_seconds()
    logger.info(f"[{cleanup_run_id}] Cleanup complete. Successfully terminated: {count_success}, Errors: {count_error}, "
                f"Duration: {duration_seconds:.2f} seconds")

    # Return a summary dictionary for Celery task results
    return {
        "cleanup_job_id": cleanup_run_id,
        "found_expired": len(results),
        "successful_terminations": count_success,
        "failed_terminations": count_error,
        "duration_seconds": duration_seconds
    }
