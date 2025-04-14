# app/services/ssh_management.py

import paramiko
from io import StringIO
import logging
import asyncio
from typing import Tuple, Optional, Dict, Any

logger = logging.getLogger(__name__)

async def connect_to_runner(
    ip_address: str, 
    private_key: Optional[str] = None,
    username: str = "ubuntu"
) -> Tuple[paramiko.SSHClient, paramiko.Channel]:
    """Establish SSH connection to a runner and return client and shell channel"""
    
    logger.info(f"Connecting to runner at {ip_address} with user {username}")
    
    # Set up SSH client
    ssh_client = paramiko.SSHClient()
    ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # Load the private key
        if private_key:
            pkey = paramiko.RSAKey.from_private_key(StringIO(private_key))
        else:
            raise ValueError("Private key must be provided")

        # Create a separate thread for the blocking SSH connection
        loop = asyncio.get_running_loop()
        ssh_connection_result = await loop.run_in_executor(
            None,
            lambda: _establish_ssh_connection(ssh_client, ip_address, username, pkey)
        )

        if not ssh_connection_result["success"]:
            raise ssh_connection_result["error"]
            
        logger.info(f"SSH connection established to {ip_address}")

        # Now create the interactive shell channel
        transport = ssh_client.get_transport()
        transport.set_keepalive(30)  # Send keep-alive packet every 30 seconds
        
        # Create shell channel (also should be run in executor since it's blocking)
        ssh_channel_result = await loop.run_in_executor(
            None,
            lambda: _create_ssh_channel(transport)
        )
        
        if not ssh_channel_result["success"]:
            ssh_client.close()
            raise ssh_channel_result["error"]
        
        ssh_channel = ssh_channel_result["channel"]
        logger.info(f"Interactive shell channel created for {ip_address}")
        
        # Wait for initial prompt
        await asyncio.sleep(1)
        
        return ssh_client, ssh_channel

    except Exception as e:
        # Clean up on error
        if ssh_client:
            ssh_client.close()
        logger.exception(f"SSH connection error: {str(e)}")
        raise

def _establish_ssh_connection(
    ssh_client: paramiko.SSHClient,
    ip_address: str,
    username: str,
    pkey: paramiko.RSAKey
) -> Dict[str, Any]:
    """Non-async function to establish SSH connection (to be run in executor)"""
    try:
        ssh_client.connect(
            hostname=ip_address,
            username=username,
            pkey=pkey,
            timeout=15,
            allow_agent=False,
            look_for_keys=False
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": e}

def _create_ssh_channel(transport: paramiko.Transport) -> Dict[str, Any]:
    """Non-async function to create SSH channel (to be run in executor)"""
    try:
        ssh_channel = transport.open_session()
        ssh_channel.get_pty(term="xterm-256color", width=80, height=24)
        ssh_channel.invoke_shell()
        ssh_channel.settimeout(10.0)  # Set timeout for channel operations
        ssh_channel.setblocking(0)
        return {"success": True, "channel": ssh_channel}
    except Exception as e:
        return {"success": False, "error": e}

async def execute_command(
    ssh_client: paramiko.SSHClient,
    command: str,
    timeout: int = 60
) -> Dict[str, str]:
    """Execute a command on the runner and return stdout/stderr"""
    
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        lambda: _execute_command_sync(ssh_client, command, timeout)
    )
    
    return result

def _execute_command_sync(
    ssh_client: paramiko.SSHClient,
    command: str,
    timeout: int
) -> Dict[str, str]:
    """Synchronous command execution (to be run in executor)"""
    try:
        stdin, stdout, stderr = ssh_client.exec_command(command, timeout=timeout)
        
        # Wait for command to complete
        exit_status = stdout.channel.recv_exit_status()
        
        stdout_data = stdout.read().decode('utf-8', errors='replace')
        stderr_data = stderr.read().decode('utf-8', errors='replace')
        
        return {
            "success": exit_status == 0,
            "exit_status": exit_status,
            "stdout": stdout_data,
            "stderr": stderr_data
        }
    except Exception as e:
        return {
            "success": False,
            "exit_status": -1,
            "stdout": "",
            "stderr": str(e)
        }