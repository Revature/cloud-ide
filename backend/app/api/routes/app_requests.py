"""Routes for handling requests for runners."""
from fastapi import APIRouter, Depends, HTTPException, Response, status, Header
from sqlmodel import Session
from pydantic import BaseModel
from typing import Any, Optional
from app.models.runner import Runner
from app.models.user import User
from app.models.image import Image
from app.util import constants
from app.api import http
from app.business import image_management, user_management, runner_management, script_management
import logging
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

class RunnerRequest(BaseModel):
    """Request model for the get_ready_runner endpoint."""

    image_id: int
    env_data: dict[str, Any]
    user_email: str
    session_time: int  # in minutes, limit to 3 hours
    runner_type: str   # temporary/permanent

@router.post("/", response_model=dict[str, str])
async def get_ready_runner(
    request: RunnerRequest,
    access_token: str = Header(..., alias="Access-Token"),
    x_forwarded_for: Optional[str] = Header(None),
    client_ip: Optional[str] = Header(None)
):
    """
    Retrieve a runner with the "ready" state for the given image and assign it to a user.

    If the user already has an "alive" runner for the image, update its session_end.
    Otherwise, if no ready runner is available, launch a new one.

    The runner's environment data is updated, its state is set to "awaiting_client",
    and the URL is returned. Also, the appropriate script is executed for the
    "on_awaiting_client" event.
    """
    # Check the user's requested session time.
    if request.session_time:
        if request.session_time > constants.max_runner_lifetime:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Requested session time is greater than the maximum: {constants.max_session_minutes}")

    # Retrieve the image record.
    db_image: Image = image_management.get_image_by_id(request.image_id)
    if not db_image:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image not found")

    # Look up the user by email.
    db_user: User = user_management.get_user_by_email(request.user_email)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    # Extract data from request
    script_vars = request.env_data.get("script_vars", {})
    env_vars = request.env_data.get("env_vars", {})
    # user_ip = http.extract_original_ip(client_ip, x_forwarded_for)
    user_ip = script_vars.get("user_ip", "")
    if not user_ip:
        return HTTPException(status_code=400, detail="User IP not found in script_vars")

    # Check if the user already has a runner.
    existing_runner = runner_management.get_existing_runner(db_user.id, db_image.id)
    if existing_runner :
        logger.info(f"User {db_user.id} requested runner, got existing runner: {existing_runner}")
        url : str = await runner_management.claim_runner(existing_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        return app_requests_dto(url, existing_runner)

    ready_runner : Runner = runner_management.get_runner_from_pool(db_image.id)
    # Check if there is a runner already available in the pool.
    if ready_runner:
        logger.info(f"User {db_user.id} requested runner, got ready runner: {ready_runner}")
        print(f"User {db_user.id} requested runner, got ready runner: {ready_runner}")
        # Launch a new runner asynchronously to replenish the pool if the image definition specifies a pool.
        if db_image.runner_pool_size != 0:
            asyncio.create_task(runner_management.launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_pool_replenish"))
        url : str = await runner_management.claim_runner(ready_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        return await awaiting_client_hook(ready_runner, url, env_vars)
    else:
        # Launch a new runner and wait for it to be ready.
        fresh_runners : list[Runner] = await runner_management.launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_no_pool")
        fresh_runner : Runner = fresh_runners[0]
        logger.info(f"User {db_user.id} requested runner, got fresh runner: {fresh_runner}")
        fresh_runner = await runner_management.wait_for_runner_state(fresh_runner, "ready", 120)
        if not fresh_runner or fresh_runner.state != "ready":
            raise HTTPException(status_code=500, detail="Runner did not become ready in time")
        url = await runner_management.claim_runner(fresh_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        return await awaiting_client_hook(fresh_runner, url, env_vars)

async def awaiting_client_hook(runner: Runner, url: str, env_vars: dict[str, Any]):
    """Will run on the "awaiting_client" state."""
    try:
        script_result = await script_management.run_script_for_runner("on_awaiting_client",
                                                                    runner.id,
                                                                    env_vars,
                                                                    initiated_by="app_requests_endpoint")
    except Exception as e:
        shutdown_result = await runner_management.force_shutdown_runners(
            [runner.identifier],
            initiated_by="app_requests_endpoint"
        )
        raise HTTPException(status_code=400,  detail=f"Error executing script for runner {runner.id}") from e
    return app_requests_dto(url, runner)

def app_requests_dto(url: str, runner: Runner):
    """Create DTO for the app_request."""
    return {"url":url, "runner_id":str(runner.id)}
