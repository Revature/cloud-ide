"""Theia request API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.database import get_session
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.business.script_management import run_script_for_runner  # Script management layer
import logging

router = APIRouter()

logger = logging.getLogger(__name__)

class RunnerStateUpdate(BaseModel):
    """Request model for the update_state endpoint."""

    runner_id: int
    state: str  # e.g., "runner_starting", "ready", "awaiting_client", "active"

@router.post("/update_state", response_model=Runner)
async def update_runner_state_endpoint(
    update: RunnerStateUpdate,
    session: Session = Depends(get_session)
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
    logger.info(f"Received state update for runner {update.runner_id}: {update.state}")

    # Validate the state is one of the allowed values
    allowed_states = ["runner_starting", "app_starting", "ready", "awaiting_client", "active", "disconnecting"]
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

    script_event = None  # Default: no script execution.

    # Map runner state to script event.
    if update.state == "app_starting":
        runner.state = "app_starting"
        event_name = "app_starting"
        script_event = "on_create"
    elif update.state == "ready":
        runner.state = "ready"
        event_name = "runner_ready"
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
            script_result = await run_script_for_runner(script_event, runner.id, env_vars={})

            # Create a new history record for script execution instead of updating the existing one
            script_history = RunnerHistory(
                runner_id=runner.id,
                event_name=f"script_{script_event}",
                event_data={"script_result": script_result},
                created_by="system",
                modified_by="system"
            )
            session.add(script_history)
            session.commit()
        except Exception as e:
            logger.error(f"Error executing script for runner {runner.id}: {e}")
            # Log the error in history
            error_history = RunnerHistory(
                runner_id=runner.id,
                event_name=f"script_error_{script_event}",
                event_data={"error": str(e)},
                created_by="system",
                modified_by="system"
            )
            session.add(error_history)
            session.commit()

    return runner
