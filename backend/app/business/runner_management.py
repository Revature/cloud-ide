"""Module for managing runners (EC2 instances) for running scripts."""

import uuid
import asyncio
import traceback
from datetime import datetime, timedelta, timezone
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from app.db.database import engine, get_session
from app.models import Machine, Image, Runner, CloudConnector, Script, RunnerHistory, Key, User
from app.util import constants
from app.business.cloud_services import cloud_service_factory
from app.tasks import starting_runner, shutdown_runner
from app.business import image_management, jwt_creation, key_management, script_management, security_group_management
from app.db import cloud_connector_repository, machine_repository, runner_repository, runner_history_repository, image_repository
from app.exceptions.runner_exceptions import RunnerExecException, RunnerRetrievalException, RunnerDefinitionException

logger = get_task_logger(__name__)

async def launch_runners(image_identifier: str, runner_count: int, initiated_by: str = "system", claimed: bool = False) -> list[Runner]:
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
        coroutine = launch_runner(config["machine"], config["image"], key_record, config["cloud_service"], initiated_by, claimed=claimed)
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

async def launch_runner(machine: Machine,
                        image: Image,
                        key: Key,
                        cloud_service,
                        initiated_by: str,
                        claimed: bool = False) -> Runner:
    """Launch a single runner and produce a record for it."""
    try:
        # First create a dedicated security group for this runner
        security_group_id = await security_group_management.create_security_group(image.cloud_connector_id)

        # Create the instance with the security group
        instance_id = await cloud_service.create_instance(
            key_name=key.key_name,
            image_id=image.identifier,
            instance_type=machine.identifier,
            instance_count=1,
            security_groups=[security_group_id]  # Use the newly created security group
        )

        if not instance_id:
            raise RunnerExecException("Failed to create instance.")

        # Create the runner record
        with Session(engine) as session:
            if claimed:
                state = "runner_starting_claimed"
            else:
                state = "runner_starting"

            new_runner = Runner(
                machine_id=machine.id,
                image_id=image.id,
                user_id=None,           # No user assigned yet.
                key_id=key.id,     # Associate the runner with today's key.
                state=state,  # State will update once instance is running.
                url="",                 # Empty URL; background task will update it.
                token="",
                identifier=instance_id,
                external_hash=uuid.uuid4().hex,
                session_start=datetime.utcnow(),
                session_end=datetime.utcnow() + timedelta(minutes=10)
            )

            new_runner = runner_repository.add_runner(session, new_runner)

            # Create runner history record
            runner_history_repository.add_runner_history(
                session=session,
                runner=new_runner,
                event_name="runner_created",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "image_id": image.id,
                    "machine_id": machine.id,
                    "instance_id": instance_id,
                    "security_group_id": security_group_id,
                    "state": "runner_starting",
                    "initiated_by": initiated_by
                },
                created_by=initiated_by
            )

            session.commit()

            # Associate the security group with the runner in the database
            await security_group_management.associate_security_group_with_runner(
                new_runner.id,
                security_group_id
            )

            # Queue a Celery task to update runner state when instance is ready
            starting_runner.update_runner_state.delay(new_runner.id, instance_id)

            return new_runner

    except Exception as e:
        logger.error(f"Error launching runner: {e!s}")
        # Clean up security group if instance creation failed
        if 'security_group_id' in locals() and not ('instance_id' in locals() and instance_id):
            try:
                logger.info(f"Cleaning up security group {security_group_id} after failed runner launch")
                await security_group_management.delete_security_group(security_group_id, cloud_service)
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up security group: {cleanup_error!s}")
        raise RunnerExecException(f"Failed to launch runner: {e!s}") from e

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
        runner.session_end = datetime.now(timezone.utc) + timedelta(minutes=requested_session_time)
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

        # Get cloud service for security group and tagging operations
        try:
            image = image_repository.find_image_by_id(session, runner.image_id)
            # print(f"Found image: id={image.id}, cloud_connector_id={getattr(image, 'cloud_connector_id', None)}")
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
                        logger.info(f"Successfully created cloud service")

                        # Update security group rules to allow user IP access
                        try:
                            # print(f"Updating security groups for runner {runner.id} to allow access from IP {user_ip}")
                            logger.info(f"Updating security groups for runner {runner.id} to allow access from IP {user_ip}")
                            security_group_result = await security_group_management.authorize_user_access(
                                runner.id,
                                user_ip,
                                user.email,
                                cloud_service
                            )
                            # print(f"Security group result: {security_group_result}")
                            logger.info(f"Security group update result: {security_group_result}")
                        except Exception as e:
                            # print(f"Failed to update security groups: {e!s}")
                            logger.error(f"Failed to update security groups: {e!s}", exc_info=True)
                            # Continue execution even if security group update fails

                        # Add instance tag for the user
                        try:
                            # print(f"Adding tag to instance {runner.identifier} for user {user.email}")
                            logger.info(f"Adding tag to instance {runner.identifier} for user {user.email}")
                            tag_result = await cloud_service.add_instance_tag(
                                runner.identifier,
                                user.email
                            )
                            # print(f"Tag addition result: {tag_result}")
                            logger.info(f"Tag addition result: {tag_result}")
                        except Exception as e:
                            # print(f"Failed to add instance tag: {e!s}")
                            logger.error(f"Failed to add instance tag: {e!s}", exc_info=True)
                    except Exception as e:
                        # print(f"Failed to create cloud service: {e!s}")
                        logger.error(f"Failed to create cloud service: {e!s}", exc_info=True)
                else:
                    # print(f"Cloud connector not found for image {image.id}")
                    logger.error(f"Cloud connector not found for image {image.id}")
            else:
                # print(f"Image not found or has no cloud connector for runner {runner.id}")
                logger.error(f"Image not found or has no cloud connector for runner {runner.id}")
        except Exception as e:
            # print(f"Error in cloud operations: {e!s}")
            logger.error(f"Error in cloud operations: {e!s}", exc_info=True)
            # Continue execution even if cloud operations fail

        session.commit()
        destination_url = f"{constants.domain}/dest/{jwt_token}/"
        logger.info(f"Returning destination URL for runner {runner.id}: {destination_url}")

        return destination_url

def auth_runner(runner_id: int, runner_token: str, session: Session = next(get_session())):
    """Check the runner's hash against a provided auth token."""
    runner : Runner = runner_repository.find_runner_by_id(session, runner_id)
    return runner.external_hash == runner_token

def get_devserver(runner_id: int, port: int, session: Session = next(get_session())):
    """Form a devserver URL."""
    runner: Runner = runner_repository.find_runner_by_id(session, runner_id)
    jwt = jwt_creation.create_jwt_token(runner.url, runner_id, runner.user_ip)
    destination_url = f"{constants.domain}/devserver/{port}/{jwt}/"
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

        if result["status"] == "queued":
            logger.info(f"[{initiated_by}] Successfully queued terminated runner {runner_id}")
            return {
                "status": "success",
                "message": "Runner termination queued",
                "details": result,
                "initiated_by": initiated_by
            }
        else:
            logger.error(f"[{initiated_by}] Failed to queue terminate runner {runner_id}")
            return {
                "status": "error",
                "message": "Failed to queue terminate runner",
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

async def shutdown_runners(instance_ids: list, initiated_by: str = "system") -> list:
    """
    Queue up runner shutdown tasks for Celery to process.

    This is a lightweight method that just validates and queues tasks.
    """
    results = []
    for instance_id in instance_ids:
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_instance_id(session, instance_id)
            if not runner:
                results.append({
                    "runner_instance_id": instance_id,
                    "status": "error",
                    "message": "Runner not found"
                })
                continue

            # Queue the task
            task = shutdown_runner.process_runner_shutdown.delay(
                runner_id=runner.id,
                instance_id=runner.identifier,
                initiated_by=initiated_by
            )

            results.append({
                "runner_id": runner.id,
                "status": "queued",
                "task_id": task.id,
                "message": "Shutdown process queued"
            })

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

                # Store runner ID for later use with security groups
                runner_id = runner.id

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
                logger.info(f"[{initiated_by}] Force stopping and terminating instance {instance_id} for runner {runner_id}")

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

                # Force cleanup security groups with a short timeout
                try:
                    logger.info(f"[{initiated_by}] Force cleaning up security groups for runner {runner_id}")
                    cleanup_future = security_group_management.handle_runner_termination(runner_id, cloud_service)
                    await asyncio.wait_for(cleanup_future, timeout=15)  # 15 second timeout for security group cleanup
                    logger.info(f"[{initiated_by}] Successfully cleaned up security groups for runner {runner_id}")
                    result["details"].append({"step": "security_group_cleanup", "status": "success"})
                except (asyncio.TimeoutError, Exception) as e:
                    logger.warning(f"[{initiated_by}] Security group cleanup for runner {runner_id} failed or timed out: {e}")
                    result["details"].append({"step": "security_group_cleanup", "status": "warning", "message": str(e)})
                    # Continue without failing the overall operation

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
