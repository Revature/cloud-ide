"""Module for managing runners (EC2 instances) for running scripts."""

import json
import uuid
import asyncio
import traceback
from datetime import datetime, timedelta, timezone
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from typing import Optional
from app.db.database import engine, get_session
from app.models import Machine, Image, Runner, CloudConnector, Script, RunnerHistory, Key, User
from app.util import constants, runner_status_management
from app.business.cloud_services import cloud_service_factory
from app.tasks import starting_runner, shutdown_runner
from app.business import image_management, jwt_creation, key_management, script_management, security_group_management
from app.db import cloud_connector_repository, machine_repository, runner_repository, runner_history_repository, image_repository
from app.exceptions.runner_exceptions import RunnerExecException, RunnerRetrievalException, RunnerDefinitionException

logger = get_task_logger(__name__)

async def launch_runners(
        image_identifier: str, runner_count: int, initiated_by: str = "system", claimed: bool = False, request_id: Optional[int] = None
    ) -> list[Runner]:
    """
    Launch instances concurrently and create Runner records.

    Args:
        image_identifier: The identifier of the image to launch
        runner_count: Number of runners to launch
        initiated_by: Identifier of the service/job that initiated the launch
                     (e.g., "pool_manager", "api_request", "admin_action")
        request_id: Optional request ID for status tracking

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
        coroutine = launch_runner(
            config["image"], key_record, config["cloud_service"], initiated_by, claimed=claimed, request_id=request_id
        )
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

async def launch_runner(
    image: Image,
    key: Key,
    cloud_service,
    initiated_by: str,
    claimed: bool = False,
    request_id: Optional[str] = None
) -> Runner:
    """Launch a single runner and produce a record for it."""
    try:
        # Get the machine from the image
        with Session(engine) as session:
            machine = machine_repository.find_machine_by_id(session, image.machine_id)
            if not machine:
                raise RunnerDefinitionException(f"Machine not found for image {image.id}")

        # Create a dedicated security group for this runner
        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "NETWORK_SETUP",
                "Creating security group for runner",
                {
                    "setup_type": "security_group",
                    "status": "in_progress"
                }
            )

        security_group_id = await security_group_management.create_security_group(image.cloud_connector_id)

        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "NETWORK_SETUP",
                "Security group created for runner",
                {
                    "setup_type": "security_group",
                    "status": "succeeded",
                    "details": {
                        "security_group_id": security_group_id
                    }
                }
            )

        # Create the instance with the security group
        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "VM_CREATION",
                "Creating virtual machine instance",
                {
                    "status": "in_progress"
                }
            )

        instance_id = await cloud_service.create_instance(
            key_name=key.key_name,
            image_id=image.identifier,
            instance_type=machine.identifier,
            instance_count=1,
            security_groups=[security_group_id]
        )

        if not instance_id:
            raise RunnerExecException("Failed to create instance.")

        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "VM_CREATION",
                "Created virtual machine instance",
                {
                    "status": "succeeded",
                    "instance_id": instance_id
                }
            )

        # Begin VM boot sequence
        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_PREPARATION",
                "Virtual machine is booting",
                {
                    "instance_id": instance_id,
                    "preparation_type": "boot",
                    "status": "in_progress"
                }
            )

        # Create the runner record
        with Session(engine) as session:
            if claimed:
                state = "runner_starting_claimed"
            else:
                state = "runner_starting"

            # Create runner record
            if request_id:
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RUNNER_REGISTRATION",
                    "Creating runner record in database",
                    {
                        "instance_id": instance_id,
                        "status": "in_progress"
                    }
                )

            new_runner = Runner(
                machine_id=machine.id,
                image_id=image.id,
                user_id=None,
                key_id=key.id,
                state=state,
                url="",
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
                    "state": state,
                    "initiated_by": initiated_by,
                    "request_id": request_id
                },
                created_by=initiated_by
            )

            session.commit()

            # Associate the security group with the runner in the database
            await security_group_management.associate_security_group_with_runner(
                new_runner.id,
                security_group_id
            )

            if request_id:
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RUNNER_REGISTRATION",
                    "Runner record created successfully",
                    {
                        "runner_id": new_runner.id,
                        "instance_id": instance_id,
                        "status": "succeeded",
                        "details": {
                            "state": state
                        }
                    }
                )

                # Start tracking runner state changes in background
                asyncio.create_task(
                    runner_status_management.track_runner_state(new_runner.id, request_id)
                )

            # Begin tagging process
            if request_id:
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RESOURCE_TAGGING",
                    "Adding tags to instance",
                    {
                        "runner_id": new_runner.id,
                        "instance_id": instance_id,
                        "status": "in_progress",
                        "tags": [
                            {"key": "Name", "value": f"runner-{new_runner.id}"},
                            {"key": "ImageId", "value": str(image.id)},
                            {"key": "ManagedBy", "value": "cloud-ide"}
                        ]
                    }
                )

                # Tag added event would be emitted by the tagging function

            # Queue the task chain - just the first task
            from app.tasks.starting_runner import wait_for_instance_running
            wait_for_instance_running.delay(new_runner.id, instance_id)

            return new_runner

    except Exception as e:
        logger.error(f"Error launching runner: {e}")

        # Clean up security group if instance creation failed
        if 'security_group_id' in locals() and not ('instance_id' in locals() and instance_id):
            try:
                logger.info(f"Cleaning up security group {security_group_id} after failed runner launch")
                await security_group_management.delete_security_group(security_group_id, cloud_service)
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up security group: {cleanup_error!s}")

        # Emit error event if request_id is provided
        if request_id:
            error_type = "unknown"
            if isinstance(e, RunnerDefinitionException):
                error_type = "invalid_configuration"
            elif "capacity" in str(e).lower():
                error_type = "capacity"
            elif "permission" in str(e).lower():
                error_type = "permission"
            elif "timeout" in str(e).lower():
                error_type = "timeout"
            elif "network" in str(e).lower():
                error_type = "network"

            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "ERROR",
                f"Error launching runner: {e!s}",
                {
                    "error_type": error_type,
                    "details": {
                        "exception": str(e),
                        "image_id": image.id if 'image' in locals() else None,
                        "security_group_id": security_group_id if 'security_group_id' in locals() else None,
                        "instance_id": instance_id if 'instance_id' in locals() else None
                    }
                }
            )

            # If VM creation was in progress, emit failure status
            if 'instance_id' in locals() and not instance_id:
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "VM_CREATION",
                    "Failed to create virtual machine instance",
                    {
                        "status": "failed",
                        "error": str(e)
                    }
                )

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

async def claim_runner(
    runner: Runner,
    user: User,
    runner_config: dict,
    request_id: Optional[str] = None
) -> str:
    """Assign a runner to a user's session, produce the URL used to connect to the runner."""
    logger.info(f"Starting claim_runner for runner_id={runner.id}, user_id={user.id}, "+
                f"requested_session_time={runner_config["requested_session_time"]}")

    with Session(engine) as session:
        runner = runner_repository.find_runner_by_id(session, runner.id)
        logger.info(f"Found runner: id={runner.id}, state={runner.state}, image_id={runner.image_id}")
        # Update the runner state quickly to avoid race condition
        previous_state = runner.state
        runner.state = "awaiting_client"
        logger.info(f"Updating runner state from {previous_state} to awaiting_client")
        session.commit()
        # Emit instance lifecycle event for state change
        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_LIFECYCLE",
                f"Runner state changed to awaiting_client",
                {
                    "runner_id": runner.id,
                    "state": "awaiting_client",
                    "previous_state": previous_state
                }
            )

        # Update session_end and other attributes
        runner.session_start = datetime.now(timezone.utc)
        runner.session_end = datetime.now(timezone.utc) + timedelta(minutes=runner_config["requested_session_time"])
        runner.user_id = user.id
        runner.env_data = runner_config["script_vars"]
        # Config file setup.
        config_json = json.dumps({
            "runnerAuth": runner.external_hash,
            "runnerId": runner.id,
            "userId": runner.user_id,
            "sessionStart": runner.session_start.isoformat(),
            "maxSessionTime": constants.max_runner_lifetime,
            "filePath": runner_config["file_path"],
            "monolithUrl": constants.domain
        })
        try:
            asyncio.get_running_loop()
            # If an event loop is running, schedule the config script as a background job
            asyncio.create_task(script_management.run_custom_script_for_runner(runner.id,
                                                                               "app/db/sample_scripts/config.sh",
                                                                               {"config_json":config_json},
                                                                               "config"))

        except RuntimeError:
            # If no event loop is running, start one
            asyncio.run(script_management.run_custom_script_for_runner(runner.id,
                                                                       "app/db/sample_scripts/config.sh",
                                                                       {"config_json":config_json},
                                                                       "config"))

        if runner_config["user_ip"]:
            runner.user_ip = ["user_ip"]

        logger.info(f"Updated runner: session_end={runner.session_end}, user_id={runner.user_id}, "+
                    f"script_vars_size={len(runner_config["script_vars"])}")

        # Emit session status update
        if request_id:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "SESSION_STATUS",
                "User session created",
                {
                    "runner_id": runner.id,
                    "session_type": "create",
                    "status": "in_progress",
                    "duration": runner_config["requested_session_time"]
                }
            )

        # Get cloud service for security group and tagging operations
        try:
            image = image_repository.find_image_by_id(session, runner.image_id)
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
                            logger.info(f"Updating security groups for runner {runner.id} to allow access from IP {runner_config["user_ip"]}")

                            # Emit security update event - starting
                            if request_id:
                                await runner_status_management.runner_status_emitter.emit_status(
                                    request_id,
                                    "SECURITY_UPDATE",
                                    "Updating security group to allow user access",
                                    {
                                        "runner_id": runner.id,
                                        "update_type": "update_security_group",
                                        "status": "in_progress",
                                        "details": {
                                            "user_ip": runner_config["user_ip"]
                                        }
                                    }
                                )

                            security_group_result = await security_group_management.authorize_user_access(
                                runner.id,
                                runner_config["user_ip"],
                                user.email,
                                cloud_service
                            )
                            logger.info(f"Security group update result: {security_group_result}")

                            # Emit security update event - completed
                            if request_id:
                                await runner_status_management.runner_status_emitter.emit_status(
                                    request_id,
                                    "SECURITY_UPDATE",
                                    "Security group updated to allow user access",
                                    {
                                        "runner_id": runner.id,
                                        "update_type": "update_security_group",
                                        "status": "succeeded",
                                        "details": {
                                            "user_ip": runner_config["user_ip"]
                                        }
                                    }
                                )
                        except Exception as e:
                            logger.error(f"Failed to update security groups: {e!s}", exc_info=True)

                            # Emit security update failure event
                            if request_id:
                                await runner_status_management.runner_status_emitter.emit_status(
                                    request_id,
                                    "SECURITY_UPDATE",
                                    "Failed to update security group for user access",
                                    {
                                        "runner_id": runner.id,
                                        "update_type": "update_security_group",
                                        "status": "failed",
                                        "error": str(e)
                                    }
                                )
                            # Continue execution even if security group update fails

                        # Add instance tag for the user
                        try:
                            logger.info(f"Adding tag to instance {runner.identifier} for user {user.email}")

                            # Emit tagging event - starting
                            if request_id:
                                await runner_status_management.runner_status_emitter.emit_status(
                                    request_id,
                                    "RESOURCE_TAGGING",
                                    "Adding tags to instance",
                                    {
                                        "runner_id": runner.id,
                                        "instance_id": runner.identifier,
                                        "status": "in_progress",
                                        "tags": [
                                            {"key": "User", "value": user.email}
                                        ]
                                    }
                                )

                            tag_result = await cloud_service.add_instance_tag(
                                runner.identifier,
                                user.email
                            )
                            logger.info(f"Tag addition result: {tag_result}")

                            # Emit tagging event - completed
                            if request_id:
                                await runner_status_management.runner_status_emitter.emit_status(
                                    request_id,
                                    "RESOURCE_TAGGING",
                                    "Instance tag added for user",
                                    {
                                        "runner_id": runner.id,
                                        "instance_id": runner.identifier,
                                        "status": "succeeded",
                                        "tags": [
                                            {"key": "User", "value": user.email}
                                        ]
                                    }
                                )
                        except Exception as e:
                            logger.error(f"Failed to add instance tag: {e!s}", exc_info=True)

                            # Emit tagging failure event
                            if request_id:
                                await runner_status_management.runner_status_emitter.emit_status(
                                    request_id,
                                    "RESOURCE_TAGGING",
                                    "Failed to add instance tag for user",
                                    {
                                        "runner_id": runner.id,
                                        "instance_id": runner.identifier,
                                        "status": "failed",
                                        "error": str(e),
                                        "tags": [
                                            {"key": "User", "value": user.email}
                                        ]
                                    }
                                )
                    except Exception as e:
                        logger.error(f"Failed to create cloud service: {e!s}", exc_info=True)

                        # Emit error event
                        if request_id:
                            await runner_status_management.runner_status_emitter.emit_status(
                                request_id,
                                "ERROR",
                                "Failed to create cloud service",
                                {
                                    "error_type": "service_creation",
                                    "details": {
                                        "exception": str(e),
                                        "cloud_connector_id": cloud_connector.id,
                                        "provider": getattr(cloud_connector, 'provider', 'unknown')
                                    }
                                }
                            )
                else:
                    logger.error(f"Cloud connector not found for image {image.id}")

                    # Emit error event
                    if request_id:
                        await runner_status_management.runner_status_emitter.emit_status(
                            request_id,
                            "ERROR",
                            "Cloud connector not found",
                            {
                                "error_type": "not_found",
                                "details": {
                                    "resource_type": "cloud_connector",
                                    "image_id": image.id
                                }
                            }
                        )
            else:
                logger.error(f"Image not found or has no cloud connector for runner {runner.id}")

                # Emit error event
                if request_id:
                    await runner_status_management.runner_status_emitter.emit_status(
                        request_id,
                        "ERROR",
                        "Image not found or has no cloud connector",
                        {
                            "error_type": "not_found",
                            "details": {
                                "resource_type": "image",
                                "runner_id": runner.id
                            }
                        }
                    )
        except Exception as e:
            logger.error(f"Error in cloud operations: {e!s}", exc_info=True)

            # Emit error event
            if request_id:
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "ERROR",
                    f"Error in cloud operations: {e!s}",
                    {
                        "error_type": "cloud_operations",
                        "details": {
                            "exception": str(e),
                            "runner_id": runner.id
                        }
                    }
                )
            # Continue execution even if cloud operations fail

        session.commit()

        runner_url = get_runner_destination_url(runner)

        # Return the destination URL
        return runner_url

def get_runner_destination_url(runner: Runner) -> str:
    """
    Generate the destination URL for a runner.

    Args:
        runner: The runner object
    Returns:
        The destination URL for the runner
    """
    # Create JWT token
    jwt_token = jwt_creation.create_jwt_token(
        runner_ip=str(runner.url),
        runner_id=runner.id,
        user_ip=runner.user_ip
    )
    logger.info(f"Created JWT token for runner {runner.id}")

    # Construct the destination URL
    destination_url = f"{constants.domain}/dest/{jwt_token}/"
    logger.info(f"Generated destination URL for runner {runner.id}: {destination_url}")

    return destination_url

async def stop_runner(runner_id: int, initiated_by: str = "system") -> dict:
    """
    Stop a running instance without terminating it.

    This function transitions a runner to the "closed" state and stops the underlying VM instance.

    Args:
        runner_id: The ID of the runner to stop
        initiated_by: Identifier of who initiated the stop operation

    Returns:
        A dictionary with the result of the stop operation
    """
    logger.info(f"[{initiated_by}] Starting stop operation for runner {runner_id}")
    result = {
        "status": "error",
        "message": "Unknown error occurred",
        "initiated_by": initiated_by
    }

    try:
        # Store needed information from the database session
        cloud_service = None
        instance_id = None

        # Find runner and validate state
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)

            # Handle validation cases
            if not runner:
                logger.error(f"[{initiated_by}] Runner with ID {runner_id} not found")
                result["message"] = f"Runner with ID {runner_id} not found"
                return result

            if runner.state in ("closed", "terminated"):
                logger.info(f"[{initiated_by}] Runner with ID {runner_id} is already in {runner.state} state")
                result["status"] = "warned"
                result["message"] = f"Runner with ID {runner_id} is already in {runner.state} state"
                return result

            # Get image and cloud connector
            image = image_repository.find_image_by_id(session, runner.image_id)
            cloud_connector = None

            if image and image.cloud_connector_id:
                cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                    session, image.cloud_connector_id
                )

            if not image or not image.cloud_connector_id or not cloud_connector:
                result["message"] = "Missing image or cloud connector information"
                return result

            # Store the instance ID for later use
            instance_id = runner.identifier

            # Create the cloud service while in the session scope
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            # Create history record for stop request
            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name="stop_requested",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "initiated_by": initiated_by,
                    "old_state": runner.state
                },
                created_by=initiated_by
            )

            # Update runner state to closed
            old_state = runner.state
            runner.state = "closed"

            # Add another history record for state change
            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name="state_changed",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "old_state": old_state,
                    "new_state": "closed",
                    "initiated_by": initiated_by
                },
                created_by=initiated_by
            )
            session.commit()

        # Now that we're outside the session scope, use the cloud service to stop the instance
        if cloud_service and instance_id:
            stop_result = await cloud_service.stop_instance(instance_id)
            logger.info(f"[{initiated_by}] Stop instance result for runner {runner_id}: {stop_result}")

            result = {
                "status": "success",
                "message": f"Runner {runner_id} stopped successfully",
                "state": "closed",
                "instance_state": stop_result,
                "initiated_by": initiated_by
            }
        else:
            result["message"] = "Failed to retrieve necessary information for stopping instance"

    except Exception as e:
        logger.error(f"[{initiated_by}] Error stopping runner {runner_id}: {e!s}")
        result["message"] = f"Error stopping runner: {e!s}"

    return result

async def start_runner(runner_id: int, initiated_by: str = "user") -> dict:
    """
    Start a stopped runner instance.

    This function transitions a runner from "closed" state to "ready" state
    and starts the underlying VM instance.

    Args:
        runner_id: The ID of the runner to start
        initiated_by: Identifier of who initiated the start operation

    Returns:
        A dictionary with the result of the start operation
    """
    logger.info(f"[{initiated_by}] Starting start operation for runner {runner_id}")
    result = {
        "status": "error",
        "message": "Unknown error occurred",
        "initiated_by": initiated_by
    }

    try:
        # Store needed information from the database session
        cloud_service = None
        instance_id = None

        # Find runner and validate state
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)

            # Handle validation cases
            if not runner:
                logger.error(f"[{initiated_by}] Runner with ID {runner_id} not found")
                result["message"] = f"Runner with ID {runner_id} not found"
                return result

            if runner.state != "closed":
                logger.info(f"[{initiated_by}] Cannot start runner with ID {runner_id} from {runner.state} state")
                result["message"] = f"Runner must be in 'closed' state to start, current state: {runner.state}"
                return result

            # Get image and cloud connector
            image = image_repository.find_image_by_id(session, runner.image_id)
            cloud_connector = None

            if image and image.cloud_connector_id:
                cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                    session, image.cloud_connector_id
                )

            if not image or not image.cloud_connector_id or not cloud_connector:
                result["message"] = "Missing image or cloud connector information"
                return result

            # Store the instance ID for later use
            instance_id = runner.identifier

            # Create the cloud service while in the session scope
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            # Create history record for start request
            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name="start_requested",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "initiated_by": initiated_by,
                    "old_state": runner.state
                },
                created_by=initiated_by
            )

            # Update runner state to ready
            old_state = runner.state
            runner.state = "ready"

            # Add another history record for state change
            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name="state_changed",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "old_state": old_state,
                    "new_state": "ready",
                    "initiated_by": initiated_by
                },
                created_by=initiated_by
            )
            session.commit()

        # Now that we're outside the session scope, use the cloud service to start the instance
        if cloud_service and instance_id:
            start_result = await cloud_service.start_instance(instance_id)
            logger.info(f"[{initiated_by}] Start instance result for runner {runner_id}: {start_result}")

            result = {
                "status": "success",
                "message": f"Runner {runner_id} started successfully",
                "state": "ready",
                "instance_state": start_result,
                "initiated_by": initiated_by
            }
        else:
            result["message"] = "Failed to retrieve necessary information for starting instance"

    except Exception as e:
        logger.error(f"[{initiated_by}] Error starting runner {runner_id}: {e!s}")
        result["message"] = f"Error starting runner: {e!s}"

    return result

def auth_runner(runner_id: int, runner_token: str):
    """Check the runner's hash against a provided auth token."""
    with Session(engine) as session:
        runner : Runner = runner_repository.find_runner_by_id(session, runner_id)
        return runner.external_hash == runner_token

def get_devserver(runner_id: int, port: int):
    """Form a devserver URL."""
    with Session(engine) as session:
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

# async def terminate_runner_logs(runner_id: int, initiated_by: str = "system") -> dict:
#     # curl -X DELETE http://34.223.156.189:9091/metrics/job/{runner_ip}
#     print("reached terminate_runner_logs")

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
    import urllib.request
    import urllib.error
    from http.client import HTTPResponse

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
                runner_url = runner.url

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

                try:
                    prometheus_host = os.environ.get("PROMETHEUS_PUSHGATEWAY_URL", "http://prometheus-pushgateway:9091")
                    prometheus_url = f"{prometheus_host}/metrics/job/{runner_url}"
                    # Create a DELETE request
                    req = urllib.request.Request(
                        url=prometheus_url,
                        method="DELETE"
                    )

                    # Set a timeout for the request
                    metrics_success = False
                    status_code = None
                    try:
                        # Open the request with a timeout
                        response = urllib.request.urlopen(req, timeout=5)
                        status_code = response.status
                        metrics_success = (status_code in (200, 202))
                        response.close()
                    except urllib.error.HTTPError as http_err:
                        status_code = http_err.code
                        logger.warning(f"[{initiated_by}] HTTP error deleting metrics: {http_err}")
                    except Exception as open_err:
                        logger.warning(f"[{initiated_by}] Error opening URL: {open_err}")

                    if metrics_success:
                        logger.info(f"[{initiated_by}] Successfully deleted metrics for runner {runner_id} ({runner_url})")

                        # Add a history record for the metrics deletion
                        metrics_history = RunnerHistory(
                            runner_id=runner.id,
                            event_name="prometheus_metrics_deleted",
                            event_data={
                                "timestamp": datetime.utcnow().isoformat(),
                                "initiated_by": initiated_by,
                                "prometheus_url": prometheus_url,
                                "status_code": status_code,
                                "context": "force_shutdown"
                            },
                            created_by="system",
                            modified_by="system"
                        )
                        session.add(metrics_history)
                        session.commit()

                        result["details"].append({"step": "delete_prometheus_metrics", "status": "success"})
                    else:
                        message = f"Failed with status code {status_code}" if status_code else "Failed to connect"
                        logger.warning(
                            f"[{initiated_by}] Failed to delete metrics for runner {runner_id} ({runner_url}). {message}"
                        )
                        result["details"].append({
                            "step": "delete_prometheus_metrics",
                            "status": "warning",
                            "message": message
                        })
                except Exception as metrics_error:
                    logger.warning(f"[{initiated_by}] Error deleting Prometheus metrics for runner {runner_id}: {metrics_error}")
                    result["details"].append({
                        "step": "delete_prometheus_metrics",
                        "status": "warning",
                        "message": str(metrics_error)
                    })

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
