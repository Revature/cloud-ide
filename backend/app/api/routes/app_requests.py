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
from app.business.runner_management import launch_runners
from app.business.script_management import run_script_for_runner  # Script management layer
from app.business.jwt_creation import create_jwt_token
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
    try:
        response.headers['Access-Token'] = token_authentication(access_token)
    except exceptions.BadRequestException:
        response.status_code = 401
        return {"error": "Unauthorized"}

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

    # Check if the user already has an alive runner for the requested image.
    stmt_runner = select(Runner).where(
        Runner.state.in_(["active", "awaiting_client"]),  # Changed to include awaiting_client too
        Runner.image_id == request.image_id,
        Runner.user_id == user_obj.id
    )
    existing_runner = session.exec(stmt_runner).first()
    domain = os.getenv("DOMAIN", "http://devide.revature.com")

    if existing_runner:
        if request.session_time > max_session_minutes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session time cannot exceed 3 hours.")
        # Update session_end for the existing runner.
        existing_runner.session_end = existing_runner.session_start + timedelta(minutes=request.session_time)

        # We might want to update script_vars but not env_vars
        # existing_runner.env_data = script_vars

        session.add(existing_runner)
        session.commit()
        session.refresh(existing_runner)

        # Generate a JWT token for the existing runner
        jwt_token = create_jwt_token(
            runner_ip=str(existing_runner.url),
            runner_id=existing_runner.id,
            user_ip=user_ip
        )

        # Get the workspace path from env_data
        workspace_path = existing_runner.env_data.get("path", "")
        if not workspace_path.startswith("/"):
            workspace_path = "/" + workspace_path

        # Construct the full URL with domain, token, and workspace path
        full_url = f"{domain}/dest/{jwt_token}{workspace_path}"

        return {"url": full_url, "runner_id": str(existing_runner.id)}

    # No alive runner found; select a ready runner or launch a new one.
    if db_image.runner_pool_size == 0:
        # Launch a new runner and wait for it to be ready.
        instance_ids = await launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_no_pool")
        instance_id = instance_ids[0]
        stmt_runner = select(Runner).where(Runner.identifier == instance_id)
        runner = session.exec(stmt_runner).first()
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
    else:
        # Query for a runner in "ready" state for the given image.
        stmt_runner = select(Runner).where(Runner.state == "ready", Runner.image_id == request.image_id)
        runner = session.exec(stmt_runner).first()
        if not runner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No ready runner available for that image"
            )

    # Update the runner: assign the user, update environment data, and change state to "awaiting_client".
    runner.user_id = user_obj.id
    # Store only script_vars in runner.env_data, not env_vars
    runner.env_data = script_vars
    runner.state = "awaiting_client"

    # Store user_ip if present
    if user_ip:
        runner.user_ip = user_ip

    # Use repo_name from script_vars. If not present, default to "project".
    repo_name = script_vars.get("git_repo_name", "project")
    # Add path to env_data
    runner.env_data["path"] = "/#/home/ubuntu/" + repo_name

    if request.session_time > max_session_minutes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session time cannot exceed 3 hours."
        )

    runner.session_start = datetime.utcnow()
    runner.session_end = runner.session_start + timedelta(minutes=request.session_time)

    session.add(runner)
    session.commit()
    session.refresh(runner)

    # Optionally, launch a new runner asynchronously to replenish the pool.
    if db_image.runner_pool_size != 0:
        asyncio.create_task(launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_pool_replenish"))

    # Execute the script for the "awaiting_client" event, passing env_vars separately
    try:
        script_result = await run_script_for_runner("on_awaiting_client", runner.id, env_vars, initiated_by="app_requests_endpoint")
        print(f"Script executed for runner {runner.id}: {script_result}")

        # Generate a JWT token for the runner
        jwt_token = create_jwt_token(
            runner_ip=str(runner.url),
            runner_id=runner.id,
            user_ip=user_ip
        )

        # Get the workspace path from env_data
        workspace_path = runner.env_data.get("path", "")
        # Ensure the workspace path starts with a slash
        if not workspace_path.startswith("/"):
            workspace_path = "/" + workspace_path

        # Construct the full URL with your domain, token, and workspace path
        full_url = f"{domain}/dest/{jwt_token}{workspace_path}"

        return {"url": full_url, "runner_id": str(runner.id)}

    except Exception as e:
        print(f"Error executing script for runner {runner.id}: {e}")
        return {"error": f"Error executing script for runner {runner.id}"}
