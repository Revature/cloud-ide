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
from app.db import runner_repository
from app.db.database import engine
from app.models.runner import Runner
from app.models.user import User
from app.models.image import Image
from app.util import constants, websocket_management, runner_status_management
from app.business import image_management, user_management, runner_management, script_management
from app.exceptions.runner_exceptions import RunnerLaunchError, RunnerClaimError

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
    #access_token: str = Header(..., alias="Access-Token"),
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
        fresh_runner = await runner_management.wait_for_runner_state(fresh_runner, "ready_claimed", 600)
        if not fresh_runner or fresh_runner.state != "ready_claimed":
            raise HTTPException(status_code=500, detail="Runner did not become ready in time")
        url = await runner_management.claim_runner(fresh_runner, request.session_time, db_user, user_ip, script_vars=script_vars)
        return await awaiting_client_hook(fresh_runner, url, env_vars)

async def awaiting_client_hook(runner: Runner, url: str, env_vars: dict[str, Any], request_id: Optional[str] = None):
    """Will run on the "awaiting_client" state."""
    try:
        if request_id:
            # Emit script starting status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_SCRIPT",
                "Running script for awaiting client",
                {
                    "runner_id": runner.id,
                    "script_type": "awaiting_client",
                    "status": "in_progress"
                }
            )

        script_result = await script_management.run_script_for_runner(
            "on_awaiting_client",
            runner.id,
            env_vars,
            initiated_by="app_requests_endpoint"
        )

        if request_id:
            # Emit script success status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_SCRIPT",
                "Script for awaiting client completed",
                {
                    "runner_id": runner.id,
                    "script_type": "awaiting_client",
                    "status": "succeeded",
                    "exit_code": 0 if script_result == "success" else 1,
                    "details": script_result
                }
            )

            # Emit session status to indicate the session is ready
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "SESSION_STATUS",
                "User session created successfully",
                {
                    "runner_id": runner.id,
                    "session_type": "create",
                    "status": "succeeded",
                    "duration": env_vars.get("session_time", 60)  # Default to 60 minutes if not specified
                }
            )

            # Emit connection ready status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "CONNECTION_STATUS",
                "Your runner is ready for connection",
                {
                    "runner_id": runner.id,
                    "status": "succeeded",
                    "url": url
                }
            )

    except Exception as e:
        if request_id:
            # Emit script failure status
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_SCRIPT",
                "Error running script for awaiting client",
                {
                    "runner_id": runner.id,
                    "script_type": "awaiting_client",
                    "status": "failed",
                    "exit_code": 1,
                    "error": str(e)
                }
            )

            # Emit session status to indicate the session failed
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "SESSION_STATUS",
                "Failed to create user session",
                {
                    "runner_id": runner.id,
                    "session_type": "create",
                    "status": "failed",
                    "error": str(e)
                }
            )

            # Emit shutdown notification
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "INSTANCE_LIFECYCLE",
                "Shutting down runner",
                {
                    "runner_id": runner.id,
                    "state": "terminating",
                    "reason": "Script execution failed",
                }
            )

        shutdown_result = await runner_management.force_shutdown_runners(
            [runner.identifier],
            initiated_by="app_requests_endpoint"
        )
        raise HTTPException(status_code=400, detail=f"Error executing script for runner {runner.id}") from e

    return app_requests_dto(url, runner)

def app_requests_dto(url: str, runner: Runner):
    """Create DTO for the app_request."""
    return {"url": url, "runner_id": str(runner.id)}

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
    """Process the runner request and emit status updates using the standardized event structure."""
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
                error_message.strip(),
                {
                    "error_type": "invalid_request",
                    "details": {
                        "missing_image": not db_image,
                        "missing_user": not db_user,
                        "missing_user_ip": not user_ip
                    }
                }
            )
            return

        # All validation passed, continue with processing

        # Emit initial status for request processing
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "REQUEST_PROCESSING",
            f"Processing request for {db_image.name}",
            {
                "image_id": db_image.id,
                "image_name": db_image.name,
                "user_id": db_user.id,
                "status": "in_progress"
            }
        )

        # Begin resource discovery - Check for existing runner
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "RESOURCE_DISCOVERY",
            "Checking for existing runner",
            {
                "discovery_type": "existing",
                "status": "in_progress"
            }
        )

        existing_runner = runner_management.get_existing_runner(db_user.id, db_image.id)

        if existing_runner:
            # Found existing runner
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_DISCOVERY",
                "Found an existing active runner for your session",
                {
                    "discovery_type": "existing",
                    "runner_id": existing_runner.id,
                    "status": "succeeded"
                }
            )

            # Allocate existing runner
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_ALLOCATION",
                "Claiming existing runner for your session",
                {
                    "allocation_type": "claim_existing",
                    "runner_id": existing_runner.id,
                    "status": "in_progress"
                }
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

            # Allocation succeeded
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_ALLOCATION",
                "Existing runner claimed successfully",
                {
                    "allocation_type": "claim_existing",
                    "runner_id": existing_runner.id,
                    "status": "succeeded"
                }
            )

            # Emit request processing completion
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "REQUEST_PROCESSING",
                f"Finished processing request for {db_image.name}",
                {
                    "image_id": db_image.id,
                    "image_name": db_image.name,
                    "user_id": db_user.id,
                    "status": "succeeded"
                }
            )

            # Emit connection ready event
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "CONNECTION_STATUS",
                "Your runner is ready for connection",
                {
                    "runner_id": existing_runner.id,
                    "status": "succeeded",
                    "url": url
                }
            )
        else:
            # No existing runner, check for pooled runner
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_DISCOVERY",
                "Checking for available runner in pool",
                {
                    "discovery_type": "pool",
                    "status": "in_progress"
                }
            )

            ready_runner = runner_management.get_runner_from_pool(db_image.id)

            if ready_runner:
                # Found pool runner
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RESOURCE_DISCOVERY",
                    "Found an available runner in the pool",
                    {
                        "discovery_type": "pool",
                        "runner_id": ready_runner.id,
                        "status": "succeeded"
                    }
                )

                # Allocate pool runner
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RESOURCE_ALLOCATION",
                    "Claiming pool runner for your session",
                    {
                        "allocation_type": "claim_pool",
                        "runner_id": ready_runner.id,
                        "status": "in_progress"
                    }
                )

                # Replenish pool if needed
                if db_image.runner_pool_size > 0:
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

                # Allocation succeeded
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RESOURCE_ALLOCATION",
                    "Pool runner claimed successfully",
                    {
                        "allocation_type": "claim_pool",
                        "runner_id": ready_runner.id,
                        "status": "succeeded"
                    }
                )

                # Run awaiting client hook
                await awaiting_client_hook(ready_runner, url, env_vars, request_id)

            else:
                # No resources found
                await runner_status_management.runner_status_emitter.emit_status(
                    request_id,
                    "RESOURCE_DISCOVERY",
                    "No existing or pool runners available",
                    {
                        "discovery_type": "none",
                        "status": "succeeded"
                    }
                )

                # Launch new runner
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
            "ERROR",
            f"Error processing runner request: {e!s}",
            {
                "error_type": "request_processing",
                "details": {
                    "exception": str(e)
                }
            }
        )

async def handle_new_runner_launch(
    request_id: str,
    db_image,
    db_user,
    request: RunnerRequest
):
    """Handle launching a new runner when no pool runner is available."""
    try:
        # Extract data from the request
        script_vars = request.env_data.get("script_vars", {})
        env_vars = request.env_data.get("env_vars", {})
        user_ip = script_vars.get("user_ip", "")
        session_time = request.session_time

        # Emit launching status
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "RESOURCE_ALLOCATION",
            "Launching new runner",
            {
                "allocation_type": "launch_new",
                "image_id": db_image.id,
                "status": "in_progress"
            }
        )

        # Launch new runner with request_id for status tracking
        try:
            # Launch a new runner with the request_id for status updates
            fresh_runners = await runner_management.launch_runners(
                db_image.identifier,
                1,
                initiated_by="app_requests_endpoint_no_pool",
                claimed=True,
                request_id=request_id
            )

            if not fresh_runners:
                raise RunnerLaunchError("Runner was not launched successfully.")

            runner = fresh_runners[0]

            runner = await runner_management.wait_for_runner_state(
                runner,
                "ready_claimed",
                120
            )

            if not runner or runner.state != "ready_claimed":
                raise RunnerClaimError("Runner did not become ready in time.")

            # Runner launched successfully
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_ALLOCATION",
                "New runner launched successfully",
                {
                    "allocation_type": "launch_new",
                    "runner_id": runner.id,
                    "status": "succeeded"
                }
            )

            # Setup phase
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "CONNECTION_STATUS",
                "New runner is ready, claiming for your session",
                {
                    "runner_id": runner.id,
                    "status": "in_progress"
                }
            )

            # Claim the runner and set up client
            url = await runner_management.claim_runner(
                runner,
                session_time,
                db_user,
                user_ip,
                script_vars,
                request_id=request_id
            )

            # Run awaiting client hook
            await awaiting_client_hook(runner, url, env_vars, request_id)

        except RunnerLaunchError as e:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "ERROR",
                f"Failed to launch new runner: {e!s}",
                {
                    "error_type": "launch_failed",
                    "details": {
                        "exception": str(e)
                    }
                }
            )

            # Resource allocation failed
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_ALLOCATION",
                "Failed to allocate resources",
                {
                    "allocation_type": "launch_new",
                    "status": "failed",
                    "error": str(e)
                }
            )
            raise

        except RunnerClaimError as e:
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "ERROR",
                f"Runner did not become ready in time: {e!s}",
                {
                    "error_type": "timeout",
                    "details": {
                        "resource_type": "runner"
                    }
                }
            )

            # Resource allocation failed
            await runner_status_management.runner_status_emitter.emit_status(
                request_id,
                "RESOURCE_ALLOCATION",
                "Failed to claim runner",
                {
                    "allocation_type": "launch_new",
                    "status": "failed",
                    "error": str(e)
                }
            )
            raise

    except Exception as e:
        logger.error(f"Error in handle_new_runner_launch: {e}")
        await runner_status_management.runner_status_emitter.emit_status(
            request_id,
            "ERROR",
            f"Error launching runner: {e!s}",
            {
                "error_type": "launch_failed",
                "details": {
                    "exception": str(e)
                }
            }
        )
        raise

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
                    await websocket.send_json({
                        "type": "HEARTBEAT_ACK",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
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
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error_type": "websocket"
            })
        except Exception:
            pass
        websocket_management.connection_manager.disconnect("runner_status", request_id)
