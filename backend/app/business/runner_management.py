"""Module for managing runners (EC2 instances) for running scripts."""

import uuid
import asyncio
from datetime import datetime, timedelta
from app.models.key import Key
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from app.db.database import engine
from app.models import Machine, Image, Runner, CloudConnector, Script
from app.util import constants
from app.business.cloud_services.factory import get_cloud_service
from app.tasks.starting_runner import update_runner_state
from app.business.key_management import get_daily_key
from app.db import cloud_connector_repository, machine_repository, runner_repository, runner_history_repository
from app.business import image_management, jwt_creation
from app.models.runner_history import RunnerHistory
from app.exceptions.runner_exceptions import RunnerCreationException, RunnerRetrievalException, RunnerDefinitionException
from app.business import script_management
from app.models.user import User

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
    launch_start_time = datetime.utcnow()

    # Open one DB session for reading resources.
    with Session(engine) as session:
        # 1) Fetch the Image.
        db_image : Image = image_management.get_image_by_identifier(image_identifier)
        if not db_image:
            logger.error(f"[{initiated_by}] Image not found: {image_identifier}")
            raise RunnerCreationException("Image not found")

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
        cloud_service = get_cloud_service(db_cloud_connector)
        logger.info(f"[{initiated_by}] Launching {runner_count} runners for image {image_identifier} on machine {db_machine.identifier}.")

    # 5) Get or create today's key.
    try:
        key_record = await get_daily_key(cloud_connector_id=db_cloud_connector.id)
        if key_record is None:
            logger.error(f"[{initiated_by}] Key not found or created for cloud connector {db_db_cloud_connector.id}")
            raise RunnerCreationException("Key not found or created")
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
        instances : list[str] = await asyncio.gather(*launch_tasks)
        launched_instances.extend(instances)

        logger.info(f"[{initiated_by}] Successfully launched {len(launched_instances)} instances: {launched_instances}")
    except Exception as e:
        # TODO: Refactor to handle a case where only one instance fails to launch, as opposed to
        # all-or-nothing
        logger.error(f"[{initiated_by}] Error launching instances: {e!s}")
        raise

    # 7) Create Runner records (URL will be updated later by a background job).
    created_runners = []
    for instance in instances:
        new_runner : Runner = launch_runner(db_machine, db_image, key_record, instance, initiated_by)
        created_runners.append(new_runner)

    # Log summary information instead of creating a system-level history record
    duration_seconds = (datetime.utcnow() - launch_start_time).total_seconds()
    logger.info(f"[{initiated_by}] Launch summary: Requested: {runner_count}, Launched: {len(launched_instances)}, "
                f"Duration: {duration_seconds:.2f}s, Runner IDs: {created_runners}")

    return launched_instances

# TODO: Launch the instance in this function as well.
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
        runner_history_repository.add_runner_history(session, runner_creation_record)
        session.commit()
        # Queue a Celery task to update runner state when instance is ready.
        update_runner_state.delay(new_runner.id, instance_id)
        return new_runner

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
    """Assign a runner to a user's session."""
    with Session(engine) as session:
        runner = runner_repository.find_runner_by_id(session, runner.id)
        session.add(runner)
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
        session.commit()
        return runner

async def prepare_runner(runner: Runner, env_vars, is_reconnect: bool):
    """Create Runner JWT, execute its script and prepare the DTO."""
    # Generate a JWT token for the existing runner
    jwt_token = jwt_creation.create_jwt_token(
        runner_ip=str(runner.url),
        runner_id=runner.id,
        user_ip=runner.user_ip
    )
    full_url = f"{constants.domain}/dest/{jwt_token}/"
    if not is_reconnect:
        try:
            print(f"Executing script for runner {runner.id} with env_data {runner.env_data}")
            script_result = await script_management.run_script_for_runner("on_awaiting_client",
                                                                          runner.id,
                                                                          env_vars,
                                                                          initiated_by="app_requests_endpoint")
            print(f"Script executed for runner {runner.id}: {script_result}")
        except Exception as e:
            print(f"Error executing script for runner {runner.id}: {e}")
            return {"error": f"Error executing script for runner {runner.id}"}
    runnerDTO = {"url": full_url, "runner_id": str(runner.id)}
    logger.info("Delivering a runner: "+ runnerDTO)
    return runnerDTO

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
        runner_history_repository.add_runner_history(session, termination_request)
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

        # Continue with termination regardless of script outcome
        logger.info(f"[{initiated_by}] Proceeding with instance termination for runner {runner.id}")

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
