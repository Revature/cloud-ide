# app/services/ssh_management.py

import paramiko
from io import StringIO
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

async def connect_to_runner(
    ip_address: str, 
    private_key: Optional[str] = None,
    username: str = "ubuntu"
) -> Tuple[paramiko.SSHClient, paramiko.Channel]:
    """Establish SSH connection to a runner and return client and shell channel"""

    # Set up SSH client
    ssh_client = paramiko.SSHClient()
    ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # Load the private key
        if private_key:
            pkey = paramiko.RSAKey.from_private_key(StringIO(private_key))
        else:
            raise ValueError("Either private_key or private_key_path must be provided")

        # Connect to the runner
        ssh_client.connect(
            hostname=ip_address,
            username=username,
            pkey=pkey,
            timeout=10
        )

        # Create an interactive shell channel
        ssh_channel = ssh_client.invoke_shell(
            term="xterm-256color",
            width=80,
            height=24
        )

        return ssh_client, ssh_channel

    except Exception as e:
        # Clean up on error
        if ssh_client:
            ssh_client.close()
        logger.exception(f"SSH connection error: {str(e)}")
        raise