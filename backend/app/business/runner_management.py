"""Module for managing runners (EC2 instances) for running scripts."""

import uuid
import asyncio
import traceback
from datetime import datetime, timedelta, timezone
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from app.db.database import engine
from app.models import Machine, Image, Runner, CloudConnector, Script, RunnerHistory, Key, User
from app.util import constants
from app.business.cloud_services import cloud_service_factory
from app.tasks.starting_runner import update_runner_state
from app.business import image_management, jwt_creation, key_management, script_management
from app.db import cloud_connector_repository, machine_repository, runner_repository, runner_history_repository, image_repository
from app.exceptions.runner_exceptions import RunnerExecException, RunnerRetrievalException, RunnerDefinitionException

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
    image = image_management.get_image_by_identifier(image_identifier)
    config: dict = image_management.get_image_config(image_id=image.id)
    logger.info(f"[{initiated_by}] Launching {runner_count} runners for image {image_identifier} on machine {config["machine"]}.")
    # 5) Get or create today's key.
    try:
        key_record = await key_management.get_daily_key(cloud_connector_id=config["cloud_connector"].id)
        if key_record is None:
            logger.error(f"[{initiated_by}] Key not found or created for cloud connector {config["cloud_connector"].id}")
            raise RunnerExecException("Key not found or created")
    except Exception as e:
        logger.error(f"[{initiated_by}] Error getting or creating key: {e!s}")
        raise

    # 6) Launch all instances concurrently using the appropriate cloud service.
    coroutines = []
    for _ in range(runner_count):
        coroutine = launch_runner(config["machine"], config["image"], key_record, config["cloud_service"], initiated_by)
        coroutines.append(coroutine)
    for i in range(runner_count):
        try:
            new_runner : Runner = await coroutines[i]
            launched_instances.append(new_runner)
        except Exception as e:
            logger.error(f"{i} runner of {runner_count} has failed to launch! With image_id {image_identifier}")

    if not launched_instances:
        logger.error(f"All {runner_count} runners have failed to launch! With image_id {image_identifier}")
        raise RunnerExecException(f"All {runner_count} Runner(s) of image {image_identifier} have failed to start.")

    # Log summary information instead of creating a system-level history record
    duration_seconds = (datetime.now(timezone.utc) - launch_start_time).total_seconds()
    logger.info(f"[{initiated_by}] Launch summary: Requested: {runner_count}, Launched: {len(launched_instances)}, "
                f"Duration: {duration_seconds:.2f}s, Runners: {launched_instances}")

    return launched_instances

async def launch_runner(machine: Machine, image: Image, key: Key, cloud_service: str, initiated_by: str)->Runner:
    """Launch a single runner and produce a record for it."""
    with Session(engine) as session:
        instance_id = await cloud_service.create_instance(
                key_name=key.key_name,
                image_id=image.identifier,
                instance_type=machine.identifier,
                instance_count=1
            )
        if not instance_id:
            raise RunnerExecException("Failed to create instance.")
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
        runner_history_repository.add_runner_history(session=session,
                                                     runner=new_runner,
                                                     event_name="runner_created",
                                                     event_data={"timestamp": datetime.utcnow().isoformat(),
                                                      "image_id": image.id,
                                                      "machine_id": machine.id,
                                                      "instance_id": instance_id,
                                                      "state": "runner_starting",
                                                      "initiated_by": initiated_by},
                                                      created_by=initiated_by
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

async def claim_runner(runner: Runner, requested_session_time, user: User, user_ip: str, script_vars):
    """Assign a runner to a user's session, produce the URL used to connect to the runner."""
    logger.info(f"Starting claim_runner for runner_id={runner.id}, user_id={user.id}, requested_session_time={requested_session_time}")

    with Session(engine) as session:
        runner = runner_repository.find_runner_by_id(session, runner.id)
        logger.info(f"Found runner: id={runner.id}, state={runner.state}, image_id={runner.image_id}")


        # Update the runner state quickly to avoid race condition
        runner.state = "awaiting_client"
        logger.info(f"Updating runner state to awaiting_client")

        session.commit()

        # Update session_end and other attributes
        runner.session_end = runner.session_start + timedelta(minutes=requested_session_time)
        runner.user_id = user.id
        runner.env_data = script_vars
        if user_ip:
            runner.user_ip = user_ip

        logger.info(f"Updated runner: session_end={runner.session_end}, user_id={runner.user_id}, script_vars_size={len(script_vars)}")


        # Create JWT token
        jwt_token = jwt_creation.create_jwt_token(
            runner_ip=str(runner.url),
            runner_id=runner.id,
            user_ip=user_ip
        )
        logger.info(f"Created JWT token for runner {runner.id}")


        # Use cloud connector to update instance tag
        try:
            image = session.query(Image).get(runner.image_id)
            logger.info(f"Found image: id={image.id}, cloud_connector_id={getattr(image, 'cloud_connector_id', None)}")


            if image and image.cloud_connector_id:
                cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                    session, image.cloud_connector_id
                )
                logger.info(f"Found cloud connector: id={cloud_connector.id}, provider={getattr(cloud_connector, 'provider', 'unknown')}")


                if cloud_connector:
                    try:
                        logger.info(f"Creating cloud service for provider {getattr(cloud_connector, 'provider', 'unknown')}")

                        cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)
                        logger.info(f"Successfully created cloud service, attempting to add tag")


                        try:
                            logger.info(f"Adding tag to instance {runner.identifier} for user {user.email}")

                            tag_result = await cloud_service.add_instance_tag(
                                runner.identifier,
                                user.email
                            )
                            logger.info(f"Tag addition result: {tag_result}")

                        except Exception as e:
                            logger.error(f"Failed to add instance tag: {e!s}", exc_info=True)
                    except Exception as e:
                        logger.error(f"Failed to create cloud service: {e!s}", exc_info=True)
                else:
                    logger.error(f"Cloud connector not found for image {image.id}")
            else:
                logger.error(f"Image not found or has no cloud connector for runner {runner.id}")
        except Exception as e:
            logger.error(f"Error in cloud tagging process: {e!s}", exc_info=True)
            # Continue execution even if tagging fails

        session.commit()
        destination_url = f"{constants.domain}/dest/{jwt_token}/"
        logger.info(f"Returning destination URL for runner {runner.id}: {destination_url}")

        return destination_url

async def terminate_runner(runner_id: int, initiated_by: str = "system") -> dict:
    """
    Terminate a specific runner by ID.

    This function serves as a high-level interface for terminating a single runner,
    calling shutdown_runners with the appropriate instance ID.

    Args:
        runner_id: The ID of the runner to terminate
        initiated_by: Identifier of the service/job that initiated the termination
                     (e.g., "cleanup_job", "user_request", "admin_action")

    Returns:
        A dictionary with the result of the termination process.
    """
    logger.info(f"[{initiated_by}] Starting termination request for runner {runner_id}")

    try:
        # Find runner and validate state
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)

            # Handle not found case
            if not runner:
                logger.error(f"[{initiated_by}] Runner with ID {runner_id} not found for termination")
                return {
                    "status": "error",
                    "message": f"Runner with ID {runner_id} not found",
                    "initiated_by": initiated_by
                }

            # Handle already terminated case
            if runner.state in ("terminated", "closed"):
                logger.info(f"[{initiated_by}] Runner with ID {runner_id} is already terminated or closed")
                return {
                    "status": "warned",
                    "message": f"Runner with ID {runner_id} is already in {runner.state} state",
                    "initiated_by": initiated_by
                }

            # Create termination request history record
            session_end_time = runner.session_end if runner.session_end else None
            is_expired = session_end_time and session_end_time < datetime.utcnow()

            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name="termination_requested",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "initiated_by": initiated_by,
                    "runner_state": runner.state,
                    "session_info": {
                        "session_start": runner.session_start.isoformat() if runner.session_start else None,
                        "session_end": runner.session_end.isoformat() if runner.session_end else None,
                        "is_expired": is_expired
                    }
                },
                created_by=initiated_by
            )
            session.commit()

            # Get instance ID for shutdown_runners
            instance_id = runner.identifier
            logger.info(f"[{initiated_by}] Found runner {runner_id} (instance {instance_id}) in state '{runner.state}'")

        # Call shutdown_runners to handle the actual termination
        logger.info(f"[{initiated_by}] Delegating to shutdown_runners for runner {runner_id}")
        results = await shutdown_runners([instance_id], initiated_by)

        # Process and return results
        if not results:
            logger.error(f"[{initiated_by}] No results returned from shutdown_runners for runner {runner_id}")
            return {
                "status": "error",
                "message": "No termination results returned",
                "initiated_by": initiated_by
            }

        result = results[0]  # Get first (and only) result

        if result["status"] == "success":
            logger.info(f"[{initiated_by}] Successfully terminated runner {runner_id}")
            return {
                "status": "success",
                "message": "Runner terminated successfully",
                "details": result,
                "initiated_by": initiated_by
            }
        else:
            logger.error(f"[{initiated_by}] Failed to terminate runner {runner_id}")
            return {
                "status": "error",
                "message": "Failed to terminate runner",
                "details": result,
                "initiated_by": initiated_by
            }
    except Exception as e:
        logger.error(f"[{initiated_by}] Unexpected error in terminate_runner for {runner_id}: {e!s}")
        logger.error(f"[{initiated_by}] Traceback: {traceback.format_exc()}")
        return {
            "status": "error",
            "message": f"Unexpected error: {e!s}",
            "initiated_by": initiated_by
        }

async def shutdown_runners(launched_instance_ids: list, initiated_by: str = "system"):
    """Stop and then terminate all instances given in launched_instance_ids."""
    logger.info(f"[{initiated_by}] Starting shutdown for {len(launched_instance_ids)} instances")
    results = []

    for instance_id in launched_instance_ids:
        result = {"instance_id": instance_id, "status": "success", "details": [], "initiated_by": initiated_by}

        # Variables to store across sessions
        runner_id = None
        image_id = None
        cloud_connector_id = None

        # STEP 1: Find runner and prepare for termination
        try:
            with Session(engine) as session:
                # Find runner record
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()

                if not runner:
                    message = f"Runner with instance identifier {instance_id} not found."
                    logger.error(f"[{initiated_by}] {message}")
                    result["status"] = "error"
                    result["details"].append({"step": "find_runner", "status": "error", "message": message})
                    results.append(result)
                    continue

                # Store IDs for later use
                runner_id = runner.id
                image_id = runner.image_id

                # Get required resources for termination
                image = session.get(Image, runner.image_id)
                if not image:
                    message = f"Image for runner {runner.id} not found."
                    logger.error(f"[{initiated_by}] {message}")
                    result["status"] = "error"
                    result["details"].append({"step": "find_image", "status": "error", "message": message})
                    results.append(result)
                    continue

                cloud_connector_id = image.cloud_connector_id

                cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
                if not cloud_connector:
                    message = f"Cloud connector for image {image.id} not found."
                    logger.error(f"[{initiated_by}] {message}")
                    result["status"] = "error"
                    result["details"].append({"step": "find_cloud_connector", "status": "error", "message": message})
                    results.append(result)
                    continue

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
                script_exists = False
                if old_state not in ["ready", "runner_starting", "app_starting", "terminated", "closed"]:
                    # First check if script exists to avoid unnecessary exceptions
                    stmt_script = select(Script).where(Script.event == "on_terminate", Script.image_id == runner.image_id)
                    script_exists = session.exec(stmt_script).first() is not None

                    if script_exists:
                        logger.info(f"[{initiated_by}] Found on_terminate script for runner {runner.id}, will attempt to run it")
                    else:
                        # Log that we're skipping script execution because no script exists
                        logger.info(f"[{initiated_by}] No on_terminate script found for image {runner.image_id}, skipping script execution")
                        result["details"].append({
                            "step": "script_execution",
                            "status": "skipped",
                            "message": f"No on_terminate script found for image {runner.image_id}"
                        })
        except Exception as e:
            error_detail = str(e)
            tb_string = traceback.format_exc()
            logger.error(f"[{initiated_by}] Error during runner preparation: {error_detail}")
            logger.error(f"[{initiated_by}] Traceback: {tb_string}")
            result["status"] = "error"
            result["details"].append({"step": "prepare", "status": "error", "message": f"Error during preparation: {error_detail}"})
            results.append(result)
            continue

        # STEP 2: Execute script if it exists
        if script_exists:
            try:
                logger.info(f"[{initiated_by}] Running on_terminate script for runner {runner_id}...")
                # Run the script with empty env_vars since credentials should be retrieved from the environment
                script_result = await script_management.run_script_for_runner(
                    "on_terminate",
                    runner_id,
                    env_vars={},
                    initiated_by=initiated_by
                )
                if script_result:
                    logger.info(f"[{initiated_by}] Script executed for runner {runner_id}")
                    logger.info(f"[{initiated_by}] Script result: {script_result}")

                result["details"].append({"step": "script_execution", "status": "success", "message": "on_terminate script executed"})
            except Exception as e:
                error_detail = str(e)
                tb_string = traceback.format_exc()
                logger.error(f"[{initiated_by}] Error executing on_terminate script for runner {runner_id}: {error_detail}")
                logger.error(f"[{initiated_by}] Traceback: {tb_string}")

                # We'll record the error but CONTINUE with termination
                with Session(engine) as session:
                    # Create detailed history record for the script error
                    error_history = RunnerHistory(
                        runner_id=runner_id,
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

                # Log that we're continuing despite the error
                logger.info(f"[{initiated_by}] CHECKPOINT: Continuing with termination despite script error for runner {runner_id}")

        # STEP 3: Stop instance and update history - CRITICAL CHECKPOINT
        logger.info(f"[{initiated_by}] CHECKPOINT: Proceeding with instance termination for runner {runner_id} regardless of script outcome")
        try:
            # Get a fresh cloud service in this scope
            with Session(engine) as session:
                # Get cloud connector again to create a fresh cloud service
                cloud_connector = session.get(CloudConnector, cloud_connector_id)
                if not cloud_connector:
                    message = f"Cloud connector {cloud_connector_id} not found for stopping instance."
                    logger.error(f"[{initiated_by}] {message}")
                    result["details"].append({"step": "stop_instance", "status": "error", "message": message})
                    continue

                cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

                # Now use the fresh cloud service
                logger.info(f"[{initiated_by}] Stopping instance {instance_id} for runner {runner_id}")
                stop_state = await cloud_service.stop_instance(instance_id)
                logger.info(f"[{initiated_by}] Stop result for instance {instance_id}: {stop_state}")

            # Update runner state in a separate session
            with Session(engine) as session:
                # Get runner again
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()

                if runner:
                    logger.info(f"[{initiated_by}] Updating runner {runner.id} state to 'closed'")
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
            tb_string = traceback.format_exc()
            logger.error(f"[{initiated_by}] {error_message}")
            logger.error(f"[{initiated_by}] Traceback: {tb_string}")
            result["details"].append({"step": "stop_instance", "status": "error", "message": error_message})
            # Continue with termination even if stopping fails

        # STEP 4: Terminate the instance and update state to terminated
        logger.info(f"[{initiated_by}] CHECKPOINT: Proceeding to terminate instance {instance_id} for runner {runner_id}")
        try:
            # Get a fresh cloud service for termination
            with Session(engine) as session:
                cloud_connector = session.get(CloudConnector, cloud_connector_id)
                if not cloud_connector:
                    message = f"Cloud connector {cloud_connector_id} not found for terminating instance."
                    logger.error(f"[{initiated_by}] {message}")
                    result["details"].append({"step": "terminate_instance", "status": "error", "message": message})
                    continue

                cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

                logger.info(f"[{initiated_by}] Terminating instance {instance_id} for runner {runner_id}")
                terminate_state = await cloud_service.terminate_instance(instance_id)
                logger.info(f"[{initiated_by}] Terminate result for instance {instance_id}: {terminate_state}")

            # Update runner state in a separate session
            with Session(engine) as session:
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()

                if runner:
                    logger.info(f"[{initiated_by}] Updating runner {runner.id} state to 'terminated'")
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
            tb_string = traceback.format_exc()
            logger.error(f"[{initiated_by}] {error_message}")
            logger.error(f"[{initiated_by}] Traceback: {tb_string}")
            result["details"].append({"step": "terminate_instance", "status": "error", "message": error_message})

        logger.info(f"[{initiated_by}] Completed processing for instance {instance_id}, result: {result['status']}")
        results.append(result)

    logger.info(f"[{initiated_by}] Completed shutdown for all instances, processed: {len(results)}")
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

    logger.info(f"[{initiated_by}] force_shutdown_runners called with instance_ids: {instance_ids}")

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
                cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

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
                        "note": "Force termination - skipping scripts and intermediate states"
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
        # Get all non-terminated runner IDs in a single transaction
        instance_ids = []
        with Session(engine) as session:
            stmt = select(Runner.identifier).where(Runner.state != "terminated")
            instance_ids = session.exec(stmt).all()

        if not instance_ids:
            logger.info(f"[{initiated_by}] No active runners found to terminate")
            return []

        logger.info(f"[{initiated_by}] Found {len(instance_ids)} runners to terminate: {instance_ids}")

        # Process in smaller batches to avoid overloading
        batch_size = 5
        results = []

        for i in range(0, len(instance_ids), batch_size):
            batch = instance_ids[i:i+batch_size]
            logger.info(f"[{initiated_by}] Processing batch {i//batch_size + 1}: {batch}")
            try:
                batch_results = await force_shutdown_runners(batch, initiated_by)
                results.extend(batch_results)
                logger.info(f"[{initiated_by}] Batch {i//batch_size + 1} complete: {batch_results}")
            except Exception as e:
                logger.error(f"[{initiated_by}] Error in batch {i//batch_size + 1}: {e}")
                # Continue with next batch instead of failing completely

        logger.info(f"[{initiated_by}] Completed shutdown of all active runners. Results: {results}")
        return results
    except Exception as e:
        logger.error(f"[{initiated_by}] Critical error during shutdown_all_runners: {e}")
        return [{"status": "error", "message": f"Global error in shutdown_all_runners: {e!s}"}]
