"""Module for managing runners (EC2 instances) for running scripts."""

import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from app.db.database import engine
from app.models import Machine, Image, Runner, CloudConnector, Script, RunnerHistory, Key, User
from app.util import constants
from app.business.cloud_services import cloud_service_factory
from app.tasks.starting_runner import update_runner_state
from app.business import image_management, jwt_creation, key_management
from app.db import cloud_connector_repository, machine_repository, runner_repository, runner_history_repository, image_repository
from app.exceptions.runner_exceptions import RunnerCreationException, RunnerRetrievalException, RunnerDefinitionException

logger = get_task_logger(__name__)

async def launch_runners(image_identifier: str, runner_count: int, initiated_by: str = "system") -> list[Runner]:
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
    launched_instances : list[Runner] = []
    launch_start_time = datetime.now(timezone.utc)

    # Open one DB session for reading resources.
    with Session(engine) as session:
        # 1) Fetch the Image.
        db_image : Image = image_repository.find_image_by_identifier(session, image_identifier)
        if not db_image:
            logger.error(f"[{initiated_by}] Image not found: {image_identifier}")
            raise RunnerDefinitionException("Image not found")

        # 2) Fetch the Machine associated with the image.
        if db_image.machine_id is None:
            logger.error(f"[{initiated_by}] No machine associated with image {db_image.id}")
            raise RunnerCreationException("No machine associated with the image")

        db_machine = machine_repository.find_machine_by_id(session, db_image.machine_id)
        if not db_machine:
            logger.error(f"[{initiated_by}] Machine not found: {db_image.machine_id}")
            raise RunnerCreationException("Machine not found")

        # 3) Get the cloud connector
        db_cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, db_image.cloud_connector_id)
        if not db_cloud_connector:
            logger.error(f"[{initiated_by}] Cloud connector not found: {db_image.cloud_connector_id}")
            raise RunnerCreationException("Cloud connector not found")

        # 4) Get the appropriate cloud service
        cloud_service = cloud_service_factory.get_cloud_service(db_cloud_connector)
        logger.info(f"[{initiated_by}] Launching {runner_count} runners for image {image_identifier} on machine {db_machine.identifier}.")

    # 5) Get or create today's key.
    try:
        key_record = await key_management.get_daily_key(cloud_connector_id=db_cloud_connector.id)
        if key_record is None:
            logger.error(f"[{initiated_by}] Key not found or created for cloud connector {db_cloud_connector.id}")
            raise RunnerCreationException("Key not found or created")
    except Exception as e:
        logger.error(f"[{initiated_by}] Error getting or creating key: {e!s}")
        raise

    # 6) Launch all instances concurrently using the appropriate cloud service.
    coroutines = []
    for _ in range(runner_count):
        coroutine = launch_runner(db_machine, db_image, key_record, cloud_service, initiated_by)
        coroutines.append(coroutine)
    for i in range(runner_count):
        try:
            new_runner : Runner = await coroutines[i]
            launched_instances.append(new_runner)
        except Exception as e:
            logger.error(f"{i} runner of {runner_count} has failed to launch! With image_id {image_identifier}")

    if not launched_instances:
        logger.error(f"All {runner_count} runners have failed to launch! With image_id {image_identifier}")
        raise RunnerCreationException(f"All {runner_count} Runner(s) of image {image_identifier} have failed to start.")

    # Log summary information instead of creating a system-level history record
    duration_seconds = (datetime.now(timezone.utc) - launch_start_time).total_seconds()
    logger.info(f"[{initiated_by}] Launch summary: Requested: {runner_count}, Launched: {len(launched_instances)}, "
                f"Duration: {duration_seconds:.2f}s, Runners: {launched_instances}")

    return launched_instances

async def launch_runner(machine:Machine, image:Image, key:Key, cloud_service:str, initiated_by: str)->Runner:
    """Launch a single runner and produce a record for it."""
    with Session(engine) as session:
        instance_id = await cloud_service.create_instance(
                key_name=key.key_name,
                image_id=image.identifier,
                instance_type=machine.identifier,
                instance_count=1
            )

        if not instance_id:
            raise RunnerCreationException("Failed to create instance.")

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
        runner_history_repository.add_runner_history(session,
                                                     new_runner,
                                                     "runner_created",
                                                     {"timestamp": datetime.utcnow().isoformat(),
                                                      "image_id": image.id,
                                                      "machine_id": machine.id,
                                                      "instance_id": instance_id,
                                                      "state": "runner_starting",
                                                      "initiated_by": initiated_by}
                                                     )
        session.commit()
        # Queue a Celery task to update runner state when instance is ready.
        update_runner_state.delay(new_runner.id, instance_id)
        return new_runner

async def wait_for_runner_state(runner:Runner, state: str, seconds:int) -> Runner:
    """Poll the runner DB for when the runner has been set to a certain state."""
    for _ in range(seconds):
        with Session(engine) as session:
            runner: Runner = runner_repository.find_runner_by_id(session, runner.id)
            if runner and runner.state == state:
                return runner
            await asyncio.sleep(1)
    return None

def get_runner_by_id(id:int) -> Runner:
    """Retrieve a runner by its ID, else None."""
    with Session(engine) as session:
        return runner_repository.find_runner_by_id(session, id)

def get_existing_runner(user_id: int, image_id: int) -> Runner:
    """Retrieve a runner that is ready for use, else None."""
    with Session(engine) as session:
        return runner_repository.find_runner_by_user_id_and_image_id_and_states(session, user_id, image_id, ["active", "awaiting_client"])

def get_runner_from_pool(image_id) -> Runner:
    """Retrieve a runner that is ready for use from the pool, else None."""
    with Session(engine) as session:
        return runner_repository.find_runner_by_image_id_and_states(session, image_id, ["ready"])

def claim_runner(runner: Runner, requested_session_time, user:User, user_ip:str, script_vars):
    """Assign a runner to a user's session, produce the URL used to connect to the runner."""
    with Session(engine) as session:
        runner = runner_repository.find_runner_by_id(session, runner.id)
        # Update the runner state quickly to avoid race condition.
        runner.state = "awaiting_client"
        session.commit()
        # Update session_end for the existing runner.
        runner.session_end = runner.session_start + timedelta(minutes=requested_session_time)
        # Update the runner: assign the user, update environment data, and change state to "awaiting_client".
        runner.user_id = user.id
        # Store only script_vars in runner.env_data, not env_vars
        runner.env_data = script_vars
        # Store user_ip if present
        if user_ip:
            runner.user_ip = user_ip
        jwt_token = jwt_creation.create_jwt_token(
            runner_ip=str(runner.url),
            runner_id=runner.id,
            user_ip=user_ip
        )
        session.commit()
        return f"{constants.domain}/dest/{jwt_token}/"

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
        runner = runner_repository.find_runner_by_id(session, runner_id)
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
        runner_history_repository.add_runner_history(session, runner, event_name="termination_requested",
            event_data={
                "timestamp": datetime.utcnow().isoformat(),
                "initiated_by": initiated_by,
                "runner_state": runner.state,
                "session_info": {
                    "session_start": runner.session_start.isoformat() if runner.session_start else None,
                    "session_end": runner.session_end.isoformat() if runner.session_end else None,
                    "is_expired": runner.session_end < datetime.utcnow() if runner.session_end else False
                }
            })
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

    Executes on_terminate scripts (if they exist), then updates the corresponding Runner record
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
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

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

            # Check if a termination script exists for this image before trying to run it
            if old_state not in ["ready", "runner_starting", "app_starting", "terminated", "closed"]:
                # First check if script exists to avoid unnecessary exceptions
                stmt_script = select(Script).where(Script.event == "on_terminate", Script.image_id == runner.image_id)
                script_exists = session.exec(stmt_script).first() is not None

                if script_exists:
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
                else:
                    # Log that we're skipping script execution because no script exists
                    logger.info(f"[{initiated_by}] No on_terminate script found for image {runner.image_id}, skipping script execution")
                    result["details"].append({
                        "step": "script_execution",
                        "status": "skipped",
                        "message": f"No on_terminate script found for image {runner.image_id}"
                    })

        # Stop instance and update history
        try:
            # After stopping, update the runner state to "closed".
            with Session(engine) as session:
                # Continue with termination regardless of script outcome
                logger.info(f"[{initiated_by}] Proceeding with instance termination for runner {runner.id}")
                logger.info(f"[{initiated_by}] Stopping instance {instance_id} for runner {runner.id}")
                stop_state = await cloud_service.stop_instance(instance_id)
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
            # Continue with termination even if stopping fails

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

async def force_shutdown_runners(instance_ids: list, initiated_by: str = "system"):
    """
    Force stop and terminate instances without running scripts or using intermediate states.

    Used during application shutdown to ensure all runners are terminated
    without waiting for potentially time-consuming scripts to complete.
    Skips the "closed" state entirely to minimize database operations.

    Args:
        instance_ids: List of instance IDs to terminate
        initiated_by: Identifier of the service/job that initiated the termination
    """
    from app.models.runner_history import RunnerHistory

    results = []

    for instance_id in instance_ids:
        result = {"instance_id": instance_id, "status": "success", "details": [], "initiated_by": initiated_by}

        try:
            # Find the runner and related resources
            with Session(engine) as session:
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()

                if not runner:
                    logger.warning(f"[{initiated_by}] Runner with instance ID {instance_id} not found, skipping")
                    continue

                # Skip if already terminated
                if runner.state == "terminated":
                    logger.info(f"[{initiated_by}] Runner {runner.id} already in terminated state, skipping")
                    continue

                # Get necessary info for cloud operations
                image = session.get(Image, runner.image_id)
                if not image or not image.cloud_connector_id:
                    logger.warning(f"[{initiated_by}] Missing image or cloud connector for runner {runner.id}, skipping")
                    continue

                cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
                if not cloud_connector:
                    logger.warning(f"[{initiated_by}] Cloud connector {image.cloud_connector_id} not found, skipping")
                    continue

                # Get cloud service
                cloud_service = get_cloud_service(cloud_connector)

                # Update runner state directly to terminated and record the change
                old_state = runner.state
                runner.state = "terminated"  # Skip intermediate states
                runner.ended_on = datetime.utcnow()

                # Create history record
                terminating_history = RunnerHistory(
                    runner_id=runner.id,
                    event_name="runner_force_terminated",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "old_state": old_state,
                        "new_state": "terminated",
                        "initiated_by": initiated_by,
                        "note": "Force termination during application shutdown - skipping scripts and intermediate states"
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(terminating_history)
                session.commit()

                result["runner_id"] = runner.id

            # Perform the actual instance operations with the cloud provider
            try:
                # Stop and terminate in sequence with timeouts
                logger.info(f"[{initiated_by}] Force stopping and terminating instance {instance_id} for runner {runner.id}")

                # Try to stop first with a short timeout
                try:
                    stop_future = cloud_service.stop_instance(instance_id)
                    await asyncio.wait_for(stop_future, timeout=15)  # 15 second timeout for stop
                except (asyncio.TimeoutError, Exception) as e:
                    logger.warning(f"[{initiated_by}] Stop operation for instance {instance_id} failed or timed out: {e}, proceeding to terminate")

                # Always attempt to terminate, even if stop failed
                try:
                    terminate_future = cloud_service.terminate_instance(instance_id)
                    await asyncio.wait_for(terminate_future, timeout=15)  # 15 second timeout for terminate
                    logger.info(f"[{initiated_by}] Successfully terminated instance {instance_id}")
                except (asyncio.TimeoutError, Exception) as e:
                    logger.error(f"[{initiated_by}] Terminate operation for instance {instance_id} failed or timed out: {e}")
                    # The instance might still be terminating in the cloud provider
                    # Our database already shows it as terminated, so we don't need to update it

                result["status"] = "success"
                result["details"].append({"step": "terminate", "status": "initiated"})

            except Exception as e:
                logger.error(f"[{initiated_by}] Error in cloud provider operations for instance {instance_id}: {e}")
                # We don't change the database state back since we want it to show as terminated
                # even if the cloud operation failed
                result["status"] = "partial"
                result["details"].append({"step": "cloud_operations", "error": str(e)})

            results.append(result)

        except Exception as e:
            logger.error(f"[{initiated_by}] Error processing instance {instance_id}: {e}")
            results.append({
                "instance_id": instance_id,
                "status": "error",
                "message": f"Error during forced shutdown: {e!s}"
            })

    return results

async def shutdown_all_runners():
    """
    Stop and then terminate all instances for runners that are not in the 'terminated' state.

    During application shutdown, skips script execution and intermediate states
    to ensure quick and reliable termination.
    """
    initiated_by = "shutdown_all_runners"
    logger.info(f"[{initiated_by}] Starting shutdown of all active runners")

    try:
        with Session(engine) as session:
            stmt = select(Runner).where(Runner.state != "terminated")
            runners_to_shutdown = session.exec(stmt).all()
            instance_ids = [runner.identifier for runner in runners_to_shutdown]

        if not instance_ids:
            logger.info(f"[{initiated_by}] No active runners found to terminate")
            return []

        logger.info(f"[{initiated_by}] Found {len(instance_ids)} runners to terminate")

        # Process in batches to avoid overloading
        batch_size = 10
        results = []

        for i in range(0, len(instance_ids), batch_size):
            batch = instance_ids[i:i+batch_size]
            batch_results = await force_shutdown_runners(batch, initiated_by)
            results.extend(batch_results)

        logger.info(f"[{initiated_by}] Completed shutdown of all active runners")
        return results
    except Exception as e:
        logger.error(f"[{initiated_by}] Error during shutdown_all_runners: {e}")
        return [{"status": "error", "message": f"Global error in shutdown_all_runners: {e!s}"}]
