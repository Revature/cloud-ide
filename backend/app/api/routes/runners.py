"""Runners API routes."""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.db.database import get_session
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.models.image import Image
from app.schemas.runner import ExtendSessionRequest
from app.business.runner_management import terminate_runner as terminate_runner_function
from app.business.runner_management import launch_runners
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=list[Runner])
def read_runners(session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Retrieve a list of all Runners."""
    runners = session.exec(select(Runner)).all()
    return runners

@router.get("/{runner_id}", response_model=Runner)
def read_runner(runner_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Retrieve a single Runner by ID."""
    runner = session.get(Runner, runner_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Runner not found")
    return runner

@router.put("/extend_session", response_model=str)
def extend_runner_session(
    extend_req: ExtendSessionRequest,
    session: Session = Depends(get_session),
    access_token: str = Header(..., alias="Access-Token")
    ):
    """Update a runner's session_end by adding extra time."""
    runner = session.get(Runner, extend_req.runner_id)
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

class TerminateRunnerRequest(BaseModel):
    """Request model for the terminate_runner endpoint."""

    runner_id: int

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
    runner = session.get(Runner, runner_id)
    # Delete is idempotent, if no runner exists, just return.
    if not runner:
        return

    # Get the image to check if it has a runner pool
    image_id = runner.image_id
    image = session.get(Image, image_id)
    needs_replenishing = image and image.runner_pool_size > 0 and runner.state == "ready"
    image_identifier = image.identifier if image else None

    # Call the terminate_runner function from runner_management.py
    result = await terminate_runner_function(runner_id, initiated_by="manual_termination_endpoint")

    # Check for various error conditions with specific messages
    if result["status"] == "error":
        # Check for specific error types in the details
        if "details" in result and isinstance(result["details"], dict):
            # Script execution errors
            if result["details"].get("step") == "script_execution" and "status" in result["details"] and result["details"]["status"] == "error":
                error_msg = result["details"].get("message", "Unknown script error")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Script error during termination: {error_msg}"
                )

            # Instance stop errors
            elif result["details"].get("step") == "stop_instance" and "status" in result["details"] and result["details"]["status"] == "error":
                error_msg = result["details"].get("message", "Unknown instance stop error")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error stopping runner instance: {error_msg}"
                )

            # Instance termination errors
            elif result["details"].get("step") == "terminate_instance" and "status" in result["details"] and result["details"]["status"] == "error":
                error_msg = result["details"].get("message", "Unknown instance termination error")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error terminating runner instance: {error_msg}"
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
            asyncio.create_task(launch_runners(image_identifier, 1, initiated_by="manual_termination_endpoint_pool_replenish"))
            return {"status": "success", "message": "Runner terminated successfully and replacement launched"}
        except Exception as e:
            # If launching the replacement fails, log it but don't fail the termination
            print(f"Error launching replacement runner: {e}")
            return {"status": "partial_success", "message": "Runner terminated successfully but failed to launch replacement"}

    return {"status": "success", "message": "Runner terminated successfully"}
