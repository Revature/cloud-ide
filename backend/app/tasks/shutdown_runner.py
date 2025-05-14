"""Module for handling the shutdown of a runner instance."""

import asyncio
import logging
import traceback
from datetime import datetime
from celery import shared_task
from app.celery_app import celery_app
from app.db.database import engine
from sqlmodel import Session, select
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.models.image import Image
from app.models.script import Script
from app.models.cloud_connector import CloudConnector
from app.business import script_management, security_group_management
from app.business.cloud_services import cloud_service_factory
from app.db import runner_repository, image_repository, cloud_connector_repository, runner_history_repository

logger = logging.getLogger(__name__)

def validate_and_prepare_runner(runner_id, instance_id, initiated_by, result):
    """Validate runner exists and prepare necessary data for shutdown."""
    try:
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner:
                message = f"Runner with ID {runner_id} not found."
                logger.error(f"[{initiated_by}] {message}")
                result["status"] = "error"
                result["details"].append({"step": "find_runner", "status": "error", "message": message})
                return False, None

            # Set instance_id if not provided
            if not instance_id:
                instance_id = runner.identifier
                if not instance_id:
                    message = f"Runner {runner_id} has no instance identifier."
                    logger.error(f"[{initiated_by}] {message}")
                    result["status"] = "error"
                    result["details"].append({"step": "find_runner", "status": "error", "message": message})
                    return False, None

            # Get required resources for termination
            image = image_repository.find_image_by_id(session, runner.image_id)
            if not image:
                message = f"Image for runner {runner.id} not found."
                logger.error(f"[{initiated_by}] {message}")
                result["status"] = "error"
                result["details"].append({"step": "find_image", "status": "error", "message": message})
                return False, None

            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, image.cloud_connector_id)
            if not cloud_connector:
                message = f"Cloud connector for image {image.id} not found."
                logger.error(f"[{initiated_by}] {message}")
                result["status"] = "error"
                result["details"].append({"step": "find_cloud_connector", "status": "error", "message": message})
                return False, None

            # Return all necessary resources
            resources = {
                "runner": runner,
                "instance_id": instance_id,
                "image_id": runner.image_id,
                "cloud_connector_id": image.cloud_connector_id,
                "cloud_connector": cloud_connector,
                "cloud_service": cloud_service_factory.get_cloud_service(cloud_connector)
            }

            return True, resources
    except Exception as e:
        error_detail = str(e)
        tb_string = traceback.format_exc()
        logger.error(f"[{initiated_by}] Error during runner preparation: {error_detail}")
        logger.error(f"[{initiated_by}] Traceback: {tb_string}")
        result["status"] = "error"
        result["details"].append({"step": "prepare", "status": "error", "message": f"Error during preparation: {error_detail}"})
        return False, None

def update_runner_state(runner, old_state, new_state, initiated_by, event_name, event_data=None):
    """Update runner state and create history record."""
    try:
        with Session(engine) as session:
            # Find the runner again in this session
            runner_db = runner_repository.find_runner_by_id(session, runner.id)
            if not runner_db:
                logger.error(f"[{initiated_by}] Runner {runner.id} not found for state update")
                return False

            # Update state
            runner_db.state = new_state
            if new_state in ("closed", "terminated"):
                runner_db.ended_on = datetime.utcnow()

            runner_repository.update_runner(session, runner_db)

            # Create event data if not provided
            if event_data is None:
                event_data = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "old_state": old_state,
                    "new_state": new_state,
                    "initiated_by": initiated_by
                }

            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name=event_name,
                event_data=event_data,
                created_by="system"
            )

            session.commit()

            logger.info(f"[{initiated_by}] Runner {runner.id} state updated from {old_state} to {new_state}")
            return True
    except Exception as e:
        logger.error(f"[{initiated_by}] Error updating runner state: {e}")
        return False

def should_run_termination_script(runner, initiated_by, result):
    """Check if a termination script should be run for this runner."""
    try:
        with Session(engine) as session:
            # Skip script for certain states
            if not runner.should_run_terminate_script:
                logger.info(f"[{initiated_by}] Runner in {runner.state} state, skipping termination script")
                result["details"].append({
                    "step": "script_execution",
                    "status": "skipped",
                    "message": f"Runner in {runner.state} state, skipping termination script"
                })
                return False

            # Check if script exists
            stmt_script = select(Script).where(Script.event == "on_terminate", Script.image_id == runner.image_id)
            script = session.exec(stmt_script).first()

            if not script:
                logger.info(f"[{initiated_by}] No on_terminate script found for image {runner.image_id}, skipping script execution")
                result["details"].append({
                    "step": "script_execution",
                    "status": "skipped",
                    "message": f"No on_terminate script found for image {runner.image_id}"
                })
                return False

            return True
    except Exception as e:
        logger.error(f"[{initiated_by}] Error checking for termination script: {e}")
        result["details"].append({
            "step": "script_execution",
            "status": "error",
            "message": f"Error checking for termination script: {e}"
        })
        return False

def run_termination_script(runner_id, initiated_by, result):
    """Run the termination script on the runner."""
    try:
        logger.info(f"[{initiated_by}] Running on_terminate script for runner {runner_id}...")

        # Run the script with empty env_vars since credentials should be retrieved from the environment
        script_result = asyncio.run(script_management.run_script_for_runner(
            "on_terminate",
            runner_id,
            env_vars={},
            initiated_by=initiated_by
        ))

        logger.info(f"[{initiated_by}] Script executed for runner {runner_id}")
        logger.info(f"[{initiated_by}] Script result: {script_result}")

        result["details"].append({
            "step": "script_execution",
            "status": "success",
            "message": "on_terminate script executed"
        })
        return True
    except Exception as e:
        error_detail = str(e)
        tb_string = traceback.format_exc()
        logger.error(f"[{initiated_by}] Error executing on_terminate script for runner {runner_id}: {error_detail}")
        logger.error(f"[{initiated_by}] Traceback: {tb_string}")

        # Record the error but continue with termination
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            runner_history_repository.add_runner_history(
                session=session,
                runner=runner,
                event_name="script_error_on_terminate",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": error_detail,
                    "traceback": tb_string,
                    "initiated_by": initiated_by
                },
                created_by="system"
            )

            session.commit()

        result["details"].append({
            "step": "script_execution",
            "status": "error",
            "message": f"Error executing on_terminate script: {error_detail}"
        })

        logger.info(f"[{initiated_by}] Continuing with termination despite script error for runner {runner_id}")
        return False

def stop_instance(resources, initiated_by, result):
    """Stop the cloud instance and update runner state to 'closed'."""
    try:
        # Get a fresh cloud service
        with Session(engine) as session:
            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                session, resources["cloud_connector_id"]
            )
            if not cloud_connector:
                message = f"Cloud connector {resources['cloud_connector_id']} not found for stopping instance."
                logger.error(f"[{initiated_by}] {message}")
                result["details"].append({"step": "stop_instance", "status": "error", "message": message})
                return False

            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            # Stop the instance
            logger.info(f"[{initiated_by}] Stopping instance {resources['instance_id']} for runner {resources['runner'].id}")
            stop_state = asyncio.run(cloud_service.stop_instance(resources['instance_id']))
            logger.info(f"[{initiated_by}] Stop result for instance {resources['instance_id']}: {stop_state}")

            # Update runner state to 'closed'
            event_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "old_state": "terminating",
                "new_state": "closed",
                "stop_result": stop_state,
                "initiated_by": initiated_by
            }

            if update_runner_state(
                resources["runner"],
                "terminating",
                "closed",
                initiated_by,
                "runner_closed",
                event_data
            ):
                result["details"].append({
                    "step": "stop_instance",
                    "status": "success",
                    "message": "Instance stopped"
                })
                return True
            else:
                message = f"Failed to update runner {resources['runner'].id} state to 'closed'"
                logger.error(f"[{initiated_by}] {message}")
                result["details"].append({"step": "stop_instance", "status": "error", "message": message})
                return False
    except Exception as e:
        error_message = f"Error stopping instance {resources['instance_id']}: {e!s}"
        tb_string = traceback.format_exc()
        logger.error(f"[{initiated_by}] {error_message}")
        logger.error(f"[{initiated_by}] Traceback: {tb_string}")
        result["details"].append({"step": "stop_instance", "status": "error", "message": error_message})
        # Continue with termination even if stopping fails
        return False

def terminate_instance(resources, initiated_by, result, task=None):
    """Terminate the cloud instance and update runner state to 'terminated'."""
    try:
        # Get a fresh cloud service for termination
        with Session(engine) as session:
            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                session, resources["cloud_connector_id"]
            )
            if not cloud_connector:
                message = f"Cloud connector {resources['cloud_connector_id']} not found for terminating instance."
                logger.error(f"[{initiated_by}] {message}")
                result["details"].append({"step": "terminate_instance", "status": "error", "message": message})
                return False

            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            # Terminate the instance
            logger.info(f"[{initiated_by}] Terminating instance {resources['instance_id']} for runner {resources['runner'].id}")
            terminate_state = asyncio.run(cloud_service.terminate_instance(resources['instance_id']))
            logger.info(f"[{initiated_by}] Terminate result for instance {resources['instance_id']}: {terminate_state}")

            # Wait for instance to be terminated
            logger.info(f"[{initiated_by}] Waiting for instance {resources['instance_id']} to be terminated...")
            try:
                terminated = asyncio.run(cloud_service.wait_for_instance_terminated(resources['instance_id']))

                if terminated:
                    logger.info(f"[{initiated_by}] Instance {resources['instance_id']} is confirmed terminated")
                    result["details"].append({
                        "step": "wait_for_termination",
                        "status": "success",
                        "message": "Instance termination confirmed"
                    })
                else:
                    # Instance is in 'stopping' state, we should retry
                    message = f"Instance {resources['instance_id']} is in stopping state, will retry termination check"
                    logger.warning(f"[{initiated_by}] {message}")
                    result["details"].append({
                        "step": "wait_for_termination",
                        "status": "retry",
                        "message": message
                    })
                    # Retry with a longer delay if task is provided
                    if task:
                        raise task.retry(countdown=120)  # 2 minute delay
                    return False
            except Exception as e:
                if isinstance(e, task.retry) if task else False:
                    # If this is a retry exception, propagate it
                    raise

                error_message = f"Error waiting for instance {resources['instance_id']} to terminate: {e!s}"
                logger.error(f"[{initiated_by}] {error_message}")
                result["details"].append({
                    "step": "wait_for_termination",
                    "status": "error",
                    "message": error_message
                })
                return False

            # Update runner state to 'terminated'
            event_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "old_state": "closed",
                "new_state": "terminated",
                "terminate_result": terminate_state,
                "initiated_by": initiated_by
            }

            if update_runner_state(
                resources["runner"],
                "closed",
                "terminated",
                initiated_by,
                "runner_terminated",
                event_data
            ):
                result["details"].append({
                    "step": "terminate_instance",
                    "status": "success",
                    "message": "Instance terminated and runner state updated"
                })
                return True
            else:
                message = f"Failed to update runner {resources['runner'].id} state to 'terminated'"
                logger.error(f"[{initiated_by}] {message}")
                result["details"].append({
                    "step": "terminate_instance",
                    "status": "error",
                    "message": message
                })
                return False
    except Exception as e:
        error_message = f"Error in termination process for instance {resources['instance_id']}: {e!s}"
        tb_string = traceback.format_exc()
        logger.error(f"[{initiated_by}] {error_message}")
        logger.error(f"[{initiated_by}] Traceback: {tb_string}")
        result["status"] = "error"
        result["details"].append({
            "step": "terminate_process",
            "status": "error",
            "message": error_message
        })
        return False

async def terminate_runner_logs(runner_id: int, initiated_by: str = "system") -> dict:
    """
    Delete the Prometheus metrics for a runner when it's terminated.

    Args:
        runner_id: ID of the runner to delete metrics for
        initiated_by: String identifier of what triggered this action

    Returns:
        dict: Status information about the metrics deletion process
    """
    try:
        logger.info(f"[{initiated_by}] Deleting Prometheus metrics for runner {runner_id}")

        # Get the runner to access its IP address
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner or not runner.url:
                message = f"Runner {runner_id} not found or has no URL."
                logger.error(f"[{initiated_by}] {message}")
                return {"status": "error", "message": message}

            runner_ip = runner.url

            # Use urllib instead of requests to send the DELETE request to Prometheus Pushgateway
            import urllib.request
            import urllib.error
            import os

            # Get the Prometheus Pushgateway URL from environment variable or use default
            prometheus_host = os.environ.get("PROMETHEUS_PUSHGATEWAY_URL")
            if not prometheus_host:
                message = "PROMETHEUS_PUSHGATEWAY_URL environment variable not set"
                logger.error(f"[{initiated_by}] {message}")
                return {"status": "error", "message": message}

            prometheus_url = f"{prometheus_host}/metrics/job/{runner_ip}"

            # Create a DELETE request
            req = urllib.request.Request(
                url=prometheus_url,
                method="DELETE"
            )

            try:
                # Open the request with a timeout
                response = urllib.request.urlopen(req, timeout=5)
                status_code = response.status
                response_text = response.read().decode('utf-8')
                response.close()

                success_status_codes = [200, 202]
                if status_code in success_status_codes:
                    message = f"Successfully deleted metrics for runner {runner_id} ({runner_ip})"
                    logger.info(f"[{initiated_by}] {message}")

                    # Record the successful deletion in runner history
                    runner_history_repository.add_runner_history(
                        session=session,
                        runner=runner,
                        event_name="prometheus_metrics_deleted",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "initiated_by": initiated_by,
                            "prometheus_url": prometheus_url,
                            "status_code": status_code
                        },
                        created_by="system"
                    )

                    return {"status": "success", "message": message}
                else:
                    message = f"Failed to delete metrics for runner {runner_id} ({runner_ip}). Status code: {status_code}"
                    logger.error(f"[{initiated_by}] {message}")

                    # Record the failed deletion in runner history
                    runner_history_repository.add_runner_history(
                        session=session,
                        runner=runner,
                        event_name="prometheus_metrics_deletion_failed",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "initiated_by": initiated_by,
                            "prometheus_url": prometheus_url,
                            "status_code": status_code,
                            "response_text": response_text[:500] if response_text else None
                        },
                        created_by="system"
                    )

                    return {"status": "error", "message": message, "status_code": status_code}

            except Exception as e:
                message = f"Error deleting metrics for runner {runner_id} ({runner_ip}): {e!s}"
                logger.error(f"[{initiated_by}] {message}")

                # Record the error in runner history
                runner_history_repository.add_runner_history(
                    session=session,
                    runner=runner,
                    event_name="prometheus_metrics_deletion_error",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "initiated_by": initiated_by,
                        "error": str(e)
                    },
                    created_by="system"
                )

                return {"status": "error", "message": message}

    except Exception as e:
        error_message = f"Error deleting Prometheus metrics for runner {runner_id}: {e!s}"
        logger.error(f"[{initiated_by}] {error_message}")

        # Try to record the error in history if possible
        try:
            with Session(engine) as session:
                runner = runner_repository.find_runner_by_id(session, runner_id)
                if runner:
                    runner_history_repository.add_runner_history(
                        session=session,
                        runner=runner,
                        event_name="prometheus_metrics_deletion_error",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "initiated_by": initiated_by,
                            "error": str(e)
                        },
                        created_by="system"
                    )
        except Exception as history_error:
            logger.error(f"[{initiated_by}] Additional error recording history: {history_error!s}")

        return {"status": "error", "message": error_message}

def cleanup_security_groups(resources, initiated_by, result):
    """Clean up security groups associated with the terminated instance."""
    try:
        logger.info(f"[{initiated_by}] Cleaning up security groups for runner {resources['runner'].id}")

        # Get a fresh cloud service
        with Session(engine) as session:
            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                session, resources["cloud_connector_id"]
            )
            if not cloud_connector:
                message = f"Cloud connector {resources['cloud_connector_id']} not found for security group cleanup."
                logger.error(f"[{initiated_by}] {message}")
                result["details"].append({
                    "step": "security_group_cleanup",
                    "status": "error",
                    "message": message
                })
                return False

            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            security_group_result = asyncio.run(
                security_group_management.handle_runner_termination(resources['runner'].id, cloud_service)
            )

            if security_group_result:
                logger.info(f"[{initiated_by}] Successfully cleaned up security groups for runner {resources['runner'].id}")
                result["details"].append({
                    "step": "security_group_cleanup",
                    "status": "success",
                    "message": "Security groups cleaned up"
                })
                return True
            else:
                logger.warning(f"[{initiated_by}] Some security groups may not have been fully cleaned up for runner {resources['runner'].id}")
                result["details"].append({
                    "step": "security_group_cleanup",
                    "status": "warning",
                    "message": "Some security groups may require manual cleanup"
                })
                return False
    except Exception as e:
        error_message = f"Error cleaning up security groups for runner {resources['runner'].id}: {e!s}"
        tb_string = traceback.format_exc()
        logger.error(f"[{initiated_by}] {error_message}")
        logger.error(f"[{initiated_by}] Traceback: {tb_string}")
        result["details"].append({
            "step": "security_group_cleanup",
            "status": "error",
            "message": error_message
        })
        return False

def update_to_terminating_state(resources, initiated_by, result):
    """Update runner state to 'terminating' if not already in that state."""
    old_state = resources["runner"].state

    # Only update if not already in terminating or terminated state
    if old_state not in ["terminating", "terminated"]:
        if update_runner_state(
            resources["runner"],
            old_state,
            "terminating",
            initiated_by,
            "runner_terminating"
        ):
            logger.info(f"[{initiated_by}] Runner {resources['runner'].id} state updated from {old_state} to terminating")
            result["details"].append({
                "step": "update_state",
                "status": "success",
                "message": "Runner changed to terminating state"
            })
            return True, old_state
        else:
            message = f"Failed to update runner {resources['runner'].id} state to 'terminating'"
            logger.error(f"[{initiated_by}] {message}")
            result["details"].append({
                "step": "update_state",
                "status": "error",
                "message": message
            })
            return False, old_state
    else:
        logger.info(f"[{initiated_by}] Runner {resources['runner'].id} already in {old_state} state, no update needed")
        result["details"].append({
            "step": "update_state",
            "status": "success",
            "message": f"Runner already in {old_state} state"
        })
        return True, old_state

@celery_app.task(bind=True, name="app.tasks.shutdown_runner.process_runner_shutdown")
def process_runner_shutdown(self, runner_id: int, instance_id: str, initiated_by: str = "system"):
    """
    Complete task that handles the entire runner shutdown process.

    1. Update runner state to "terminating"
    2. Run termination scripts if they exist
    3. Stop and terminate the instance
    4. Wait for termination to complete
    5. Delete Prometheus metrics (moved after instance termination)
    6. Clean up security groups
    7. Update runner state to "terminated"

    Args:
        runner_id: ID of the runner to shut down
        instance_id: Optional instance ID (will be fetched from runner if not provided)
        initiated_by: String identifier of what triggered this shutdown

    Returns:
        dict: Status information about the shutdown process
    """
    logger.info(f"[{initiated_by}] Starting shutdown process for runner {runner_id}")
    result = {"runner_id": runner_id, "status": "success", "details": [], "initiated_by": initiated_by}

    # Step 1: Validate and prepare resources
    valid, resources = validate_and_prepare_runner(runner_id, instance_id, initiated_by, result)
    if not valid:
        return result

    # Step 2: Update runner state to terminating
    state_updated, old_state = update_to_terminating_state(resources, initiated_by, result)

    # Step 3: Run termination script if needed
    if should_run_termination_script(resources["runner"], initiated_by, result):
        run_termination_script(runner_id, initiated_by, result)

    # Step 4: Stop the instance and update state to closed
    stop_instance(resources, initiated_by, result)

    # Step 5: Terminate the instance and update state to terminated
    termination_success = terminate_instance(resources, initiated_by, result, self)

    # Step 6: Delete Prometheus metrics (moved after instance termination)
    # Only proceed with metrics deletion if the instance was successfully terminated
    if termination_success:
        try:
            metrics_result = asyncio.run(terminate_runner_logs(runner_id, initiated_by))
            result["details"].append({
                "step": "delete_prometheus_metrics",
                "status": metrics_result.get("status", "error"),
                "message": metrics_result.get("message", "Unknown error deleting metrics")
            })
            logger.info(f"[{initiated_by}] Prometheus metrics deletion result: {metrics_result}")
        except Exception as e:
            logger.error(f"[{initiated_by}] Error in Prometheus metrics deletion: {e}")
            result["details"].append({
                "step": "delete_prometheus_metrics",
                "status": "error",
                "message": f"Error deleting Prometheus metrics: {e!s}"
            })
    else:
        # Log that metrics deletion was skipped due to termination failure
        message = "Skipping Prometheus metrics deletion due to instance termination failure"
        logger.warning(f"[{initiated_by}] {message}")
        result["details"].append({
            "step": "delete_prometheus_metrics",
            "status": "skipped",
            "message": message
        })

    # Step 7: Clean up security groups
    cleanup_security_groups(resources, initiated_by, result)

    logger.info(f"[{initiated_by}] Completed shutdown process for runner {runner_id}")
    return result
