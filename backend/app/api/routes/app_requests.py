"""Routes for handling requests for runners."""
from workos import exceptions
from fastapi import APIRouter, Depends, HTTPException, Response, status, Header
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Any
from datetime import datetime, timedelta
from app.db.database import get_session, engine
from app.models.runner import Runner
from app.models.user import User
from app.models.image import Image
from app.business.runner_management import launch_runners, terminate_runner
from app.business.script_management import run_script_for_runner
from app.business import image_management, user_management, runner_management
import logging
import asyncio
import os

router = APIRouter()
logger = logging.getLogger(__name__)

class RunnerRequest(BaseModel):
    """Request model for the get_ready_runner endpoint."""

    image_id: int
    env_data: dict[str, Any]
    user_email: str
    session_time: int  # in minutes, limit to 3 hours
    runner_type: str   # temporary/permanent

async def execute_awaiting_client_script(runner_id: int, env_vars: dict, session: Session) -> None:
    """Execute the on_awaiting_client script for a runner, handling script-specific errors."""
    try:
        script_result = await run_script_for_runner("on_awaiting_client", runner_id, env_vars, initiated_by="app_requests_endpoint")
        print(f"Script executed for runner {runner_id}: {script_result}")
        return script_result
    except Exception as e:
        if "No script found for event" in str(e):
            # No script is available for this hook/image - this is acceptable
            print(f"No script found for runner {runner_id}, continuing...")
            return None
        else:
            # Re-raise the exception for the caller to handle
            raise

@router.post("/", response_model=dict[str, str])
async def get_ready_runner(
    request: RunnerRequest,
    access_token: str = Header(..., alias="Access-Token"),
    session: Session = Depends(get_session)
):
    """
    Retrieve a runner with the "ready" state for the given image and assign it to a user.

    If the user already has an "alive" runner for the image, update its session_end.
    Otherwise, if no ready runner is available, launch a new one.

    The runner's environment data is updated, its state is set to "awaiting_client",
    and the URL is returned. Also, the appropriate script is executed for the
    "on_awaiting_client" event.
    """
    max_session_minutes = 180
    # Retrieve the image record.
    stmt_image = select(Image).where(Image.id == request.image_id)
    db_image = session.exec(stmt_image).first()
    if not db_image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    # Look up the user by email.
    stmt_user = select(User).where(User.email == request.user_email)
    user_obj = session.exec(stmt_user).first()
    if not user_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Extract data from request
    script_vars = request.env_data.get("script_vars", {})
    env_vars = request.env_data.get("env_vars", {})
    user_ip = script_vars.get("user_ip")

    # Check if the user already has a runner.
    existing_runner = runner_management.get_existing_runner(db_user.id, db_image.id)
    if existing_runner :
        logger.info(f"User {db_user.id} requested runner, got existing runner: {existing_runner}")
        res = await runner_management.prepare_runner(existing_runner,
                                                None,
                                                True)
        return res

    ready_runner : Runner = runner_management.get_runner_from_pool(db_image.id)
    if ready_runner:
        logger.info(f"User {db_user.id} requested runner, got ready runner: {ready_runner}")
        print(f"User {db_user.id} requested runner, got ready runner: {ready_runner}")
        # Launch a new runner asynchronously to replenish the pool if the image definition specifies a pool.
        if db_image.runner_pool_size != 0:
            asyncio.create_task(launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_pool_replenish"))
        print(f"env_data is {script_vars}")
        ready_runner = runner_management.claim_runner(ready_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        res = await runner_management.prepare_runner(ready_runner,
                                                env_vars,
                                                False)
        return res
    else:
        # Launch a new runner and wait for it to be ready.
        fresh_runners : list[Runner] = await launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_no_pool")
        fresh_runner : Runner = fresh_runners[0]
        logger.info(f"User {db_user.id} requested runner, got fresh runner: {fresh_runner}")
        print(f"User {db_user.id} requested runner, got fresh runner: {fresh_runner}")
        # Poll up to 60 seconds (12 attempts, every 5 seconds).
        for _ in range(12):
            with Session(engine) as poll_session:
                stmt_runner = select(Runner).where(Runner.identifier == instance_id)
                runner = poll_session.exec(stmt_runner).first()
            if runner and runner.state == "ready":
                break
            await asyncio.sleep(5)
        if not runner or runner.state != "ready":
            raise HTTPException(status_code=500, detail="Runner did not become ready in time")
        fresh_runner = runner_management.claim_runner(fresh_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        res = await runner_management.prepare_runner(fresh_runner,
                                                env_vars,
                                                False)
        return res
