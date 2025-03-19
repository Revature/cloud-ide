"""Simple module to grab the workos session rather than repeating the same snippet."""

import os
from workos import WorkOSClient

workos = WorkOSClient(
    api_key=os.getenv("WORKOS_API_KEY"),
    client_id=os.getenv("WORKOS_CLIENT_ID"))

def get_workos_client():
    """Get the workos client."""
    return workos
