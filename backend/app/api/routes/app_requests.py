"""Routes for handling requests for runners."""
import logging
import asyncio
import functools
from uuid import uuid4
from app.api import http
from fastapi import APIRouter, Depends, HTTPException, Response, status, Header
from fastapi import WebSocket, WebSocketDisconnect, Query
from sqlmodel import Session
from pydantic import BaseModel
from typing import Any, Optional, Callable
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

async def emit_status(
    lifecycle_token: Optional[str], 
    event_type: str, 
    message: str, 
    data: dict[str, Any],
    is_error: bool = False
) -> None:
    """
    Emit a status update if lifecycle_token is provided.
    
    Args:
        lifecycle_token: Optional token for tracking the request
        event_type: Type of event (e.g., "REQUEST_PROCESSING", "ERROR")
        message: Human-readable message describing the event
        data: Additional data for the event
        is_error: Whether this is an error event
    """
    if not lifecycle_token:
        return
        
    if is_error:
        await runner_status_management.runner_status_emitter.emit_status(
            lifecycle_token,
            "ERROR",
            message,
            {
                "error_type": data.get("error_type", "unknown"),
                "details": data
            }
        )
    else:
        await runner_status_management.runner_status_emitter.emit_status(
            lifecycle_token,
            event_type,
            message,
            data
        )

def handle_runner_errors(func):
    """Decorator for standardized error handling in runner operations."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except RunnerLaunchError as e:
            lifecycle_token = kwargs.get('lifecycle_token')
            await emit_status(
                lifecycle_token, 
                "ERROR", 
                f"Failed to launch runner: {e!s}",
                {"error_type": "launch_failed", "exception": str(e)},
                is_error=True
            )
            raise HTTPException(status_code=500, detail=f"Failed to launch runner: {e!s}")
        except RunnerClaimError as e:
            lifecycle_token = kwargs.get('lifecycle_token')
            await emit_status(
                lifecycle_token, 
                "ERROR", 
                f"Failed to claim runner: {e!s}",
                {"error_type": "claim_failed", "exception": str(e)},
                is_error=True
            )
            raise HTTPException(status_code=500, detail=f"Failed to claim runner: {e!s}")
        except Exception as e:
            lifecycle_token = kwargs.get('lifecycle_token')
            logger.error(f"Error in {func.__name__}: {e}")
            await emit_status(
                lifecycle_token, 
                "ERROR", 
                f"Unexpected error: {e!s}",
                {"error_type": "unknown", "exception": str(e)},
                is_error=True
            )
            raise HTTPException(status_code=500, detail=f"Unexpected error: {e!s}")
    return wrapper

async def process_runner_request(
    request: RunnerRequest,
    lifecycle_token: Optional[str] = None,
    client_ip: Optional[str] = None,
    x_forwarded_for: Optional[str] = None,
) -> dict:
    """
    Core processing logic for all runner requests.
    
    Args:
        request: The RunnerRequest containing image_id, env_data, user_email, etc.
        lifecycle_token: Optional token for status tracking via WebSocket
        client_ip: Optional client IP from header
        x_forwarded_for: Optional X-Forwarded-For header
        
    Returns:
        A dictionary containing the URL and runner_id, or status information
        
    Raises:
        HTTPException: If the request is invalid or processing fails
    """
    try:
        # Extract common data from request
        script_vars = request.env_data.get("script_vars", {})
        env_vars = request.env_data.get("env_vars", {})
        
        # Validate session time
        if request.session_time > constants.max_runner_lifetime:
            error_msg = f"Requested session time exceeds maximum: {constants.max_runner_lifetime} minutes"
            await emit_status(
                lifecycle_token,
                "ERROR",
                error_msg,
                {
                    "error_type": "invalid_request",
                    "details": {"invalid_session_time": True}
                },
                is_error=True
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
            
        # Get image
        db_image = image_management.get_image_by_id(request.image_id)
        if not db_image:
            error_msg = "Image not found"
            await emit_status(
                lifecycle_token,
                "ERROR",
                error_msg,
                {
                    "error_type": "invalid_request",
                    "details": {"missing_image": True}
                },
                is_error=True
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
            
        # Get user
        db_user = user_management.get_user_by_email(request.user_email)
        if not db_user:
            error_msg = "User not found"
            await emit_status(
                lifecycle_token,
                "ERROR",
                error_msg,
                {
                    "error_type": "invalid_request",
                    "details": {"missing_user": True}
                },
                is_error=True
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
            
        # Process user IP - handle it differently based on whether we have headers
        if x_forwarded_for or client_ip:
            user_ip = http.extract_original_ip(client_ip, x_forwarded_for)
        else:
            user_ip = script_vars.get("user_ip", "")

        # Prepare runner configuration
        runner_config = {
            "requested_session_time": request.session_time,
            "script_vars": script_vars,
            "user_ip": user_ip,
            "file_path": script_vars.get("file_path", "")
        }
        
        # If lifecycle_token is provided, emit initial status
        await emit_status(
            lifecycle_token,
            "REQUEST_PROCESSING",
            f"Processing request for {db_image.name}",
            {
                "image_id": db_image.id,
                "image_name": db_image.name,
                "user_id": db_user.id,
                "status": "in_progress"
            }
        )
            
        # STEP 1: Check if the user already has a runner
        await emit_status(
            lifecycle_token,
            "RESOURCE_DISCOVERY",
            "Checking for existing runner",
            {
                "discovery_type": "existing",
                "status": "in_progress"
            }
        )
            
        existing_runner = runner_management.get_existing_runner(db_user.id, db_image.id)
        
        if existing_runner:
            logger.info(f"User {db_user.id} requested runner, got existing runner: {existing_runner}")
            
            await emit_status(
                lifecycle_token,
                "RESOURCE_DISCOVERY",
                "Found an existing active runner for your session",
                {
                    "discovery_type": "existing",
                    "runner_id": existing_runner.id,
                    "status": "succeeded"
                }
            )
                
            await emit_status(
                lifecycle_token,
                "RESOURCE_ALLOCATION",
                "Claiming existing runner for your session",
                {
                    "allocation_type": "claim_existing",
                    "runner_id": existing_runner.id,
                    "status": "in_progress"
                }
            )
                
            # Claim the existing runner with the updated function signature
            url = await runner_management.claim_runner(
                runner=existing_runner,
                user=db_user,
                runner_config=runner_config,
                lifecycle_token=lifecycle_token
            )
            
            await emit_status(
                lifecycle_token,
                "RESOURCE_ALLOCATION",
                "Existing runner claimed successfully",
                {
                    "allocation_type": "claim_existing",
                    "runner_id": existing_runner.id,
                    "status": "succeeded"
                }
            )
                
            await emit_status(
                lifecycle_token,
                "REQUEST_PROCESSING",
                f"Finished processing request for {db_image.name}",
                {
                    "image_id": db_image.id,
                    "image_name": db_image.name,
                    "user_id": db_user.id,
                    "status": "succeeded"
                }
            )
                
            await emit_status(
                lifecycle_token,
                "CONNECTION_STATUS",
                "Your runner is ready for connection",
                {
                    "runner_id": existing_runner.id,
                    "status": "succeeded",
                    "url": url
                }
            )
                
            return app_requests_dto(url, existing_runner)
            
        # STEP 2: No existing runner, check for a ready runner in the pool
        await emit_status(
            lifecycle_token,
            "RESOURCE_DISCOVERY",
            "Checking for available runner in pool",
            {
                "discovery_type": "pool",
                "status": "in_progress"
            }
        )
            
        ready_runner = runner_management.get_runner_from_pool(db_image.id)
        
        if ready_runner:
            logger.info(f"User {db_user.id} requested runner, got ready runner: {ready_runner}")
            
            # Replenish the pool if configured
            if db_image.runner_pool_size != 0:
                asyncio.create_task(
                    runner_management.launch_runners(
                        db_image.identifier, 
                        1, 
                        initiated_by="app_requests_endpoint_pool_replenish"
                    )
                )
                
            await emit_status(
                lifecycle_token,
                "RESOURCE_DISCOVERY",
                "Found an available runner in the pool",
                {
                    "discovery_type": "pool",
                    "runner_id": ready_runner.id,
                    "status": "succeeded"
                }
            )
                
            await emit_status(
                lifecycle_token,
                "RESOURCE_ALLOCATION",
                "Claiming pool runner for your session",
                {
                    "allocation_type": "claim_pool",
                    "runner_id": ready_runner.id,
                    "status": "in_progress"
                }
            )
                
            # Claim the pool runner with the updated function signature
            url = await runner_management.claim_runner(
                runner=ready_runner,
                user=db_user,
                runner_config=runner_config,
                lifecycle_token=lifecycle_token
            )
            
            await emit_status(
                lifecycle_token,
                "RESOURCE_ALLOCATION",
                "Pool runner claimed successfully",
                {
                    "allocation_type": "claim_pool",
                    "runner_id": ready_runner.id,
                    "status": "succeeded"
                }
            )
                
            # Run the script for awaiting_client
            result = await awaiting_client_hook(ready_runner, url, env_vars, lifecycle_token)
            return result
            
        # STEP 3: No existing or pool runner, need to launch a new one
        await emit_status(
            lifecycle_token,
            "RESOURCE_DISCOVERY",
            "No existing or pool runners available",
            {
                "discovery_type": "none",
                "status": "succeeded"
            }
        )
            
        await emit_status(
            lifecycle_token,
            "RESOURCE_ALLOCATION",
            "Launching new runner",
            {
                "allocation_type": "launch_new",
                "image_id": db_image.id,
                "status": "in_progress"
            }
        )
            
        # Launch a new runner
        fresh_runners = await runner_management.launch_runners(
            db_image.identifier,
            1,
            initiated_by="app_requests_endpoint_no_pool",
            claimed=True,
            lifecycle_token=lifecycle_token
        )
        
        if not fresh_runners:
            error_msg = "Failed to launch new runner"
            await emit_status(
                lifecycle_token,
                "ERROR",
                error_msg,
                {
                    "error_type": "launch_failed",
                    "details": {"reason": "No runners were created"}
                },
                is_error=True
            )
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg)
            
        fresh_runner = fresh_runners[0]
        logger.info(f"User {db_user.id} requested runner, got fresh runner: {fresh_runner}")
        
        # Wait for the runner to become ready
        fresh_runner = await runner_management.wait_for_runner_state(
            fresh_runner, 
            "ready_claimed", 
            600
        )
        
        if not fresh_runner or fresh_runner.state != "ready_claimed":
            error_msg = "Runner did not become ready in time"
            await emit_status(
                lifecycle_token,
                "ERROR",
                error_msg,
                {
                    "error_type": "timeout",
                    "details": {"resource_type": "runner"}
                },
                is_error=True
            )
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg)
            
        await emit_status(
            lifecycle_token,
            "RESOURCE_ALLOCATION",
            "New runner launched successfully",
            {
                "allocation_type": "launch_new",
                "runner_id": fresh_runner.id,
                "status": "succeeded"
            }
        )
            
        await emit_status(
            lifecycle_token,
            "CONNECTION_STATUS",
            "New runner is ready, claiming for your session",
            {
                "runner_id": fresh_runner.id,
                "status": "in_progress"
            }
        )
            
        # Claim the fresh runner with the updated function signature
        url = await runner_management.claim_runner(
            runner=fresh_runner,
            user=db_user,
            runner_config=runner_config,
            lifecycle_token=lifecycle_token
        )
        
        # Run the script for awaiting_client
        result = await awaiting_client_hook(fresh_runner, url, env_vars, lifecycle_token)
        return result
        
    except Exception as e:
        # Log the exception
        logger.error(f"Error in process_runner_request: {e}")
        
        # Emit error status if lifecycle_token is provided
        await emit_status(
            lifecycle_token,
            "ERROR",
            f"Error processing runner request: {e!s}",
            {
                "error_type": "request_processing",
                "details": {"exception": str(e)}
            },
            is_error=True
        )
            
        # Re-raise as HTTPException if it's not already one
        if not isinstance(e, HTTPException):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing runner request: {e!s}"
            )
        raise

@handle_runner_errors
async def awaiting_client_hook(
    runner: Runner, 
    url: str, 
    env_vars: dict[str, Any], 
    lifecycle_token: Optional[str] = None
) -> dict:
    """
    Run the script for the "awaiting_client" state.
    
    Args:
        runner: The Runner object
        url: The URL for the runner
        env_vars: Environment variables for the script
        lifecycle_token: Optional token for status tracking
        
    Returns:
        Dictionary with URL and runner_id
        
    Raises:
        Exception: If script execution fails
    """
    try:
        # Emit script starting status
        await emit_status(
            lifecycle_token,
            "INSTANCE_SCRIPT",
            "Running script for awaiting client",
            {
                "runner_id": runner.id,
                "script_type": "awaiting_client",
                "status": "in_progress"
            }
        )

        # Execute the script
        script_result = await script_management.run_script_for_runner(
            "on_awaiting_client",
            runner.id,
            env_vars,
            initiated_by="app_requests_endpoint"
        )

        # Emit script success status
        await emit_status(
            lifecycle_token,
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
        await emit_status(
            lifecycle_token,
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
        await emit_status(
            lifecycle_token,
            "CONNECTION_STATUS",
            "Your runner is ready for connection",
            {
                "runner_id": runner.id,
                "status": "succeeded",
                "url": url
            }
        )

    except Exception as e:
        # Emit script failure status
        await emit_status(
            lifecycle_token,
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
        await emit_status(
            lifecycle_token,
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
        await emit_status(
            lifecycle_token,
            "INSTANCE_LIFECYCLE",
            "Shutting down runner",
            {
                "runner_id": runner.id,
                "state": "terminating",
                "reason": "Script execution failed",
            }
        )

        # Shutdown the runner
        await runner_management.force_shutdown_runners(
            [runner.identifier],
            initiated_by="app_requests_endpoint"
        )
        raise 

    return app_requests_dto(url, runner)

def app_requests_dto(url: str, runner: Runner) -> dict:
    """
    Create response DTO for runner requests.
    
    Args:
        url: The URL for the runner
        runner: The Runner object
        
    Returns:
        Dictionary with URL and runner_id
    """
    return {"url": url, "runner_id": str(runner.id)}

@router.post("/", response_model=dict[str, str])
async def get_ready_runner(
    request: RunnerRequest,
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
    # Emit an initial status update for the direct endpoint (no lifecycle_token)
    # The direct endpoint has no lifecycle_token for WebSocket updates, but we can still log the request
    logger.info(f"Processing direct runner request for image {request.image_id} and user {request.user_email}")
    
    try:
        return await process_runner_request(
            request=request,
            client_ip=client_ip,
            x_forwarded_for=x_forwarded_for
        )
    except HTTPException as e:
        # Log the exception for the direct endpoint
        logger.error(f"Error processing direct runner request: {e.detail}")
        raise

@router.post("/with-status/", response_model=dict)
async def get_ready_runner_with_status(
    request: RunnerRequest
):
    """
    Request a runner and return a lifecycle_token for tracking status via WebSocket.
    
    This endpoint immediately returns a lifecycle_token and processes the request asynchronously.
    Clients can use the runner_status WebSocket endpoint to receive real-time updates.
    """
    # Generate a unique lifecycle token
    lifecycle_token = str(uuid4())
    
    try:
        # Emit an initial status update for the with-status endpoint
        await emit_status(
            lifecycle_token,
            "REQUEST_RECEIVED",
            "Runner request received and queued for processing",
            {
                "image_id": request.image_id,
                "user_email": request.user_email,
                "status": "queued",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        
        # Start processing in background task
        asyncio.create_task(
            process_runner_request(
                request=request,
                lifecycle_token=lifecycle_token
            )
        )
        
        # Return the lifecycle token immediately
        return {
            "lifecycle_token": lifecycle_token,
            "status": "processing",
            "message": "Runner request is being processed"
        }
        
    except Exception as e:
        logger.error(f"Error in get_ready_runner_with_status: {e}")
        
        # Emit error status
        await emit_status(
            lifecycle_token,
            "ERROR",
            f"Error initiating runner request: {e!s}",
            {
                "error_type": "initialization",
                "details": {"exception": str(e)}
            },
            is_error=True
        )
        
        return {
            "lifecycle_token": lifecycle_token,
            "status": "error",
            "message": f"Error: {e!s}"
        }

@router.websocket("/runner_status")
async def runner_status_websocket(
    websocket: WebSocket,
    lifecycle_token: str = Query(...),
):
    """
    WebSocket endpoint for runner status updates.

    Clients connect to this endpoint with a lifecycle_token to receive
    real-time updates about runner provisioning and lifecycle events.
    The lifecycle_token is provided as a query parameter.
    """
    try:
        print(f"got token: {lifecycle_token}")
        await runner_management.wait_for_lifecycle_token(lifecycle_token)
    except:
        print(f"rejected token: {lifecycle_token}")
        raise HTTPException(403, "Lifecycle token invalid.")
    try:
        # Connect the client (will send any buffered messages)
        await websocket_management.connection_manager.connect(websocket, "runner_status", lifecycle_token)

        # Send initial connection confirmation
        await websocket.send_json({
            "type": "CONNECTED",
            "message": f"Connected to runner status updates for token {lifecycle_token}",
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
        logger.info(f"Client disconnected from runner status updates for token {lifecycle_token}")
        websocket_management.connection_manager.disconnect("runner_status", lifecycle_token)
    except Exception as e:
        logger.error(f"Error in runner status WebSocket for token {lifecycle_token}: {e}")
        try:
            await websocket.send_json({
                "type": "ERROR",
                "message": f"WebSocket error: {e!s}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error_type": "websocket"
            })
        except Exception:
            pass
        websocket_management.connection_manager.disconnect("runner_status", lifecycle_token)