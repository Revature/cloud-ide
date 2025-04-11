# app/services/terminal_management.py

from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import logging
from typing import Dict, Any

from app.business import ssh_management, key_management

logger = logging.getLogger(__name__)

# Store active connections
active_connections: Dict[int, Dict[str, Any]] = {}

async def connect_terminal(websocket: WebSocket, runner):
    """Establish SSH connection to runner and set up WebSocket relay"""
    runner_id = runner.id
    
    try:
        # Get SSH key
        key = key_management.get_runner_key(runner.key_id)
        if not key:
            await websocket.close(code=1008, reason="SSH key not found")
            return
        
        # Establish SSH connection
        ssh_client, ssh_channel = await ssh_management.connect_to_runner(
            runner.ip_address, 
            key.private_key, 
            key.private_key_path
        )
        
        # Store connection info
        active_connections[runner_id] = {
            "ssh_client": ssh_client,
            "ssh_channel": ssh_channel
        }
        
        # Set up bidirectional relay
        await _handle_terminal_session(websocket, ssh_channel, runner_id)
        
    except Exception as e:
        logger.exception(f"Terminal connection error: {str(e)}")
        await websocket.close(code=1011, reason=f"Connection error: {str(e)}")
        if runner_id in active_connections:
            await cleanup_connection(runner_id)

async def _handle_terminal_session(websocket: WebSocket, ssh_channel, runner_id: int):
    """Handle bidirectional data relay between WebSocket and SSH"""
    
    # SSH to WebSocket relay task
    async def ssh_to_ws():
        try:
            while True:
                if ssh_channel.recv_ready():
                    data = ssh_channel.recv(1024)
                    if data:
                        await websocket.send_bytes(data)
                    else:
                        break
                else:
                    await asyncio.sleep(0.1)
        except Exception as e:
            logger.exception(f"SSH to WebSocket error: {str(e)}")
            return
    
    # Start the relay task
    ssh_to_ws_task = asyncio.create_task(ssh_to_ws())
    
    try:
        # WebSocket to SSH relay loop
        while True:
            data = await websocket.receive_bytes()
            
            # Handle control messages
            if await _handle_control_message(data, ssh_channel):
                continue
            
            # Send data to SSH
            if ssh_channel.send_ready():
                ssh_channel.send(data)
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for runner {runner_id}")
    except Exception as e:
        logger.exception(f"Terminal session error: {str(e)}")
    finally:
        # Clean up
        ssh_to_ws_task.cancel()
        try:
            await ssh_to_ws_task
        except asyncio.CancelledError:
            pass
        
        await cleanup_connection(runner_id)

async def _handle_control_message(data, ssh_channel) -> bool:
    """Handle special control messages like terminal resize
    
    Returns True if the message was a control message and was handled
    """
    try:
        message = data.decode('utf-8')
        if message.startswith('{"resize":'):
            import json
            resize_data = json.loads(message)
            if "resize" in resize_data:
                cols = resize_data["resize"].get("cols", 80)
                rows = resize_data["resize"].get("rows", 24)
                ssh_channel.resize_pty(width=cols, height=rows)
                return True
    except:
        pass

    return False

async def cleanup_connection(runner_id: int):
    """Clean up SSH connections for a specific runner"""
    if runner_id in active_connections:
        conn_info = active_connections[runner_id]
        
        if "ssh_channel" in conn_info and conn_info["ssh_channel"]:
            conn_info["ssh_channel"].close()
            
        if "ssh_client" in conn_info and conn_info["ssh_client"]:
            conn_info["ssh_client"].close()
            
        del active_connections[runner_id]
        logger.info(f"Cleaned up connection for runner {runner_id}")

# Called on application shutdown
async def cleanup_all_connections():
    """Clean up all active SSH connections"""
    for runner_id in list(active_connections.keys()):
        await cleanup_connection(runner_id)