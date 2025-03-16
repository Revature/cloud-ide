"""Module for managing scripts and running them on runners via SSH."""

from sqlmodel import Session, select
from app.db.database import engine
from app.models.runner import Runner
from app.models.image import Image
from app.models.script import Script
from app.models.cloud_connector import CloudConnector
from app.business.cloud_services.factory import get_cloud_service
from datetime import datetime
import jinja2
import asyncio
from typing import Any, Optional

def render_script(template: str, context: dict) -> str:
    """
    Render the script template using the provided context.

    Uses Jinja2 for templating.
    """
    jinja_template = jinja2.Template(template)
    return jinja_template.render(**context)

def get_runner_key(runner_key_id: int) -> str:
    """
    Retrieve and decrypt the private key for the given runner's key record.

    Assumes there is a function get_key_by_id in key_management and a decrypt_text function.
    """
    from app.business.key_management import get_key_by_id  # Local import to avoid circular imports
    from app.business.encryption import decrypt_text

    key_record = get_key_by_id(runner_key_id)
    if not key_record:
        raise Exception("Key record not found")
    # Decrypt the key using the master encryption key.
    return decrypt_text(key_record.encrypted_key)

async def run_script_for_runner(
    event: str,
    runner_id: int,
    env_vars: Optional[dict[str, Any]] = None,
    initiated_by: str = "system"
) -> dict[str, str]:
    """
    Run scripts on runner based on event hook.

    Retrieve the script for the given event and runner's image,
    render it using the runner's env_data as context plus additional env_vars (if provided),
    and use SSH to run the script on the runner.

    Args:
        event: The event name that triggers the script (e.g., "on_awaiting_client")
        runner_id: The ID of the runner to execute the script on
        env_vars: Optional dictionary of environment variables that should not be stored in the database
        initiated_by: Identifier of the service/job that initiated the script execution

    Returns:
        A dictionary with script output and error information.
    """
    from app.models.runner_history import RunnerHistory
    from celery.utils.log import get_task_logger

    logger = get_task_logger(__name__)
    script_start_time = datetime.utcnow()

    logger.info(f"[{initiated_by}] Starting script execution '{event}' for runner {runner_id}")

    # Create a new session for lookup.
    with Session(engine) as session:
        runner = session.get(Runner, runner_id)
        if not runner:
            logger.error(f"[{initiated_by}] Runner {runner_id} not found for script execution")
            raise Exception("Runner not found")

        # Explicitly load the image if not already loaded
        image = session.get(Image, runner.image_id)
        if not image:
            logger.error(f"[{initiated_by}] Image not found for runner {runner_id}")
            raise Exception(f"Image not found for runner {runner_id}")

        # Query for the script corresponding to the event and runner's image.
        stmt = select(Script).where(Script.event == event, Script.image_id == runner.image_id)
        script_record = session.exec(stmt).first()
        if not script_record:
            logger.error(f"[{initiated_by}] No script found for event '{event}' and image {runner.image_id}")
            raise Exception(f"No script found for event '{event}' and image {runner.image_id}")

        # Record the script execution in history
        script_execution_record = RunnerHistory(
            runner_id=runner_id,
            event_name=f"script_execution_{event}",
            event_data={
                "timestamp": script_start_time.isoformat(),
                "script_id": script_record.id,
                "event": event,
                "initiated_by": initiated_by,
                "runner_state": runner.state,
                "has_env_vars": bool(env_vars)
            },
            created_by=initiated_by,
            modified_by=initiated_by
        )
        session.add(script_execution_record)
        session.commit()

        # Create the base context using the runner's env_data
        template_context = {}

        # Add runner's stored env_data (script_vars) to the context
        if runner.env_data:
            template_context.update(runner.env_data)

        # Add the env_vars to the context if provided, but in a separate namespace
        if env_vars:
            template_context["env_vars"] = env_vars

        # Render the script template using the context
        rendered_script = render_script(script_record.script, template_context)

        logger.info(f"[{initiated_by}] Rendered script for '{event}' on runner {runner_id}")

    try:
        # Retrieve the private key using runner.key_id.
        private_key = get_runner_key(runner.key_id)

        # Get cloud connector from image from runner
        with Session(engine) as session:
            image = session.get(Image, runner.image_id)
            cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
            if not cloud_connector:
                logger.error(f"[{initiated_by}] Cloud connector not found for image {runner.image_id}")
                raise Exception("Cloud connector not found")

            cloud_service = get_cloud_service(cloud_connector)

            logger.info(f"[{initiated_by}] Executing script '{event}' on runner {runner_id} via SSH")
            result = await cloud_service.ssh_run_script(runner.url, private_key, rendered_script)

            # Record the script execution result
            execution_duration = (datetime.utcnow() - script_start_time).total_seconds()

            # Extract non-sensitive output data for logging
            sanitized_result = {
                "exit_code": result.get("exit_code", None),
                "success": result.get("success", False),
                "duration_seconds": execution_duration
            }

            logger.info(f"[{initiated_by}] Script '{event}' on runner {runner_id} completed with status: {sanitized_result}")

            # Create a script result history record
            script_result_record = RunnerHistory(
                runner_id=runner_id,
                event_name=f"script_result_{event}",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "script_id": script_record.id,
                    "event": event,
                    "initiated_by": initiated_by,
                    "result": sanitized_result,
                    "duration_seconds": execution_duration,
                    # Store stdout/stderr only if they are reasonably sized
                    "stdout": result.get("stdout", "")[:1000] if result.get("stdout") else "",
                    "stderr": result.get("stderr", "")[:1000] if result.get("stderr") else "",
                    "exit_code": result.get("exit_code", None)
                },
                created_by=initiated_by,
                modified_by=initiated_by
            )

            session.add(script_result_record)
            session.commit()

            return result

    except Exception as e:
        error_message = f"Error executing script '{event}' on runner {runner_id}: {e!s}"
        logger.error(f"[{initiated_by}] {error_message}")

        # Record the script execution error
        with Session(engine) as session:
            script_error_record = RunnerHistory(
                runner_id=runner_id,
                event_name=f"script_error_{event}",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "script_id": script_record.id if script_record else None,
                    "event": event,
                    "initiated_by": initiated_by,
                    "error": str(e),
                    "duration_seconds": (datetime.utcnow() - script_start_time).total_seconds()
                },
                created_by=initiated_by,
                modified_by=initiated_by
            )
            session.add(script_error_record)
            session.commit()

        raise Exception(error_message) from e
