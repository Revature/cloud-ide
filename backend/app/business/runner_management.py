"""Module for managing runners (EC2 instances) for running scripts."""

import uuid
import asyncio
from datetime import datetime, timedelta
from app.models.key import Key
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from app.db.database import engine
from app.models import Machine, Image, Runner, CloudConnector
from app.business.cloud_services.factory import get_cloud_service
from app.tasks.starting_runner import update_runner_state
from app.business.key_management import get_daily_key
from app.db import image_repository, cloud_connector_repository, machine_repository, runner_repository
from app.models.runner_history import RunnerHistory

logger = get_task_logger(__name__)

async def launch_runners(image_identifier: str, runner_count: int, initiated_by: str = "system"):
    """
    Launch instances concurrently and create Runner records.

    Args:
        image_identifier: The identifier of the image to launch
        runner_count: Number of runners to launch
        initiated_by: Identifier of the service/job that initiated the launch
                     (e.g., "pool_manager", "api_request", "admin_action")

    Each new runner is associated with today's key.
    Returns a list of launched instance IDs.
    """
    launched_instance_ids = []
    launch_start_time = datetime.utcnow()

    # Open one DB session for reading resources.
    with Session(engine) as session:
        # 1) Fetch the Image.
        db_image : Image = image_repository.find_image_by_identifier(session, image_identifier)
        if not db_image:
            logger.error(f"[{initiated_by}] Image not found: {image_identifier}")
            raise Exception("Image not found")

        # 2) Fetch the Machine associated with the image.
        if db_image.machine_id is None:
            logger.error(f"[{initiated_by}] No machine associated with image {db_image.id}")
            raise Exception("No machine associated with the image")

        db_machine = machine_repository.find_machine_by_id(session, db_image.machine_id)
        if not db_machine:
            logger.error(f"[{initiated_by}] Machine not found: {db_image.machine_id}")
            raise Exception("Machine not found")

        # 3) Get the cloud connector
        db_cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, db_image.cloud_connector_id)
        if not db_cloud_connector:
            logger.error(f"[{initiated_by}] Cloud connector not found: {db_image.cloud_connector_id}")
            raise Exception("Cloud connector not found")

        # 4) Get the appropriate cloud service
        cloud_service = get_cloud_service(db_cloud_connector)
        logger.info(f"[{initiated_by}] Launching {runner_count} runners for image {image_identifier} on machine {db_machine.identifier}.")

    # 5) Get or create today's key.
    try:
        key_record = await get_daily_key(cloud_connector_id=db_cloud_connector.id)
        if key_record is None:
            logger.error(f"[{initiated_by}] Key not found or created for cloud connector {cloud_connector.id}")
            raise Exception("Key not found or created")
    except Exception as e:
        logger.error(f"[{initiated_by}] Error getting or creating key: {e!s}")
        raise

    # 6) Launch all instances concurrently using the appropriate cloud service.
    try:
        launch_tasks = [
            cloud_service.create_instance(
                key_name=key_record.key_name,
                image_id=db_image.identifier,
                instance_type=db_machine.identifier,
                instance_count=1
            )
            for _ in range(runner_count)
        ]
        instance_ids = await asyncio.gather(*launch_tasks)
        launched_instance_ids.extend(instance_ids)

        logger.info(f"[{initiated_by}] Successfully launched {len(launched_instance_ids)} instances: {launched_instance_ids}")
    except Exception as e:
        # TODO: Refactor to handle a case where only one instance fails to launch, as opposed to
        # all-or-nothing
        logger.error(f"[{initiated_by}] Error launching instances: {e!s}")
        raise

    # 7) Create Runner records (URL will be updated later by a background job).
    created_runner_ids = []
    for instance_id in instance_ids:
        new_runner : Runner = launch_runner(db_machine, db_image, key_record, instance_id, initiated_by)
        created_runner_ids.append(new_runner.id)

    # Log summary information instead of creating a system-level history record
    duration_seconds = (datetime.utcnow() - launch_start_time).total_seconds()
    logger.info(f"[{initiated_by}] Launch summary: Requested: {runner_count}, Launched: {len(launched_instance_ids)}, "
                f"Duration: {duration_seconds:.2f}s, Runner IDs: {created_runner_ids}")

    return launched_instance_ids

def launch_runner(machine:Machine, image:Image, key:Key, instance_id:str, initiated_by: str)->Runner:
    """Launch a single runner and produce a record for it."""
    with Session(engine) as session:
        new_runner = Runner(
            machine_id=machine.id,
            image_id=image.id,
            user_id=None,           # No user assigned yet.
            key_id=key.id,     # Associate the runner with today's key.
            state="runner_starting",  # State will update once instance is running.
            url="",                 # Empty URL; background task will update it.
            token="",
            identifier=instance_id,
            external_hash=uuid.uuid4().hex,
            session_start=datetime.utcnow(),
            session_end=datetime.utcnow() + timedelta(minutes=10)
        )

        new_runner = runner_repository.add_runner(session, new_runner)

        # Create a history record for the new runner
        runner_creation_record = RunnerHistory(
            runner_id=new_runner.id,
            event_name="runner_created",
            event_data={
                "timestamp": datetime.utcnow().isoformat(),
                "image_id": image.id,
                "machine_id": machine.id,
                "instance_id": instance_id,
                "state": "runner_starting",
                "initiated_by": initiated_by
            },
            created_by="system",
            modified_by="system"
        )
        session.add(runner_creation_record)
        session.commit()
        # Queue a Celery task to update runner state when instance is ready.
        update_runner_state.delay(new_runner.id, instance_id)
        return new_runner

# Modify terminate_runner in app/business/runner_management.py
async def terminate_runner(runner_id: int, initiated_by: str = "system") -> dict:
    """
    Terminate a specific runner by ID.

    Args:
        runner_id: The ID of the runner to terminate
        initiated_by: Identifier of the service/job that initiated the termination
                     (e.g., "cleanup_job", "user_request", "admin_action")

    Returns a dictionary with the result of the termination process.
    """
    from app.models.runner_history import RunnerHistory

    with Session(engine) as session:
        runner = session.get(Runner, runner_id)
        if not runner:
            logger.error(f"[{initiated_by}] Runner with ID {runner_id} not found for termination")
            return {
                "status": "error",
                "message": f"Runner with ID {runner_id} not found",
                "initiated_by": initiated_by
            }

        if runner.state in ("terminated", "closed"):
            logger.info(f"[{initiated_by}] Runner with ID {runner_id} is already terminated or closed")
            return {
                "status": "error",
                "message": f"Runner with ID {runner_id} is already terminated or closed",
                "initiated_by": initiated_by
            }

        # Record termination initiation in runner history
        termination_request = RunnerHistory(
            runner_id=runner_id,
            event_name="termination_requested",
            event_data={
                "timestamp": datetime.utcnow().isoformat(),
                "initiated_by": initiated_by,
                "runner_state": runner.state,
                "session_info": {
                    "session_start": runner.session_start.isoformat() if runner.session_start else None,
                    "session_end": runner.session_end.isoformat() if runner.session_end else None,
                    "is_expired": runner.session_end < datetime.utcnow() if runner.session_end else False
                }
            },
            created_by="system",
            modified_by="system"
        )
        session.add(termination_request)
        session.commit()

        # Get the instance ID for shutdown_runners
        instance_id = runner.identifier

    logger.info(f"[{initiated_by}] Initiating termination for runner {runner_id} (instance {instance_id})")

    # Pass the initiated_by to the shutdown_runners function
    results = await shutdown_runners([instance_id], initiated_by)

    # Return the result for this specific runner
    if results and results[0]["status"] == "success":
        logger.info(f"[{initiated_by}] Successfully terminated runner {runner_id}")
        return {"status": "success", "message": "Runner terminated successfully", "details": results[0], "initiated_by": initiated_by}
    else:
        logger.error(f"[{initiated_by}] Failed to terminate runner {runner_id}")
        return {"status": "error", "message": "Failed to terminate runner", "details": results[0] if results else None, "initiated_by": initiated_by}

async def shutdown_runners(launched_instance_ids: list, initiated_by: str = "system"):
    """
    Stop and then terminate all instances given in launched_instance_ids.

    Args:
        launched_instance_ids: List of instance IDs to terminate
        initiated_by: Identifier of the service/job that initiated the termination

    Executes on_terminate scripts, then updates the corresponding Runner record
    to "closed" after stopping and to "terminated" after termination.
    Creates detailed history records for each step.
    """
    from app.business.script_management import run_script_for_runner  # Import here to avoid circular imports
    from app.models.runner_history import RunnerHistory
    import traceback

    results = []
    for instance_id in launched_instance_ids:
        result = {"instance_id": instance_id, "status": "success", "details": [], "initiated_by": initiated_by}

        # Find the runner first
        with Session(engine) as session:
            stmt = select(Runner).where(Runner.identifier == instance_id)
            runner = session.exec(stmt).first()

            if not runner:
                message = f"Runner with instance identifier {instance_id} not found."
                logger.error(f"[{initiated_by}] {message}")
                result["status"] = "error"
                result["details"].append({"step": "find_runner", "status": "error", "message": message})
                results.append(result)
                continue

            # Get the cloud connector and service
            image = session.get(Image, runner.image_id)
            if not image:
                message = f"Image for runner {runner.id} not found."
                logger.error(f"[{initiated_by}] {message}")
                result["status"] = "error"
                result["details"].append({"step": "find_image", "status": "error", "message": message})
                results.append(result)
                continue

            cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
            if not cloud_connector:
                message = f"Cloud connector for image {image.id} not found."
                logger.error(f"[{initiated_by}] {message}")
                result["status"] = "error"
                result["details"].append({"step": "find_cloud_connector", "status": "error", "message": message})
                results.append(result)
                continue

            # Get the cloud service
            cloud_service = get_cloud_service(cloud_connector)

            # Update runner state to "terminating" before running scripts
            old_state = runner.state
            runner.state = "terminating"
            session.add(runner)

            # Create history record for state change
            terminating_history = RunnerHistory(
                runner_id=runner.id,
                event_name="runner_terminating",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "old_state": old_state,
                    "new_state": "terminating",
                    "initiated_by": initiated_by
                },
                created_by="system",
                modified_by="system"
            )
            session.add(terminating_history)
            session.commit()

            result["runner_id"] = runner.id
            result["details"].append({"step": "update_state", "status": "success", "message": "Updated state to terminating"})

            logger.info(f"[{initiated_by}] Runner {runner.id} state updated from {old_state} to terminating")

            try:
                logger.info(f"[{initiated_by}] Running on_terminate script for runner {runner.id}...")
                # Run the script with empty env_vars since credentials should be retrieved from the environment
                script_result = await run_script_for_runner("on_terminate", runner.id, env_vars={}, initiated_by=initiated_by)
                
                logger.info(f"[{initiated_by}] Script executed for runner {runner.id}")
                logger.info(f"[{initiated_by}] Script result: {script_result}")

                result["details"].append({"step": "script_execution", "status": "success", "message": "on_terminate script executed"})
            except Exception as e:
                error_detail = str(e)
                logger.error(f"[{initiated_by}] Error executing on_terminate script for runner {runner.id}: {error_detail}")

                # Format traceback as string
                tb_string = "".join(traceback.format_tb(e.__traceback__)) if hasattr(e, "__traceback__") else ""
                
                # Create detailed history record for the script error
                error_history = RunnerHistory(
                    runner_id=runner.id,
                    event_name="script_error_on_terminate",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "error": error_detail,
                        "traceback": tb_string,
                        "initiated_by": initiated_by
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(error_history)
                session.commit()

                # Add error information to result details
                result["details"].append({
                    "step": "script_execution", 
                    "status": "error", 
                    "message": f"Error executing on_terminate script: {error_detail}"
                })

                # Continue with termination despite script error
                logger.info(f"[{initiated_by}] Continuing with termination despite script error")

        # Stop instance and update history
        try:
            logger.info(f"[{initiated_by}] Stopping instance {instance_id} for runner {runner.id}")
            stop_state = await cloud_service.stop_instance(instance_id)

            # After stopping, update the runner state to "closed".
            with Session(engine) as session:
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()
                if runner:
                    runner.state = "closed"
                    runner.ended_on = datetime.utcnow()
                    session.add(runner)

                    # Create history record for stopping the instance
                    stopping_history = RunnerHistory(
                        runner_id=runner.id,
                        event_name="runner_closed",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "old_state": "terminating",
                            "new_state": "closed",
                            "stop_result": stop_state,
                            "initiated_by": initiated_by
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(stopping_history)
                    session.commit()

                    logger.info(f"[{initiated_by}] Runner {runner.id} updated to 'closed'")
                    result["details"].append({"step": "stop_instance", "status": "success", "message": "Instance stopped"})
                else:
                    message = f"Runner with instance identifier {instance_id} not found (stop update)."
                    logger.error(f"[{initiated_by}] {message}")
                    result["details"].append({"step": "stop_instance", "status": "error", "message": message})
        except Exception as e:
            error_message = f"Error stopping instance {instance_id}: {e!s}"
            logger.error(f"[{initiated_by}] {error_message}")
            result["details"].append({"step": "stop_instance", "status": "error", "message": error_message})

        # Terminate instance and update history
        try:
            logger.info(f"[{initiated_by}] Terminating instance {instance_id} for runner {runner.id}")
            terminate_state = await cloud_service.terminate_instance(instance_id)

            # After termination, update the runner state to "terminated".
            with Session(engine) as session:
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()
                if runner:
                    runner.state = "terminated"
                    session.add(runner)

                    # Create history record for terminating the instance
                    termination_history = RunnerHistory(
                        runner_id=runner.id,
                        event_name="runner_terminated",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "old_state": "closed",
                            "new_state": "terminated",
                            "terminate_result": terminate_state,
                            "initiated_by": initiated_by
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(termination_history)
                    session.commit()

                    logger.info(f"[{initiated_by}] Runner {runner.id} updated to 'terminated'")
                    result["details"].append({"step": "terminate_instance", "status": "success", "message": "Instance terminated"})
                else:
                    message = f"Runner with instance identifier {instance_id} not found (terminate update)."
                    logger.error(f"[{initiated_by}] {message}")
                    result["details"].append({"step": "terminate_instance", "status": "error", "message": message})
        except Exception as e:
            error_message = f"Error terminating instance {instance_id}: {e!s}"
            logger.error(f"[{initiated_by}] {error_message}")
            result["details"].append({"step": "terminate_instance", "status": "error", "message": error_message})

        results.append(result)

    return results

async def shutdown_all_runners():
    """
    Stop and then terminate all instances for runners that are not in the 'terminated' state.

    Uses the shutdown_runners function.
    """
    initiated_by = "shutdown_all_runners"
    logger.info(f"[{initiated_by}] Starting shutdown of all active runners")

    with Session(engine) as session:
        stmt = select(Runner).where(Runner.state != "terminated")
        runners_to_shutdown = session.exec(stmt).all()
        instance_ids = [runner.identifier for runner in runners_to_shutdown]

    if instance_ids:
        logger.info(f"[{initiated_by}] Found {len(instance_ids)} runners to terminate")
        results = await shutdown_runners(instance_ids, initiated_by)
        logger.info(f"[{initiated_by}] Completed shutdown of all active runners")
        return results
    else:
        logger.info(f"[{initiated_by}] No active runners found to terminate")
        return []
