"""Script for the health-checking runner."""
from datetime import timezone, datetime
from celery.utils.log import get_task_logger
import time
from app.business.cloud_services.base import CloudService
from app.exceptions.runner_exceptions import RunnerExecException
logger = get_task_logger(__name__)
async def check_life(
    ip : int,
    key: str,
    cloud_service: CloudService
    )->bool:
    """Submit a script to run on the runner with SSH."""
    script:str = """#!/bin/bash
if curl --silent --fail --max-time 5 localhost:3000 > /dev/null 2>&1; then
    echo "OK"
else
    echo "WAIT"
fi"""
    try:
        result : str = await cloud_service.ssh_run_script(ip=ip, key=key, script=script)
        if "OK" in result["stdout"]:
            return True
        else:
            return False
    except Exception as e:
        return False

async def wait_for_life(
    attempts:int,
    ip : int,
    key: str,
    cloud_service: CloudService
    ):
    """Continuously invoke check_life until the SSH client is up."""
    wait_start_time = datetime.now(timezone.utc)
    for _ in range(attempts):
        if await check_life(ip=ip, key=key, cloud_service=cloud_service):
            logger.info(f"SSH client active in {datetime.now(timezone.utc)-wait_start_time}")
            return True
        time.sleep(1)
    raise RunnerExecException("The Runner's SSH client or Port 3000 App never started.")
