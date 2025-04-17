"""Runner status management module."""
# app/util/runner_status_management.py
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from sqlmodel import Session, select, func
import logging
import asyncio
from app.util import websocket_management
from app.db import runner_repository
from app.models import RunnerHistory
from app.db.database import engine

logger = logging.getLogger(__name__)

class RunnerStatusEmitter:
    """Helper class for emitting runner status events."""

    @staticmethod
    async def emit_status(request_id: str, status_type: str, message: str, data: Optional[dict[str, Any]] = None):
        """Emit a status update to a connected WebSocket client."""
        try:
            if not request_id:
                return False

            status_data = {
                "type": status_type,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            if data:
                status_data.update(data)

            success = await websocket_management.connection_manager.send_json("runner_status", request_id, status_data)
            if success:
                logger.debug(f"Emitted status {status_type} for request {request_id}")
            return success
        except Exception as e:
            logger.error(f"Error emitting status: {e}")
            return False

async def track_runner_state(runner_id: int, request_id: str):
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
                await runner_status_emitter.emit_status(request_id, "ERROR", "Runner not found")
                return

            # If runner is in terminal state, stop tracking
            if runner.state in ["ready", "ready_claimed", "active", "terminated", "error", "awaiting_client"]:
                # Emit final state
                await runner_status_emitter.emit_status(
                    request_id,
                    "INSTANCE_STATE",
                    f"Runner is in {runner.state} state",
                    {"state": runner.state, "runner_id": runner_id}
                )

                # If runner is ready, emit connection info
                if runner.state in ["ready", "ready_claimed", "active", "awaiting_client"]:
                    await runner_status_emitter.emit_status(
                        request_id,
                        "RUNNER_READY",
                        "Runner is ready to use",
                        {"runner_id": runner_id}
                    )

                return

        # Process new events and emit appropriate status messages
        for event in new_events:
            last_event_id = event.id

            # Map history events to WebSocket messages
            await process_runner_event(request_id, runner_id, event)

        # Wait before checking again
        await asyncio.sleep(5)

async def process_runner_event(request_id: str, runner_id: int, event: RunnerHistory):
    """Process a runner event and emit appropriate status."""
    event_map = {
        "runner_created": ("INSTANCE_BOOTING", "Runner record created"),
        "instance_starting": ("INSTANCE_STARTING", "Virtual machine is starting"),
        "instance_running": ("INSTANCE_RUNNING", "Virtual machine is now running"),
        "instance_ip_assigning": ("INSTANCE_IP_ASSIGNING", "IP address is being assigned"),
        "instance_ip_assigned": ("INSTANCE_IP_ASSIGNED", "IP address assigned to runner"),
        "ssh_waiting": ("INSTANCE_SSH_WAITING", "Waiting for SSH connection"),
        "ssh_available": ("INSTANCE_SSH_AVAILABLE", "SSH connection available"),
        "startup_script_starting": ("INSTANCE_STARTUP_PROCESS_STARTED", "Initialization script started"),
        "startup_script_completed": ("INSTANCE_STARTUP_PROCESS_COMPLETE", "Initialization script completed"),
        "startup_script_failed": ("INSTANCE_STARTUP_PROCESS_FAILED", "Initialization script failed"),
        "runner_shutdown": ("INSTANCE_SHUTTING_DOWN", "Runner is shutting down"),
    }

    if event.event_name in event_map:
        status_type, message = event_map[event.event_name]
        await runner_status_emitter.emit_status(
            request_id,
            status_type,
            message,
            {"runner_id": runner_id, "event_data": event.event_data}
        )

# # Helper function for Celery tasks (sync context)
# def emit_status_sync(request_id: str, status_type: str, message: str, data: Optional[dict[str, Any]] = None):
#     """Synchronous version of emit_status for use in Celery tasks."""
#     if not request_id:
#         return False

#     # Create an event loop if there isn't one
#     try:
#         loop = asyncio.get_event_loop()
#     except RuntimeError:
#         loop = asyncio.new_event_loop()
#         asyncio.set_event_loop(loop)

#     # Run the async function
#     return loop.run_until_complete(
#         RunnerStatusEmitter.emit_status(request_id, status_type, message, data)
#     )

# Global instance
runner_status_emitter = RunnerStatusEmitter()
