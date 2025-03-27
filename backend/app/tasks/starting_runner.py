# tasks/starting_runner.py
"""Starting runner task to start an instance and update the runner state."""

import asyncio
from datetime import datetime
from app.celery_app import celery_app
from app.db.database import engine
from sqlmodel import Session, select
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.models.image import Image
from app.models.cloud_connector import CloudConnector
from app.business.cloud_services.cloud_service_factory import get_cloud_service

@celery_app.task(name="app.tasks.starting_runner.update_runner_state")
def update_runner_state(runner_id: int, instance_id: str):
    """
    Update runner state.

    Wait for the instance to become 'running',
    update the runner's state to 'ready',
    set the runner's URL, and record the event in RunnerHistory.
    """
    try:
        # Retrieve the runner and related cloud connector
        with Session(engine) as session:
            runner = session.get(Runner, runner_id)
            if not runner:
                print(f"Runner {runner_id} not found in the database.")
                return

            # Get the image to find the cloud connector
            image = session.get(Image, runner.image_id)
            if not image:
                print(f"Image not found for runner {runner_id}.")
                return

            # Get the cloud connector
            cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
            if not cloud_connector:
                print(f"Cloud connector not found for image {image.id}.")
                return

            # Get the appropriate cloud service
            cloud_service = get_cloud_service(cloud_connector)

        # Run the async operations to wait for the instance and get its IP
        async def wait_and_get_ip():
            await cloud_service.wait_for_instance_running(instance_id)
            public_ip = await cloud_service.get_instance_ip(instance_id)
            return public_ip

        # Since these are async operations, run them synchronously
        public_ip = asyncio.run(wait_and_get_ip())

        # Update the runner in the database
        with Session(engine) as session:
            runner = session.get(Runner, runner_id)
            if runner:
                runner.state = "ready"
                runner.url = public_ip
                session.add(runner)
                session.commit()

                # Create a new RunnerHistory record
                event_data = {
                    "starting_time": runner.session_start.isoformat() if runner.session_start else "No session_start recorded",
                    "ready_time": datetime.utcnow().isoformat(),
                    "instance_id": instance_id,
                    "public_ip": public_ip
                }
                new_history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="runner_ready",
                    event_data=event_data,
                    created_by="system",
                    modified_by="system"
                )
                session.add(new_history)
                session.commit()

                print(f"Runner {runner_id} updated to 'ready' and history record created.")
            else:
                print(f"Runner {runner_id} not found in the database.")
    except Exception as e:
        print(f"Error in update_runner_state: {e}")
        raise
