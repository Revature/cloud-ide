"""Runner status management module with granular event structure."""
# app/util/runner_status_management.py
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Literal
from sqlmodel import Session, select, func
import logging
import asyncio
from app.util import websocket_management
from app.db import runner_repository
from app.models import RunnerHistory
from app.db.database import engine

logger = logging.getLogger(__name__)

# Define status types for type checking
StatusType = Literal[
    "INSTANCE_SCRIPT",
    "INSTANCE_LIFECYCLE",
    "REQUEST_PROCESSING",
    "RESOURCE_DISCOVERY",
    "RESOURCE_ALLOCATION",
    "CONNECTION_STATUS",
    "SECURITY_UPDATE",
    "NETWORK_SETUP",
    "RESOURCE_TAGGING",
    "VM_CREATION",
    "RUNNER_REGISTRATION",
    "INSTANCE_PREPARATION",
    "SESSION_STATUS",
    "PROGRESS_UPDATE",
    "ERROR",
    "CUSTOM"
]

class RunnerStatusEmitter:
    """Helper class for emitting runner status events."""

    @staticmethod
    async def emit_status(lifecycle_token: str, status_type: StatusType, message: str, data: Optional[dict[str, Any]] = None):
        """Emit a status update to a connected WebSocket client."""
        try:
            if not lifecycle_token:
                return False

            status_data = {
                "type": status_type,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            if data:
                status_data.update(data)

            success = await websocket_management.connection_manager.send_json("runner_status", lifecycle_token, status_data)
            if success:
                logger.debug(f"Emitted status {status_type} for request {lifecycle_token}")
            return success
        except Exception as e:
            logger.error(f"Error emitting status: {e}")
            return False

async def track_runner_state(runner_id: int, lifecycle_token: str):
    """Track runner state changes and emit events to WebSocket clients."""
    # Last processed event ID
    last_event_id = 0

    # Get initial state
    with Session(engine) as session:
        runner = runner_repository.find_runner_by_id(session, runner_id)
        if not runner:
            return

        # Get the latest history record ID to start tracking from
        stmt = select(func.max(RunnerHistory.id)).where(RunnerHistory.runner_id == runner_id)
        last_event_id = session.exec(stmt).one_or_none() or 0

    # Track for up to 5 minutes
    timeout = datetime.now() + timedelta(minutes=5)

    while datetime.now() < timeout:
        # Check for new history records
        with Session(engine) as session:
            query = select(RunnerHistory).where(
                RunnerHistory.runner_id == runner_id,
                RunnerHistory.id > last_event_id
            ).order_by(RunnerHistory.id)

            new_events = session.exec(query).all()

            # Get current runner state
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner:
                await runner_status_emitter.emit_status(
                    lifecycle_token,
                    "ERROR",
                    "Runner not found",
                    {
                        "error_type": "not_found",
                        "details": {
                            "resource_type": "runner"
                        }
                    }
                )
                return

            # If runner is in terminal state, stop tracking
            if runner.state in ["ready", "ready_claimed", "active", "terminated", "error", "awaiting_client"]:
                # Emit final state
                await runner_status_emitter.emit_status(
                    lifecycle_token,
                    "INSTANCE_LIFECYCLE",
                    f"Runner is in {runner.state} state",
                    {
                        "runner_id": runner_id,
                        "state": runner.state
                    }
                )

                # If runner is ready, emit connection info and progress update
                if runner.state in ["ready", "ready_claimed", "active", "awaiting_client"]:
                    await runner_status_emitter.emit_status(
                        lifecycle_token,
                        "CONNECTION_STATUS",
                        "Runner is ready for connection",
                        {
                            "runner_id": runner_id,
                            "status": "succeeded",
                        }
                    )

                    # Also emit a final progress update
                    await runner_status_emitter.emit_status(
                        lifecycle_token,
                        "PROGRESS_UPDATE",
                        "Your development environment is ready",
                        {
                            "progress": 100,
                            "stage": "ready",
                            "status": "succeeded",
                            "runner_id": runner_id
                        }
                    )

                return

        # Process new events and emit appropriate status messages
        for event in new_events:
            last_event_id = event.id

            # Map history events to WebSocket messages
            await process_runner_event(lifecycle_token, runner_id, event)

        # Wait before checking again
        await asyncio.sleep(5)

async def process_runner_event(lifecycle_token: str, runner_id: int, event: RunnerHistory):
    """Process a runner event and emit appropriate status."""
    # Map runner history events to standardized event types
    event_map = {
        # Runner registration events
        "runner_created": {
            "type": "RUNNER_REGISTRATION",
            "message": "Runner record created successfully",
            "status": "succeeded"
        },

        # VM creation and preparation events
        "instance_starting": {
            "type": "INSTANCE_PREPARATION",
            "message": "Virtual machine is booting",
            "preparation_type": "boot",
            "status": "in_progress"
        },
        "instance_running": {
            "type": "INSTANCE_PREPARATION",
            "message": "Virtual machine is running",
            "preparation_type": "boot",
            "status": "succeeded"
        },

        # Network setup events
        "instance_ip_assigning": {
            "type": "NETWORK_SETUP",
            "message": "Allocating IP address for runner",
            "setup_type": "allocate_ip",
            "status": "in_progress"
        },
        "instance_ip_assigned": {
            "type": "NETWORK_SETUP",
            "message": "IP address allocated to runner",
            "setup_type": "allocate_ip",
            "status": "succeeded"
        },

        # Connection events
        "ssh_waiting": {
            "type": "CONNECTION_STATUS",
            "message": "Waiting for SSH connection",
            "status": "in_progress"
        },
        "ssh_available": {
            "type": "CONNECTION_STATUS",
            "message": "SSH connection available",
            "status": "succeeded"
        },

        # Script execution events
        "startup_script_starting": {
            "type": "INSTANCE_SCRIPT",
            "message": "Initialization script started",
            "script_type": "startup",
            "status": "in_progress"
        },
        "startup_script_completed": {
            "type": "INSTANCE_SCRIPT",
            "message": "Initialization script completed",
            "script_type": "startup",
            "status": "succeeded"
        },
        "startup_script_failed": {
            "type": "INSTANCE_SCRIPT",
            "message": "Initialization script failed",
            "script_type": "startup",
            "status": "failed"
        },

        # Lifecycle events
        "runner_shutdown": {
            "type": "INSTANCE_LIFECYCLE",
            "message": "Runner is shutting down",
            "state": "terminating"
        },

        # Security events
        "security_group_creating": {
            "type": "SECURITY_UPDATE",
            "message": "Creating security group for runner",
            "update_type": "create_security_group",
            "status": "in_progress"
        },
        "security_group_created": {
            "type": "SECURITY_UPDATE",
            "message": "Security group created for runner",
            "update_type": "create_security_group",
            "status": "succeeded"
        },
        "security_group_updating": {
            "type": "SECURITY_UPDATE",
            "message": "Updating security group to allow user access",
            "update_type": "update_security_group",
            "status": "in_progress"
        },
        "security_group_updated": {
            "type": "SECURITY_UPDATE",
            "message": "Security group updated to allow user access",
            "update_type": "update_security_group",
            "status": "succeeded"
        },

        # Tagging events
        "instance_tagging": {
            "type": "RESOURCE_TAGGING",
            "message": "Adding tags to instance",
            "status": "in_progress"
        },
        "instance_tagged": {
            "type": "RESOURCE_TAGGING",
            "message": "Instance tag added for user",
            "status": "succeeded"
        }
    }

    if event.event_name in event_map:
        event_config = event_map[event.event_name]
        event_data = {
            "runner_id": runner_id,
        }

        # Add event data from history record if available
        if event.event_data:
            if isinstance(event.event_data, dict):
                # Include relevant event data from the original event
                if "error" in event.event_data:
                    event_data["error"] = event.event_data["error"]
                if "exit_code" in event.event_data:
                    event_data["exit_code"] = event.event_data["exit_code"]
                if "instance_id" in event.event_data:
                    event_data["instance_id"] = event.event_data["instance_id"]
                if "ip_address" in event.event_data:
                    event_data["details"] = {"ip_address": event.event_data["ip_address"]}
                if "security_group_id" in event.event_data:
                    event_data["details"] = {"security_group_id": event.event_data["security_group_id"]}
                if "tags" in event.event_data:
                    event_data["tags"] = event.event_data["tags"]
            else:
                # If event_data is not a dict, include it as a string
                event_data["details"] = event.event_data

        # Add event config data to the payload
        event_data.update({k: v for k, v in event_config.items() if k not in ["type", "message"]})

        # Emit the status
        await runner_status_emitter.emit_status(
            lifecycle_token,
            event_config["type"],
            event_config["message"],
            event_data
        )

        # Also emit a progress update based on the event
        # await emit_progress_update(lifecycle_token, runner_id, event.event_name)

# async def emit_progress_update(lifecycle_token: str, runner_id: int, event_name: str):
#     """Emit a progress update based on the current stage of runner creation."""
#     # Map events to progress stages and percentages
#     progress_map = {
#         "runner_created": {
#             "message": "Processing your request",
#             "progress": 10,
#             "stage": "request"
#         },
#         "instance_starting": {
#             "message": "Allocating resources for your session",
#             "progress": 20,
#             "stage": "allocation"
#         },
#         "instance_running": {
#             "message": "Resources allocated successfully",
#             "progress": 30,
#             "stage": "allocation"
#         },
#         "instance_ip_assigned": {
#             "message": "Setting up network configuration",
#             "progress": 40,
#             "stage": "preparation"
#         },
#         "security_group_created": {
#             "message": "Establishing security settings",
#             "progress": 50,
#             "stage": "preparation"
#         },
#         "security_group_updated": {
#             "message": "Configuring user access",
#             "progress": 60,
#             "stage": "preparation"
#         },
#         "ssh_available": {
#             "message": "Preparing your development environment",
#             "progress": 70,
#             "stage": "preparation"
#         },
#         "startup_script_starting": {
#             "message": "Installing required tools",
#             "progress": 80,
#             "stage": "configuration"
#         },
#         "startup_script_completed": {
#             "message": "Setting up your repositories and tools",
#             "progress": 90,
#             "stage": "configuration"
#         }
#     }

#     if event_name in progress_map:
#         progress_data = progress_map[event_name]
#         progress_data["runner_id"] = runner_id
#         progress_data["status"] = "in_progress"

#         # For completed events, mark as succeeded
#         if event_name in ["instance_running", "security_group_updated", "startup_script_completed"]:
#             progress_data["status"] = "succeeded"

#         await runner_status_emitter.emit_status(
#             lifecycle_token,
#             "PROGRESS_UPDATE",
#             progress_data["message"],
#             progress_data
#         )

# Global instance
runner_status_emitter = RunnerStatusEmitter()
