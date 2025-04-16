"""Routes for handling requests for runners."""
import logging
import asyncio
from uuid import uuid4
from app.api import http
from fastapi import APIRouter, Depends, HTTPException, Response, status, Header
from fastapi import WebSocket, WebSocketDisconnect, HTTPException, Query
from sqlmodel import Session
from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime, timezone
from app.models.runner import Runner
from app.models.user import User
from app.models.image import Image
from app.util import constants, websocket_management, runner_status_management
from app.business import image_management, user_management, runner_management, script_management


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
        # print(f"User {db_user.id} requested runner, got ready runner: {ready_runner}")
        # Launch a new runner asynchronously to replenish the pool if the image definition specifies a pool.
        if db_image.runner_pool_size != 0:
            asyncio.create_task(runner_management.launch_runners(db_image.identifier, 1, initiated_by="app_requests_endpoint_pool_replenish"))
        url : str = await runner_management.claim_runner(ready_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        return await awaiting_client_hook(ready_runner, url, env_vars)
    else:
        # Launch a new runner and wait for it to be ready.
        fresh_runners : list[Runner] = await runner_management.launch_runners(db_image.identifier,
                                                                              1,
                                                                              initiated_by="app_requests_endpoint_no_pool",
                                                                              claimed=True)
        fresh_runner : Runner = fresh_runners[0]
        logger.info(f"User {db_user.id} requested runner, got fresh runner: {fresh_runner}")
        fresh_runner = await runner_management.wait_for_runner_state(fresh_runner, "ready_claimed", 120)
        if not fresh_runner or fresh_runner.state != "ready_claimed":
            raise HTTPException(status_code=500, detail="Runner did not become ready in time")
        url = await runner_management.claim_runner(fresh_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        return await awaiting_client_hook(fresh_runner, url, env_vars)

async def awaiting_client_hook(runner: Runner, url: str, env_vars: dict[str, Any], request_id: Optional[str] = None):
    """Will run on the "awaiting_client" state."""
    try:
        if request_id:
            # Emit starting script status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_AWAITING_CLIENT_SCRIPT_START",
                "Running script for awaiting client",
                {
                    "runner_id": runner.id
                }
            )
        script_result = await script_management.run_script_for_runner("on_awaiting_client",
                                                                    runner.id,
                                                                    env_vars,
                                                                    initiated_by="app_requests_endpoint")
        if request_id:
            # Emit the script result to the WebSocket
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_AWAITING_CLIENT_SCRIPT_SUCCESS",
                "Script for awaiting client completed",
                {
                    "runner_id": runner.id,
                    "script_result": script_result
                }
            )
    except Exception as e:
        if request_id:
            # Emit error status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_AWAITING_CLIENT_SCRIPT_ERROR",
                "Error running script for awaiting client",
                {
                    "runner_id": runner.id,
                    "error": str(e)
                }
            )

            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_SHUTTING_DOWN",
                "Error running script, shutting down runner",
                {
                    "runner_id": runner.id
                }
            )
        shutdown_result = await runner_management.force_shutdown_runners(
            [runner.identifier],
            initiated_by="app_requests_endpoint"
        )
        raise HTTPException(status_code=400,  detail=f"Error executing script for runner {runner.id}") from e
    return app_requests_dto(url, runner)

def app_requests_dto(url: str, runner: Runner):
    """Create DTO for the app_request."""
    return {"url":url, "runner_id":str(runner.id)}

@router.post("/with_status", response_model=dict)
async def get_ready_runner_with_status(
    request: RunnerRequest
):
    """Request a runner and return a request_id for tracking status via WebSocket."""
    # Generate a unique request ID
    request_id = str(uuid4())

    try:
        # Extract data from request
        script_vars = request.env_data.get("script_vars", {})
        env_vars = request.env_data.get("env_vars", {})

        # Check session time
        if request.session_time > constants.max_runner_lifetime:
            return {
                "request_id": request_id,
                "status": "error",
                "message": f"Requested session time exceeds maximum ({constants.max_session_minutes} minutes)"
            }

        # Get image
        db_image = image_management.get_image_by_id(request.image_id)
        if not db_image:
            return {
                "request_id": request_id,
                "status": "error",
                "message": "Image not found"
            }

        # Get user
        db_user = user_management.get_user_by_email(request.user_email)
        if not db_user:
            return {
                "request_id": request_id,
                "status": "error",
                "message": "User not found"
            }

        # Extract user IP
        user_ip = script_vars.get("user_ip", "")
        if not user_ip:
            return {
                "request_id": request_id,
                "status": "error",
                "message": "User IP not found in script_vars"
            }

        # Start processing in background task
        asyncio.create_task(
            process_runner_request_with_status(
                request_id,
                request
            )
        )

        # Return the request ID immediately
        return {
            "request_id": request_id,
            "status": "processing",
            "message": "Runner request is being processed"
        }

    except Exception as e:
        logger.error(f"Error in get_ready_runner_with_status: {e}")
        return {
            "request_id": request_id,
            "status": "error",
            "message": f"Error: {e!s}"
        }

async def process_runner_request_with_status(
    request_id: str,
    request: RunnerRequest
):
    """Process the runner request and emit status updates.

    Args:
        request_id (str): Request ID for tracking the request
        request (RunnerRequest): Request object containing all required data
    """
    try:
        # Extract data directly from the request
        script_vars = request.env_data.get("script_vars", {})
        env_vars = request.env_data.get("env_vars", {})
        user_ip = script_vars.get("user_ip", "")

        # Get db objects based on request data
        db_image = image_management.get_image_by_id(request.image_id)
        db_user = user_management.get_user_by_email(request.user_email)

        # Validate required data
        if not db_image or not db_user or not user_ip:
            error_message = "Missing required data: "
            if not db_image:
                error_message += "Image not found. "
            if not db_user:
                error_message += "User not found. "
            if not user_ip:
                error_message += "User IP not found in script_vars. "

            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "ERROR",
                error_message.strip()
            )
        else:
            # All validation passed, continue with processing

            # Emit initial status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "PROCESSING_REQUEST",
                f"Processing request for {db_image.name}",
                {
                    "image_id": db_image.id,
                    "image_name": db_image.name,
                    "user_id": db_user.id
                }
            )

            # Check for existing runner
            existing_runner = runner_management.get_existing_runner(db_user.id, db_image.id)

            if existing_runner:
                # Process existing runner
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "EXISTING_RUNNER_FOUND",
                    "Found an existing active runner for your session",
                    {"runner_id": existing_runner.id}
                )

                # Use existing runner with request_id for status tracking
                url = await runner_management.claim_runner(
                    existing_runner,
                    request.session_time,
                    db_user,
                    user_ip,
                    script_vars,
                    request_id=request_id
                )

                # Emit connection ready event
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "CONNECTION_READY",
                    "Your runner is ready for connection",
                    {
                        "runner_id": existing_runner.id,
                        "url": url
                    }
                )
            else:
                # Check for pooled runner
                ready_runner = runner_management.get_runner_from_pool(db_image.id)

                if ready_runner:
                    # Process pool runner
                    await runner_status_management.runner_status_emitter.emit_status(
                        request_id,
                        "POOL_RUNNER_FOUND",
                        "Found an available runner in the pool",
                        {"runner_id": ready_runner.id}
                    )

                    # Replenish pool if needed
                    if db_image.runner_pool_size != 0:
                        # Not passing request_id as this is a background task
                        asyncio.create_task(
                            runner_management.launch_runners(
                                db_image.identifier,
                                1,
                                initiated_by="app_requests_endpoint_pool_replenish"
                            )
                        )

                    # Claim the pool runner with request_id for status tracking
                    url = await runner_management.claim_runner(
                        ready_runner,
                        request.session_time,
                        db_user,
                        user_ip,
                        script_vars,
                        request_id=request_id
                    )

                    await awaiting_client_hook(ready_runner, url, env_vars, request_id)

                    # Emit connection ready event
                    await runner_status_management.runner_status_emitter.emit_status(
                        request_id,
                        "CONNECTION_READY",
                        "Your runner is ready for connection",
                        {
                            "runner_id": ready_runner.id,
                            "url": url
                        }
                    )
                else:
                    # No pool runner available, launch a new one
                    await handle_new_runner_launch(
                        request_id,
                        db_image,
                        db_user,
                        request
                    )

    except Exception as e:
        logger.error(f"Error in process_runner_request_with_status: {e}")
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "INSTANCE_ERROR",
            f"Error processing runner request: {e!s}"
        )

async def handle_new_runner_launch(
    request_id: str,
    db_image,
    db_user,
    request: RunnerRequest
):
    """Handle launching a new runner when no pool runner is available.

    Args:
        request_id (str): The request ID for tracking
        db_image: The database image object
        db_user: The database user object
        request (RunnerRequest): The original request object
    """
    # Extract data from the request
    script_vars = request.env_data.get("script_vars", {})
    env_vars = request.env_data.get("env_vars", {})
    user_ip = script_vars.get("user_ip", "")
    session_time = request.session_time

    await runner_status_management.runner_status_emitter.emit_status(
        request_id,
        "INSTANCE_LAUNCHING",
        "No available runners in pool, launching new runner",
        {"image_id": db_image.id}
    )

    # Launch a new runner with the request_id for status updates
    fresh_runners = await runner_management.launch_runners(
        db_image.identifier,
        1,
        initiated_by="app_requests_endpoint_no_pool",
        claimed=True,
        request_id=request_id
    )

    if not fresh_runners:
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "ERROR",
            "Failed to launch new runner"
        )
        return

    fresh_runner = fresh_runners[0]

    # Wait for runner to be ready
    fresh_runner = await runner_management.wait_for_runner_state(
        fresh_runner,
        "ready_claimed",
        120
    )

    if not fresh_runner or fresh_runner.state != "ready_claimed":
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "ERROR",
            "Runner did not become ready in time"
        )
        return

    await runner_status_management.runner_status_emitter.emit_status(
        request_id,
        "INSTANCE_POST_BOOT_SETUP",
        "New runner is ready, claiming for your session",
        {"runner_id": fresh_runner.id}
    )

    # Claim the runner with request_id for status tracking
    url = await runner_management.claim_runner(
        fresh_runner,
        session_time,
        db_user,
        user_ip,
        script_vars,
        request_id=request_id
    )

    await awaiting_client_hook(fresh_runner, url, env_vars, request_id)

    # Emit connection ready event
    await runner_status_management.runner_status_emitter.emit_status(
        request_id,
        "INSTANCE_SETUP_COMPLETE",
        "Your runner is ready for connection",
        {
            "runner_id": fresh_runner.id,
            "url": url
        }
    )

@router.websocket("/runner_status/{request_id}")
async def runner_status_websocket(
    websocket: WebSocket,
    request_id: str,
):
    """
    WebSocket endpoint for runner status updates.

    Clients connect to this endpoint with a request_id to receive
    real-time updates about runner provisioning and lifecycle events.
    """
    try:
        # Connect the client (will send any buffered messages)
        await websocket_management.connection_manager.connect(websocket, "runner_status", request_id)

        # Send initial connection confirmation
        await websocket.send_json({
            "type": "CONNECTED",
            "message": f"Connected to runner status updates for request {request_id}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        # Keep the connection alive and handle client messages
        while True:
            # Wait for client messages (can be used for heartbeats or cancellation)
            data = await websocket.receive_json()

            # Process client messages if needed
            if "action" in data:
                if data["action"] == "heartbeat":
                    await websocket.send_json({"type": "HEARTBEAT_ACK", "timestamp": datetime.now(timezone.utc).isoformat()})
                elif data["action"] == "cancel":
                    # Handle cancellation request
                    await websocket.send_json({
                        "type": "CANCELLATION_RECEIVED",
                        "message": "Cancellation request received",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from runner status updates for request {request_id}")
        websocket_management.connection_manager.disconnect("runner_status", request_id)
    except Exception as e:
        logger.error(f"Error in runner status WebSocket for request {request_id}: {e}")
        try:
            await websocket.send_json({
                "type": "ERROR",
                "message": f"WebSocket error: {e!s}",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception:
            pass
        websocket_management.connection_manager.disconnect("runner_status", request_id)
