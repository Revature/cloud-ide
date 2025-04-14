# app/services/terminal_management.py

from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import logging
import time
from typing import Dict, Any, Optional

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
            print(f"ERROR: SSH key not found for runner {runner_id}")
            await websocket.close(code=1008, reason="SSH key not found")
            return

        print(f"DEBUG: Attempting SSH connection to {runner.url} for runner {runner_id}")
        # Establish SSH connection
        ssh_client, ssh_channel = await ssh_management.connect_to_runner(
            runner.url, 
            key
        )
        print(f"DEBUG: SSH connection established to {runner.url} for runner {runner_id}")

        # Store connection info
        active_connections[runner_id] = {
            "ssh_client": ssh_client,
            "ssh_channel": ssh_channel
        }

        # Send initial commands to ensure prompt appears
        if ssh_channel.send_ready():
            print(f"DEBUG: Sending initial newline to get prompt")
            ssh_channel.send("\n")  # Send newline to get a prompt
            
            # Wait briefly for terminal to initialize
            await asyncio.sleep(0.5)
            
            # Send a simple command to verify the connection
            print(f"DEBUG: Sending 'echo Hello Terminal' to verify connection")
            ssh_channel.send("echo Hello Terminal\n")
        else:
            print(f"WARNING: SSH channel not ready to send initial commands")

        print(f"DEBUG: Starting bidirectional relay for runner {runner_id}")
        # Set up bidirectional relay
        await _handle_terminal_session(websocket, ssh_channel, runner_id)
        print(f"DEBUG: Relay closed for runner {runner_id}")
        
    except Exception as e:
        print(f"ERROR: Terminal connection error: {str(e)}")
        await websocket.close(code=1011, reason=f"Connection error: {str(e)}")
        if runner_id in active_connections:
            await cleanup_connection(runner_id)

async def _handle_terminal_session(websocket: WebSocket, ssh_channel, runner_id: int):
    """Handle bidirectional data relay between WebSocket and SSH"""
    
    # Update the last activity timestamp
    def update_activity():
        if runner_id in active_connections:
            active_connections[runner_id]["last_activity"] = time.time()
    
    # SSH to WebSocket relay task
    async def ssh_to_ws():
        buffer_size = 4096  # Larger buffer for better performance
        try:
            while True:
                # Use a run_in_executor for the blocking recv_ready and recv calls
                loop = asyncio.get_running_loop()
                
                recv_ready = await loop.run_in_executor(
                    None, lambda: ssh_channel.recv_ready()
                )
                
                if recv_ready:
                    data = await loop.run_in_executor(
                        None, lambda: ssh_channel.recv(buffer_size)
                    )
                    
                    if data:
                        logger.debug(f"SSH → WS: {len(data)} bytes")
                        await websocket.send_bytes(data)
                        update_activity()
                    else:
                        logger.info(f"No data received from SSH for runner {runner_id}, closing connection")
                        break
                else:
                    await asyncio.sleep(0.05)  # Reduced sleep time for more responsiveness
        except asyncio.CancelledError:
            logger.debug(f"SSH to WS task cancelled for runner {runner_id}")
            raise
        except Exception as e:
            logger.exception(f"SSH to WebSocket error for runner {runner_id}: {str(e)}")
            return

    # Start the relay task
    ssh_to_ws_task = asyncio.create_task(ssh_to_ws())

    try:
        # WebSocket to SSH relay loop
        while True:
            # Receive message without assuming type
            message = await websocket.receive()
            update_activity()
            
            loop = asyncio.get_running_loop()
            send_ready = await loop.run_in_executor(
                None, lambda: ssh_channel.send_ready()
            )
            
            # Handle text messages (including control messages)
            if "text" in message:
                text_data = message["text"]
                logger.debug(f"WS → SSH (text): {text_data}")
                
                # Check if this is a control message
                if text_data.startswith("{"):
                    try:
                        import json
                        control_data = json.loads(text_data)

                        # Handle resize message
                        if "type" in control_data and control_data["type"] == "resize":
                            cols = control_data.get("cols", 80)
                            rows = control_data.get("rows", 24)
                            logger.debug(f"Resizing terminal to {cols}x{rows} for runner {runner_id}")
                            
                            # Run the resize operation in an executor
                            await loop.run_in_executor(
                                None, 
                                lambda: ssh_channel.resize_pty(width=cols, height=rows)
                            )
                            continue
                    except json.JSONDecodeError:
                        pass  # Not a valid JSON control message

                # Ensure the command ends with a newline for proper execution
                if not text_data.endswith('\n') and not text_data.endswith('\r'):
                    text_data += '\n'

                # Send text to SSH
                if send_ready:
                    await loop.run_in_executor(
                        None, 
                        lambda: ssh_channel.send(text_data)
                    )
                    logger.debug(f"Sent {len(text_data)} bytes to SSH for runner {runner_id}")
                else:
                    logger.warning(f"SSH channel not ready to receive data for runner {runner_id}")
            
            # Handle binary messages
            elif "bytes" in message:
                binary_data = message["bytes"]
                logger.debug(f"WS → SSH (binary): {len(binary_data)} bytes")
                
                if send_ready:
                    await loop.run_in_executor(
                        None, 
                        lambda: ssh_channel.send(binary_data)
                    )
                    logger.debug(f"Sent {len(binary_data)} bytes to SSH for runner {runner_id}")
                else:
                    logger.warning(f"SSH channel not ready to receive binary data for runner {runner_id}")
                    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for runner {runner_id}")
    except asyncio.CancelledError:
        logger.info(f"Terminal session task cancelled for runner {runner_id}")
        raise
    except Exception as e:
        logger.exception(f"Terminal session error for runner {runner_id}: {str(e)}")
    finally:
        # Clean up
        ssh_to_ws_task.cancel()
        try:
            await ssh_to_ws_task
        except asyncio.CancelledError:
            pass

        await cleanup_connection(runner_id)

async def cleanup_connection(runner_id: int):
    """Clean up SSH connections for a specific runner"""
    if runner_id in active_connections:
        conn_info = active_connections[runner_id]

        try:
            if "ssh_channel" in conn_info and conn_info["ssh_channel"]:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: conn_info["ssh_channel"].close()
                )
                
            if "ssh_client" in conn_info and conn_info["ssh_client"]:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: conn_info["ssh_client"].close()
                )
        except Exception as e:
            logger.exception(f"Error closing SSH connection for runner {runner_id}: {str(e)}")
            
        del active_connections[runner_id]
        logger.info(f"Cleaned up connection for runner {runner_id}")

# Called on application shutdown
async def cleanup_all_connections():
    """Clean up all active SSH connections"""
    for runner_id in list(active_connections.keys()):
        await cleanup_connection(runner_id)

# Periodic task to check for stale connections
async def check_stale_connections():
    """Check for and clean up stale connections"""
    current_time = time.time()
    timeout = 600  # 10 minutes
    
    for runner_id in list(active_connections.keys()):
        last_activity = active_connections[runner_id].get("last_activity", 0)
        if current_time - last_activity > timeout:
            logger.info(f"Cleaning up stale connection for runner {runner_id}")
            await cleanup_connection(runner_id)