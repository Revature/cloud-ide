"""Module for managing scripts and running them on runners via SSH."""

import json
from sqlmodel import Session, select
from celery.utils.log import get_task_logger
from app.db.database import engine
from app.models import Runner, RunnerHistory, Script, Image
from app.models.cloud_connector import CloudConnector
from app.business.cloud_services import cloud_service_factory
from app.business import key_management, encryption, runner_management
from app.exceptions.runner_exceptions import RunnerExecException
from app.db import script_repository, runner_repository, runner_history_repository, image_repository
from app.util import constants
from datetime import datetime, timezone
import time
import jinja2
import asyncio
from typing import Any, Optional
import re

logger = get_task_logger(__name__)

VALID_EVENTS = [
    "on_create",
    "on_awaiting_client",
    "on_connect",
    "on_disconnect",
    "on_terminate"
]

def render_script(template: str, context: dict) -> str:
    """
    Render the script template using the provided context.

    Uses Jinja2 for templating.
    """
    jinja_template = jinja2.Template(template)
    return jinja_template.render(**context)

def parse_script_output(stdout: str, stderr: str, exit_code: int) -> dict:
    """
    Parse the script output and extract structured status information.

    Looks for specific patterns in stdout/stderr to determine success/failure
    and extract relevant error messages.

    Args:
        stdout: The standard output from the script
        stderr: The standard error from the script
        exit_code: The exit code from the script

    Returns:
        A dictionary with parsed output information
    """
    result = {
        "success": exit_code == 0,
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "error_message": None,
        "detailed_status": None
    }

    # Extract specific error messages
    error_pattern = re.compile(r"ERROR: (.*)")
    success_pattern = re.compile(r"SUCCESS: (.*)")

    # Check stderr first for ERROR messages
    error_matches = error_pattern.findall(stderr)
    if error_matches:
        result["error_message"] = error_matches[0]
        result["detailed_status"] = "error"
    elif not result["success"]:
        # If exit code indicates failure but no specific ERROR pattern
        # was found, use the entire stderr as the error message
        result["error_message"] = stderr.strip() if stderr else "Unknown error occurred"
        result["detailed_status"] = "error"

    # Check stdout for SUCCESS messages
    success_matches = success_pattern.findall(stdout)
    if success_matches and result["success"]:
        result["detailed_status"] = "success"
    elif result["success"]:
        result["detailed_status"] = "success"

    # TODO: Do we need this? This is use-case specific
    # Extract additional contextual information
    operations = []
    if "Cloning repository" in stdout:
        operations.append("repository_clone")
    if "Git hooks configured" in stdout:
        operations.append("hooks_configured")

    result["operations"] = [*result.get("operations", []), *operations]

    return result

def get_script_for_runner(
    event: str,
    runner_id: int,
    env_vars: Optional[dict[str, Any]] = None,
    initiated_by: str = "system"
) -> str:
    """
    Retrieve and render a relevant script given event and runner data.

    Args:
        event: The event name that triggers the script (e.g., "on_awaiting_client")
        runner_id: The ID of the runner to execute the script on
        env_vars: Optional dictionary of environment variables that should not be stored in the database
        initiated_by: Identifier of the service/job that initiated the script execution

    Returns:
        A dictionary with script output and error information.
    """
    logger.info(f"[{initiated_by}] Starting script execution '{event}' for runner {runner_id}")

    # Create a new session for lookup.
    # TODO: Join instead of multiple queries
    runner : Runner = runner_repository.find_runner_by_id(runner_id)
    if not runner:
        logger.error(f"[{initiated_by}] Runner {runner_id} not found for script execution")
        raise RunnerExecException(f"Runner {runner_id} not found")

    # Query for the script corresponding to the event and runner's image.
    script = script_repository.find_script_by_event_and_image_id(event, runner.image_id)
    if not script:
        logger.error(f"[{initiated_by}] No script found for event '{event}' and image {runner.image_id}")
        return None
    runner_history_repository.add_runner_history(
                                                    runner=runner,
                                                    event_name=f"script_execution_{event}",
                                                    event_data={
                                                "script_id": script.id,
                                                "event": event,
                                                "initiated_by": initiated_by,
                                                "runner_state": runner.state,
                                                "has_env_vars": bool(env_vars)
                                                }, created_by=initiated_by)

    # Create the base context using the runner's env_data
    template_context = {}
    # Add runner's stored env_data (script_vars) to the context
    if runner.env_data:
        template_context.update(runner.env_data)
    template_context["env_vars"] = env_vars or {}
    # Render the script template using the context
    rendered_script = render_script(script.script, template_context)
    logger.info(f"[{initiated_by}] Rendered script for '{event}' on runner {runner_id}")
    return rendered_script

async def execute_script_for_runner(
    event: str,
    runner_id: int,
    script:str,
    initiated_by: str = "system"
) -> dict[str, Any]:
    """Given a runner and a rendered script, execute the script."""
    script_start_time = datetime.now(timezone.utc)
    runner = runner_management.get_runner_by_id(runner_id)
    # Retrieve the private key using runner.key_id.
    private_key = key_management.get_runner_key(runner.key_id)
    try:
        # Get cloud connector from image from runner
        with Session(engine) as session:
            image = session.get(Image, runner.image_id)
            cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
            if not cloud_connector:
                logger.error(f"[{initiated_by}] Cloud connector not found for image {runner.image_id}")
                raise Exception("Cloud connector not found")
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            logger.info(f"[{initiated_by}] Executing script '{event}' on runner {runner_id} via SSH")

            # For complex scripts with heredocs and quotes, using base64 encoding is safer
            # Encode the script as base64 and decode it on the runner
            import base64
            encoded_script = base64.b64encode(script.encode('utf-8')).decode('utf-8')

            temp_script = f"""#!/bin/bash
# Decode the base64 encoded script and execute it with sudo
echo '{encoded_script}' | base64 -d > /tmp/runner_script.sh
chmod +x /tmp/runner_script.sh
sudo /tmp/runner_script.sh
"""
            # Execute the script
            ssh_result = await cloud_service.ssh_run_script(
                runner.url,
                private_key,
                temp_script
            )

            # print(f"[DEBUG] SSH result: {ssh_result}")
            logger.info(f"[{initiated_by}] SSH result: {ssh_result}")

            # Parse the output to get detailed status information
            result = parse_script_output(
                ssh_result.get("stdout", ""),
                ssh_result.get("stderr", ""),
                ssh_result.get("exit_code", 1)
            )

            # Merge the parsed result with the SSH result
            result.update({k: v for k, v in ssh_result.items() if k not in result})

            # Record the script execution result
            execution_duration = (datetime.now(timezone.utc) - script_start_time).total_seconds()

            # Extract non-sensitive output data for logging
            sanitized_result = {
                "exit_code": result.get("exit_code", None),
                "success": result.get("success", False),
                "detailed_status": result.get("detailed_status", "unknown"),
                "error_message": result.get("error_message", None),
                "duration_seconds": execution_duration,
                "operations": result.get("operations", [])
            }

            log_level = "info" if result.get("success", False) else "error"
            getattr(logger, log_level)(
                f"[{initiated_by}] Script '{event}' on runner {runner_id} "
                f"completed with status: {sanitized_result['detailed_status']}"
            )

            if not result.get("success", False):
                logger.error(
                    f"[{initiated_by}] Script error: {result.get('error_message', 'Unknown error')}"
                )

            # Create a script result history record
            script_result_record = RunnerHistory(
                runner_id=runner_id,
                event_name=f"script_result_{event}",
                event_data={
                    "event": event,
                    "initiated_by": initiated_by,
                    "result": sanitized_result,
                    "duration_seconds": execution_duration,
                    # Store stdout/stderr only if they are reasonably sized
                    "stdout": result.get("stdout", "")[:1000] if result.get("stdout") else "",
                    "stderr": result.get("stderr", "")[:1000] if result.get("stderr") else "",
                    "exit_code": result.get("exit_code", None),
                    "detailed_status": result.get("detailed_status", "unknown"),
                    "error_message": result.get("error_message", None),
                    "operations": result.get("operations", [])
                },
                created_by=initiated_by,
                modified_by=initiated_by
            )

            session.add(script_result_record)
            session.commit()

            # If script failed, raise an exception to ensure it's handled properly
            if not result.get("success", False):
                error_msg = result.get("error_message", "Unknown script execution error")
                raise Exception(f"Script execution failed: {error_msg}")

            return result

    except Exception as e:
        error_message = f"Error executing script '{event}' on runner {runner_id}: {e!s}"
        # print(f"{e!s}")
        logger.error(f"[{initiated_by}] {error_message}")

        # Record the script execution error

        runner_history_repository.add_runner_history(
            runner=runner,
            event_name=f"script_error_{event}",
            event_data={
                "event": event,
                "initiated_by": initiated_by,
                "error": str(e),
                "duration_seconds": (datetime.now(timezone.utc) - script_start_time).total_seconds()
            }, created_by=initiated_by)

        raise Exception(error_message) from e

async def run_script_for_runner(
    event: str,
    runner_id: int,
    env_vars: Optional[dict[str, Any]] = None,
    initiated_by: str = "system"):
    """Locate and execute the script on a runner."""
    script : str = get_script_for_runner(event=event, runner_id=runner_id, env_vars=env_vars, initiated_by=initiated_by)
    if script:
        result = await execute_script_for_runner(event=event, runner_id=runner_id, script=script, initiated_by=initiated_by)
        return result
    return None

async def run_custom_script_for_runner(
    runner_id: int,
    script_path: str,
    env_vars: Optional[dict[str, Any]] = None,
    script_name: str = "custom_script",
    initiated_by: str = "system"
) -> dict[str, Any]:
    """
    Run a custom script file on a runner.

    Args:
        runner_id: The ID of the runner to execute the script on
        script_path: Path to the script file to execute
        env_vars: Optional dictionary of environment variables to pass to the script
        initiated_by: Identifier of the service/job that initiated the script execution

    Returns:
        A dictionary with script output and error information.
    """
    logger.info(f"[{initiated_by}] Starting custom script execution from '{script_path}' for runner {runner_id}")
    script_start_time = datetime.now(timezone.utc)

    try:
        # Read the script content from the file
        with open(script_path) as file:
            script_content = file.read()

        runner = runner_management.get_runner_by_id(runner_id)

        # Create a template context if env_vars are provided
        if env_vars:
            template_context = {"env_vars": env_vars}
            script_content = render_script(script_content, template_context)

        # Execute the script on the runner
        result = await execute_script_for_runner(
            event=script_name,
            runner_id=runner_id,
            script=script_content,
            initiated_by=initiated_by
        )

        # Add script path to the result for reference
        result["script_path"] = script_path

        # Record the custom script execution in runner history
        runner_obj = runner_repository.find_runner_by_id(runner_id)
        if runner_obj:
            runner_history_repository.add_runner_history(
                runner=runner_obj,
                event_name=f"{script_name}_executed",
                event_data={
                    "script_path": script_path,
                    "initiated_by": initiated_by,
                    "success": result.get("success", False),
                    "exit_code": result.get("exit_code", None),
                    "duration_seconds": (datetime.now(timezone.utc) - script_start_time).total_seconds()
                },
                created_by=initiated_by
            )

        return result

    except Exception as e:
        error_message = f"Error executing custom script '{script_path}' on runner {runner_id}: {e!s}"
        logger.error(f"[{initiated_by}] {error_message}")

        # Record the script execution error
        runner = runner_repository.find_runner_by_id(runner_id)
        if runner:
            runner_history_repository.add_runner_history(
                runner=runner,
                event_name="custom_script_error",
                event_data={
                    "script_path": script_path,
                    "initiated_by": initiated_by,
                    "error": str(e),
                    "duration_seconds": (datetime.now(timezone.utc) - script_start_time).total_seconds()
                },
                created_by=initiated_by
            )

        raise Exception(error_message) from e

def get_all_scripts() -> list[Script]:
    """Get all scripts."""
    return script_repository.find_all_scripts()

def get_script_by_id(script_id: int) -> Optional[Script]:
    """Get a script by ID."""
    return script_repository.find_script_by_id(script_id)

def get_scripts_by_image_id(image_id: int) -> list[Script]:
    """Get all scripts associated with a specific image."""
    return script_repository.find_scripts_by_image_id(image_id)

def create_script(
    name: str,
    description: str,
    event: str,
    image_id: int,
    script: str
) -> Script:
    """Create a new script."""
    # Validation
    if not name:
        raise ValueError("Script name is required")

    if event not in VALID_EVENTS:
        valid_events_str = ", ".join(VALID_EVENTS)
        raise ValueError(f"Invalid event type. Must be one of: {valid_events_str}")

    image = image_repository.find_image_by_id(image_id)
    if not image:
        raise ValueError(f"Image with ID {image_id} not found")

    # Check if a script with the same event already exists for this image
    existing_script = script_repository.find_script_by_event_and_image_id(event, image_id)
    if existing_script:
        raise ValueError(f"A script for event '{event}' already exists for this image")

    # Create new script object
    new_script = Script(
        name=name,
        description=description,
        event=event,
        image_id=image_id,
        script=script
    )

    # Save to database
    return script_repository.create_script(new_script)


def update_script(script_id: int, update_data: dict[str, Any]) -> Script:
    """Update an existing script."""
    # Get existing script
    script = script_repository.find_script_by_id(script_id)
    if not script:
        raise ValueError(f"Script with ID {script_id} not found")

    # Validate event if it's being updated
    if 'event' in update_data and update_data['event'] not in VALID_EVENTS:
        valid_events_str = ", ".join(VALID_EVENTS)
        raise ValueError(f"Invalid event type. Must be one of: {valid_events_str}")

    # Update script
    return script_repository.update_script(script_id, update_data)

def delete_script(script_id: int) -> bool:
    """Delete a script."""
    return script_repository.delete_script(script_id)
