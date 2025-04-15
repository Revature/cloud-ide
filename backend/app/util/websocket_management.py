# app/util/websocket_management.py
from fastapi import WebSocket
from typing import Any
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manage WebSocket connections for runner status updates."""
    
    def __init__(self):
        self.active_connections: dict[str, dict[str, WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, connection_type: str, connection_id: str):
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        
        if connection_type not in self.active_connections:
            self.active_connections[connection_type] = {}
            
        self.active_connections[connection_type][connection_id] = websocket
        logger.info(f"WebSocket connected: {connection_type}:{connection_id}")
        
    def disconnect(self, connection_type: str, connection_id: str):
        """Remove a WebSocket connection."""
        if connection_type in self.active_connections:
            if connection_id in self.active_connections[connection_type]:
                del self.active_connections[connection_type][connection_id]
                logger.info(f"WebSocket disconnected: {connection_type}:{connection_id}")
                
                if not self.active_connections[connection_type]:
                    del self.active_connections[connection_type]
    
    async def send_json(self, connection_type: str, connection_id: str, data: Any):
        """Send JSON data to a specific WebSocket connection."""
        if connection_type in self.active_connections:
            if connection_id in self.active_connections[connection_type]:
                try:
                    websocket = self.active_connections[connection_type][connection_id]
                    await websocket.send_json(data)
                    return True
                except Exception as e:
                    logger.error(f"Error sending data to WebSocket: {e}")
                    self.disconnect(connection_type, connection_id)
        return False

    async def broadcast(self, connection_type: str, data: Any):
        """Send data to all connections of a specific type."""
        if connection_type in self.active_connections:
            for connection_id in list(self.active_connections[connection_type].keys()):
                await self.send_json(connection_type, connection_id, data)

# Global instance
connection_manager = ConnectionManager()