"""WebSocket management for handling connections and broadcasting messages."""
# app/util/websocket_management.py
from fastapi import WebSocket
from typing import Any
import logging

logger = logging.getLogger(__name__)

class PendingMessageBuffer:
    """Buffer for storing messages before clients connect."""

    def __init__(self):
        """Initialize the pending message buffer."""
        self.pending_messages: dict[str, list[dict]] = {}

    def add_message(self, connection_type: str, connection_id: str, message: dict):
        """Store a message for a connection that's not yet established."""
        key = f"{connection_type}:{connection_id}"
        if key not in self.pending_messages:
            self.pending_messages[key] = []
        self.pending_messages[key].append(message)

    def get_messages(self, connection_type: str, connection_id: str) -> list[dict]:
        """Get and clear all pending messages for a connection."""
        key = f"{connection_type}:{connection_id}"
        messages = self.pending_messages.get(key, [])
        if key in self.pending_messages:
            del self.pending_messages[key]
        return messages

class ConnectionManager:
    """Manage WebSocket connections for runner status updates."""

    def __init__(self):
        """Initialize the connection manager."""
        self.active_connections = {}
        self.pending_message_buffer = PendingMessageBuffer()

    async def connect(self, websocket: WebSocket, connection_type: str, connection_id: str):
        """Accept and store a new WebSocket connection, sending any buffered messages."""
        await websocket.accept()

        if connection_type not in self.active_connections:
            self.active_connections[connection_type] = {}

        self.active_connections[connection_type][connection_id] = websocket
        logger.info(f"WebSocket connected: {connection_type}:{connection_id}")

        # Send any pending messages
        pending_messages = self.pending_message_buffer.get_messages(connection_type, connection_id)
        for message in pending_messages:
            await websocket.send_json(message)
            logger.debug(f"Sent buffered message to {connection_type}:{connection_id}")

    def disconnect(self, connection_type: str, connection_id: str):
        """Remove a WebSocket connection."""
        if connection_type in self.active_connections:
            if connection_id in self.active_connections[connection_type]:
                del self.active_connections[connection_type][connection_id]
                logger.info(f"WebSocket disconnected: {connection_type}:{connection_id}")

                if not self.active_connections[connection_type]:
                    del self.active_connections[connection_type]

    async def send_json(self, connection_type: str, connection_id: str, data: Any):
        """Send JSON data to a specific WebSocket connection or buffer it if not connected."""
        if connection_type in self.active_connections and connection_id in self.active_connections[connection_type]:
            try:
                websocket = self.active_connections[connection_type][connection_id]
                await websocket.send_json(data)
                return True
            except Exception as e:
                logger.error(f"Error sending data to WebSocket: {e}")
                self.disconnect(connection_type, connection_id)
        else:
            # Connection doesn't exist yet, buffer the message
            self.pending_message_buffer.add_message(connection_type, connection_id, data)
            logger.debug(f"Buffered message for future connection {connection_type}:{connection_id}")
        return False

    async def broadcast(self, connection_type: str, data: Any):
        """Send data to all connections of a specific type."""
        if connection_type in self.active_connections:
            for connection_id in list(self.active_connections[connection_type].keys()):
                await self.send_json(connection_type, connection_id, data)

# Global instance
connection_manager = ConnectionManager()
