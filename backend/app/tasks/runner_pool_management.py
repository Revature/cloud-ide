"""Runner pool management task."""

from datetime import datetime
from sqlmodel import Session, select
from app.celery_app import celery_app
from app.db.database import engine
from app.models.runner import Runner
from app.models.image import Image
from app.models.cloud_connector import CloudConnector
from app.models.runner_history import RunnerHistory
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
    now = datetime.utcnow()

    # Create a unique identifier for this pool management run
    pool_run_id = f"pool_manager_{now.strftime('%Y%m%d_%H%M%S')}"

    logger.info(f"[{pool_run_id}] Starting runner pool management task")

    # Stats for summary
    stats = {
        "timestamp": now.isoformat(),
        "job_id": pool_run_id,
        "images_processed": 0,
        "runners_launched": 0,
        "runners_terminated": 0,
        "errors": 0,
        "image_stats": []
    }

    with Session(engine) as session:
        # 1) Fetch all images and their configured runner_pool_size, along with their cloud connectors
        stmt_images = select(Image, CloudConnector).join(
            CloudConnector, Image.cloud_connector_id == CloudConnector.id
        )

        image_results = session.exec(stmt_images).all()

        for image, cloud_connector in image_results:
            image_stat = {
                "image_id": image.id,
                "image_identifier": image.identifier,
                "runner_pool_size": image.runner_pool_size,
                "ready_runners_before": 0,
                "action_taken": "none",
                "runners_created": 0,
                "runners_terminated": 0,
                "error": None
            }

            # 2) Get the current number of "ready" runners for the image
            stmt_ready_runners = select(Runner).where(Runner.state == "ready", Runner.image_id == image.id)
            stmt_runner_starting_runners = select(Runner).where(Runner.state == "runner_starting", Runner.image_id == image.id)
            stmt_closed_runners = select(Runner).where(Runner.state == "closed_pool", Runner.image_id == image.id)
            ready_runners = session.exec(stmt_ready_runners).all()
            starting_runners = session.exec(stmt_runner_starting_runners).all()
            closed_runners = session.exec(stmt_closed_runners).all()
            ready_runners_count = len(ready_runners) + len(starting_runners) + len(closed_runners)

            image_stat["ready_runners_before"] = ready_runners_count

            # 3) Compare the ready runner count with the pool size
            if ready_runners_count < image.runner_pool_size:
                from app.business.runner_management import launch_runners
                # If there are fewer ready runners than required, launch new ones
                runners_to_create = image.runner_pool_size - ready_runners_count
                logger.info(f"[{pool_run_id}] Launching {runners_to_create} new runners for image {image.id} ({image.identifier})")
                logger.info(f"[{pool_run_id}] Using cloud connector {cloud_connector.id}")

                # Log scaling decision instead of creating system-level record
                logger.info(f"[{pool_run_id}] Scaling up image {image.id}: current={ready_runners_count}, " +
                           f"target={image.runner_pool_size}, creating={runners_to_create}")

                image_stat["action_taken"] = "scale_up"
                image_stat["runners_to_create"] = runners_to_create

                try:
                    # Launch the new runners with the pool run ID as the initiator
                    instances = asyncio.run(launch_runners(image.identifier, runners_to_create, initiated_by=pool_run_id))

                    # Log success instead of creating system-level record
                    logger.info(f"[{pool_run_id}] Successfully launched {len(instances)} instances for image {image.id}")

                    stats["runners_launched"] += len(instances)
                    image_stat["runners_created"] = len(instances)

                except Exception as e:
                    logger.error(f"[{pool_run_id}] Error launching runners for image {image.id}: {e!s}")
                    stats["errors"] += 1
                    image_stat["error"] = str(e)

            elif ready_runners_count > image.runner_pool_size:
                from app.business.runner_management import shutdown_runners
                # If there are excess ready runners, terminate the extra ones
                runners_to_terminate = ready_runners_count - image.runner_pool_size
                logger.info(f"[{pool_run_id}] Terminating {runners_to_terminate} extra runners for image {image.id} ({image.identifier})")

                # Log scaling decision instead of creating system-level record
                logger.info(f"[{pool_run_id}] Scaling down image {image.id}: current={ready_runners_count}, " +
                           f"target={image.runner_pool_size}, terminating={runners_to_terminate}")

                image_stat["action_taken"] = "scale_down"
                image_stat["runners_to_terminate"] = runners_to_terminate

                # Get excess ready runners
                stmt_excess_runners = select(Runner).where(
                    Runner.state == "ready",
                    Runner.image_id == image.id
                ).order_by(Runner.created_on).limit(runners_to_terminate)

                excess_runners = session.exec(stmt_excess_runners).all()

                # Add individual runner history records for each runner being terminated
                # Keep these because they're runner-specific (not system-level)
                for runner in excess_runners:
                    logger.info(f"[{pool_run_id}] Marking runner {runner.id} for termination (excess pool capacity)")

                    pool_terminate_record = RunnerHistory(
                        runner_id=runner.id,
                        event_name="pool_terminating_runner",
                        event_data={
                            "timestamp": now.isoformat(),
                            "reason": "excess_pool_capacity",
                            "image_id": image.id,
                            "age_seconds": (now - runner.created_on).total_seconds() if runner.created_on else None,
                            "job_id": pool_run_id
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(pool_terminate_record)
                session.commit()

                # Terminate the extra runners
                instance_ids_to_terminate = [runner.identifier for runner in excess_runners]
                try:
                    # Use the pool_run_id as the initiator for the termination
                    termination_results = asyncio.run(shutdown_runners(instance_ids_to_terminate, pool_run_id))

                    # Log success instead of creating system-level record
                    logger.info(f"[{pool_run_id}] Successfully started termination for {len(instance_ids_to_terminate)}")
                    logger.info(f"[{pool_run_id}] For image {image.id}, terminated instances: {termination_results}")

                    stats["runners_terminated"] += len(instance_ids_to_terminate)
                    image_stat["runners_terminated"] = len(instance_ids_to_terminate)

                except Exception as e:
                    logger.error(f"[{pool_run_id}] Error terminating runners for image {image.id}: {e!s}")
                    stats["errors"] += 1
                    image_stat["error"] = str(e)

            stats["images_processed"] += 1
            stats["image_stats"].append(image_stat)

    # Add completion information to the stats
    stats["duration_seconds"] = (datetime.utcnow() - now).total_seconds()
    stats["completion_time"] = datetime.utcnow().isoformat()

    # Log the summary instead of creating a system record
    logger.info(f"[{pool_run_id}] Runner pool management task completed. Summary: Processed {stats['images_processed']} images, "
                f"launched {stats['runners_launched']} runners, terminated {stats['runners_terminated']} runners, "
                f"encountered {stats['errors']} errors. Duration: {stats['duration_seconds']:.2f} seconds.")

    return stats
