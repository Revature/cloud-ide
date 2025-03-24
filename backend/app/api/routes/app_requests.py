"""Application request handling API routes."""
from workos import exceptions
from fastapi import APIRouter, Depends, HTTPException, Response, status, Header
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Any
from datetime import datetime, timedelta
from app.api.authentication import token_authentication
from app.db.database import get_session, engine
from app.models.runner import Runner
from app.models.user import User
from app.models.image import Image
from app.util import constants;
from app.business.runner_management import launch_runners
from app.business.script_management import run_script_for_runner  # Script management layer
from app.business.jwt_creation import create_jwt_token
from app.business import image_management, user_management, runner_management
import asyncio
import os

router = APIRouter()

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
    response: Response,
    access_token: str = Header(..., alias="Access-Token"),
    x_forwarded_for: str = Header(..., alias="X-Forwarded-For"),
    client_ip: str = Header(..., alias="client-ip"),
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
    if(constants.auth_mode=="OFF"):
        try:
            response.headers['Access-Token'] = token_authentication(access_token)
        except exceptions.BadRequestException:
            response.status_code = 401
            return {"error": "Unauthorized"}

    # Check the user's requested session time.
    if request.session_time:
        if request.session_time > constants.max_session_minutes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Requested session time is greater than the maximum: {constants.max_session_minutes}")
        else:
            request.session_time = constants.max_session_minutes

    # Retrieve the image record.
    db_image: Image = image_management.get_image_by_id(request.id)
    if not db_image:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image not found")

    # Look up the user by email.
    db_user: User = user_management.get_user_by_email(request.email)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    # Extract data from request
    script_vars = request.env_data.get("script_vars", {})
    env_vars = request.env_data.get("env_vars", {})
    user_ip = script_vars.get("user_ip")

    # Check if the user already has a runner.
    existing_runner = runner_management.get_existing_runner(db_user.id, db_image.id)
    if existing_runner :
        return runner_management.prepare_runner(existing_runner, 
                                                request.session_time,
                                                db_user,
                                                user_ip,
                                                None,
                                                None,
                                                True)
 
    ready_runner : Runner = runner_management.get_runner_from_pool(db_image.id)
    if ready_runner:
        # Launch a new runner asynchronously to replenish the pool if the image definition specifies a pool.
        if db_image.runner_pool_size != 0:
            asyncio.create_task(launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_pool_replenish"))
        return runner_management.prepare_runner(ready_runner,
                                                request.session_time,
                                                db_user,
                                                user_ip,
                                                script_vars,
                                                env_vars,
                                                False)
    else:
        # Launch a new runner and wait for it to be ready.
        fresh_runner : Runner = await launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_no_pool")[0]
        # Poll up to 60 seconds (12 attempts, every 5 seconds).
        for _ in range(12):
            runner_management.get_runner_by_id(fresh_runner.id)
            if fresh_runner and fresh_runner.state == "ready":
                break
            await asyncio.sleep(5)
        if not fresh_runner or fresh_runner.state != "ready":
            raise HTTPException(status_code=500, detail="Runner did not become ready in time")
        return runner_management.prepare_runner(fresh_runner,
                                                request.session_time,
                                                db_user,
                                                user_ip,
                                                script_vars,
                                                env_vars,
                                                False)