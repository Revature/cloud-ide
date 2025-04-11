"""Runners API routes."""

import os
from fastapi import APIRouter, Depends, HTTPException, Header, status, Body, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
from app.api import http
from app.db.database import get_session
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.models.image import Image
from app.schemas.runner import ExtendSessionRequest
from app.business import key_management, runner_management, script_management, terminal_management
from app.db import runner_repository
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=list[Runner])
def read_runners(session: Session = Depends(get_session)):
    """Retrieve a list of all Runners."""
    runners = runner_repository.find_all_runners(session)
    if not runners:
        raise HTTPException(status_code=204, detail="No runners found")
    return runners

@router.get("/{runner_id}", response_model=Runner)
def read_runner(runner_id: int, session: Session = Depends(get_session)):
    """Retrieve a single Runner by ID."""
    runner = runner_repository.find_runner_by_id(session, runner_id)
    if not runner:
        raise HTTPException(status_code=400, detail="Runner not found")
    return runner

# change this to use runner id in url
@router.put("/extend_session", response_model=str)
def extend_runner_session(
    extend_req: ExtendSessionRequest,
    session: Session = Depends(get_session),
    access_token: str = Header(..., alias="Access-Token")
    ):
    """Update a runner's session_end by adding extra time."""
    runner = runner_repository.find_runner_by_id(session, extend_req.runner_id)
    if not runner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Runner not found"
        )

    # Calculate the new session_end by adding extra_time.
    extension = timedelta(minutes=extend_req.extra_time)
    new_session_end = runner.session_end + extension

    # Check that total session duration does not exceed 3 hours.
    total_duration = new_session_end - runner.session_start
    if total_duration > timedelta(hours=3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extension would exceed maximum allowed session time of 3 hours."
        )

    # Save the old session_end for history logging.
    old_session_end = runner.session_end

    # Update the runner's session_end.
    runner.session_end = new_session_end
    session.add(runner)

    # Create a new runner_history record logging this extension event.
    event_data = {
        "extra_time": extend_req.extra_time,
        "old_session_end": old_session_end.isoformat(),
        "new_session_end": new_session_end.isoformat()
    }
    new_history = RunnerHistory(
        runner_id=runner.id,
        event_name="session_extension",
        event_data=event_data,
        created_by="system",  # or the authenticated user's identifier
        modified_by="system"
    )
    session.add(new_history)

    session.commit()
    session.refresh(runner)
    return "Session extended successfully"

class RunnerStateUpdate(BaseModel):
    """Request model for updating the runner state."""

    runner_id: int
    state: str

#todo use runner_id in url
@router.put("/{runner_id}/state", response_model=str)
async def update_runner_state(
    update: RunnerStateUpdate = Body(...),
    session: Session = Depends(get_session),
    access_token: str = Header(..., alias="Access-Token"),
    x_forwarded_for: Optional[str] = Header(None),
    client_ip: Optional[str] = Header(None)
):
    """
    Endpoint for Theia to report state changes.

    The request should include:
      - runner_id: The ID of the runner
      - state: The new state

    For each state update, a RunnerHistory record is created. Additionally,
    if the state change corresponds to one of our script events, the corresponding
    script is executed on the runner.

    Allowed states:
      - runner_starting → on_create script
      - ready         → no script
      - awaiting_client → on_awaiting_client script
      - active        → on_connect script
    """
    runner = runner_repository.find_runner_by_id(session, update.runner_id)
    if not runner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Runner not found")

    # Check if the request is coming from a trusted service
    if access_token and access_token != os.getenv("JWT_SECRET"):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized access. This endpoint can only be accessed from trusted services."
        )

    # Validate the state is one of the allowed values
    allowed_states = ["runner_starting",
                      "app_starting",
                      "ready",
                      "runner_starting_claimed",
                      "ready_claimed",
                      "awaiting_client",
                      "active",
                      "disconnecting"]
    if update.state not in allowed_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state: {update.state}. Allowed states are: {', '.join(allowed_states)}"
        )

    stmt = select(Runner).where(Runner.id == update.runner_id)
    runner = session.exec(stmt).first()
    if not runner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Runner not found")

    # Prepare common event_data.
    event_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "new_state": update.state
    }

    script_event = None

    # Map runner state to script event.
    if update.state == "app_starting":
        runner.state = "app_starting"
        event_name = "app_starting"
        script_event = "on_create"
    elif update.state == "ready":
        runner.state = "ready"
        event_name = "runner_ready"
    elif update.state == "runner_starting_claimed":
        runner.state = "runner_starting_claimed"
        event_name = "runner_starting_claimed"
    elif update.state == "ready_claimed":
        runner.state = "ready_claimed"
        event_name = "runner_ready_claimed"
    elif update.state == "active":
        runner.state = "active"
        event_name = "runner_active"
        script_event = "on_connect"
    elif update.state == "disconnecting":
        runner.state = "disconnecting"
        event_name = "runner_disconnecting"
        script_event = "on_disconnect"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state: {update.state}"
        )

    # Update the runner.
    session.add(runner)
    session.commit()
    session.refresh(runner)

    new_history = RunnerHistory(
        runner_id=runner.id,
        event_name=event_name,
        event_data=event_data,
        created_by="system",
        modified_by="system"
    )
    session.add(new_history)
    session.commit()

    # Execute the script for this event if applicable.
    if script_event:
        try:
            # For on_awaiting_client, we need env_vars which we don't have here
            # For other events, empty env_vars is fine
            script_result = await script_management.run_script_for_runner(script_event, runner.id, env_vars={}, initiated_by="update_runner_state_endpoint")
            if script_result:
                logger.info(f"Script executed for runner {runner.id}: {script_result}")
        except Exception as e:
            # Get detailed error information
            error_detail = str(e)
            logger.error(f"Error executing script for runner {runner.id}: {error_detail}")

            # Format traceback as string if it exists
            import traceback
            tb_string = ""
            if hasattr(e, "__traceback__"):
                tb_string = "".join(traceback.format_tb(e.__traceback__))

            # Log the error in history with enhanced details
            error_history = RunnerHistory(
                runner_id=runner.id,
                event_name=f"script_error_{script_event}",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": error_detail,
                    "traceback": tb_string,
                    "initiated_by": "update_runner_state_endpoint"
                },
                created_by="system",
                modified_by="system"
            )
            session.add(error_history)
            session.commit()

            # Continue execution despite script error
            logger.info(f"Continuing with runner state update despite script error for runner {runner.id}")

    return f"State for runner {runner.id} updated to {runner.state}"

@router.delete("/{runner_id}", response_model=dict[str, str])
async def terminate_runner(
    runner_id: int,
    session: Session = Depends(get_session),
    access_token: str = Header(..., alias="Access-Token")
):
    """
    Manually terminate a runner.

    This endpoint will:
    1. Run the on_terminate script to save changes to GitHub
    2. Stop and terminate the EC2 instance
    3. Update the runner state to terminated

    If the image has a runner pool, a new runner will be launched to replace this one.
    """
    # Check if the runner exists
    runner = runner_repository.find_runner_by_id(session, runner_id)
    # Delete is idempotent, if no runner exists, just return.
    if not runner:
        return

    # Get the image to check if it has a runner pool
    image_id = runner.image_id
    image = session.get(Image, image_id)
    needs_replenishing = image and image.runner_pool_size > 0 and runner.state == "ready"
    image_identifier = image.identifier if image else None

    # Call the terminate_runner function from runner_management.py
    result = await runner_management.terminate_runner(runner_id, initiated_by="manual_termination_endpoint")

    # Check for various error conditions with specific messages
    if result["status"] == "error":
        # Check for specific error types in the details
        if "details" in result and isinstance(result["details"], dict):
            # Script execution errors
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["details"].get("message", "Unknown error during runner termination queueing")
            )

        # Default error case
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("message", "Unknown error during runner termination")
        )

    # If the image has a runner pool, launch a new runner to replace this one
    if needs_replenishing and image_identifier:
        try:
            # Launch a new runner asynchronously
            asyncio.create_task(runner_management.launch_runners(image_identifier, 1, initiated_by="manual_termination_endpoint_pool_replenish"))
            return {"status": "success", "message": "Runner termination queued and replacement launched"}
        except Exception as e:
            # If launching the replacement fails, log it but don't fail the termination
            # print(f"Error launching replacement runner: {e}")
            return {"status": "partial_success", "message": "Runner termination queued but failed to launch replacement"}

    return {"status": "success", "message": "Runner termination queued"}


# Store active connections
active_connections: dict[int, dict] = {}

@router.websocket("/connect/{runner_id}")
async def websocket_terminal(
    websocket: WebSocket,
    runner_id: int,
    session: Session = Depends(get_session),
):
    await websocket.accept()
    
    try:
        # Get runner and validate it's available
        runner = runner_repository.find_runner_by_id(session, runner_id)
        if not runner or runner.status not in ["ready", "active", "awaiting_client"]:
            await websocket.close(code=1008, reason="Runner not available")
            return
            
        # Connect terminal (delegated to service)
        await terminal_management.connect_terminal(websocket, runner)

    except Exception as e:
        logger.error(f"Terminal connection error: {str(e)}")
        await websocket.close(code=1011, reason=f"Unexpected error: {str(e)}")
