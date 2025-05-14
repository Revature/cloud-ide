# tasks/starting_runner.py
"""Starting runner task to start an instance and update the runner state."""

import logging
import asyncio
from datetime import datetime
from app.celery_app import celery_app
from app.db.database import engine
from sqlmodel import Session
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from app.models.image import Image
from app.models.cloud_connector import CloudConnector
from app.business import key_management, health_check, runner_management
from app.db import runner_repository, image_repository, cloud_connector_repository
from app.business.cloud_services import cloud_service_factory

logger = logging.getLogger(__name__)

@celery_app.task(name="app.tasks.runner_tasks.wait_for_instance_running")
def wait_for_instance_running(runner_id: int, instance_id: str):
    """Wait for an EC2 instance to enter the 'running' state."""
    try:
        # Get necessary data from database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner:
                logger.error(f"Runner {runner_id} not found in the database.")
                return

            image = image_repository.find_image_by_id(session, runner.image_id)
            if not image:
                logger.error(f"Image not found for runner {runner_id}.")
                return

            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, image.cloud_connector_id)
            if not cloud_connector:
                logger.error(f"Cloud connector not found for image {image.id}.")
                return

            # Create cloud service
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            history = RunnerHistory(
                runner_id=runner_id,
                event_name="instance_starting",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "instance_id": instance_id
                },
                created_by="system",
                modified_by="system"
            )
            session.add(history)
            session.commit()

        # Wait for instance to be running
        async def wait_for_running():
            await cloud_service.wait_for_instance_running(instance_id)

        asyncio.run(wait_for_running())

        # Update runner state in database
        with Session(engine) as session:
            # Create history record for tracking
            history = RunnerHistory(
                runner_id=runner_id,
                event_name="instance_running",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "instance_id": instance_id
                },
                created_by="system",
                modified_by="system"
            )
            session.add(history)
            session.commit()

        # Queue next task
        get_instance_ip.delay(runner_id, instance_id)

        return True
    except Exception as e:
        logger.error(f"Error waiting for instance running: {e}")
        raise

@celery_app.task(name="app.tasks.runner_tasks.get_instance_ip")
def get_instance_ip(runner_id: int, instance_id: str):
    """Get the public IP address of an EC2 instance."""
    try:
        # Get necessary data from database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner:
                logger.error(f"Runner {runner_id} not found in the database.")
                return

            image = image_repository.find_image_by_id(session, runner.image_id)
            if not image:
                logger.error(f"Image not found for runner {runner_id}.")
                return

            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, image.cloud_connector_id)
            if not cloud_connector:
                logger.error(f"Cloud connector not found for image {image.id}.")
                return

            # Create cloud service
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            history = RunnerHistory(
                runner_id=runner_id,
                event_name="instance_ip_assigning",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "instance_id": instance_id
                },
                created_by="system",
                modified_by="system"
            )
            session.add(history)
            session.commit()

        # Get instance IP
        async def get_ip():
            public_ip = await cloud_service.get_instance_ip(instance_id)
            return public_ip

        public_ip = asyncio.run(get_ip())

        # Update runner in database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if runner:
                runner.url = public_ip

                # Create history record
                history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="instance_ip_assigned",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "instance_id": instance_id,
                        "public_ip": public_ip
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(history)
                session.commit()

        # Queue next task
        wait_for_ssh.delay(runner_id, instance_id, public_ip)

        return public_ip
    except Exception as e:
        logger.error(f"Error getting instance IP: {e}")

        raise

@celery_app.task(name="app.tasks.runner_tasks.wait_for_ssh")
def wait_for_ssh(runner_id: int, instance_id: str, public_ip: str):
    """Wait for SSH to be available on the instance."""
    try:
        # Get necessary data from database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner:
                logger.error(f"Runner {runner_id} not found in the database.")
                return

            image = image_repository.find_image_by_id(session, runner.image_id)
            if not image:
                logger.error(f"Image not found for runner {runner_id}.")
                return

            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, image.cloud_connector_id)
            if not cloud_connector:
                logger.error(f"Cloud connector not found for image {image.id}.")
                return

            # Get runner key
            key = key_management.get_runner_key(runner.key_id)
            if not key:
                logger.error(f"Key not found for runner {runner_id}.")
                return

            # Create cloud service
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            history = RunnerHistory(
                runner_id=runner_id,
                event_name="ssh_waiting",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "instance_id": instance_id,
                    "public_ip": public_ip
                },
                created_by="system",
                modified_by="system"
            )
            session.add(history)
            session.commit()

        # Wait for SSH to be available
        async def wait_for_ssh_available():
            await health_check.wait_for_life(60, public_ip, key, cloud_service)

        asyncio.run(wait_for_ssh_available())

        # Update runner state in database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if runner:

                # Create history record
                history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="ssh_available",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "instance_id": instance_id,
                        "public_ip": public_ip,
                        "new_state": runner.state
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(history)
                session.commit()

        # Queue next task
        run_startup_script.delay(runner_id)

        return True
    except Exception as e:
        logger.error(f"Error waiting for SSH: {e}")
        raise

@celery_app.task(name="app.tasks.runner_tasks.run_startup_script")
def run_startup_script(runner_id: int):
    """Run the on_startup script on the runner and also node_exporter.sh."""
    try:
        from app.business import script_management

        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if not runner:
                logger.error(f"Runner {runner_id} not found in the database.")
                return

            # Create history record
            history = RunnerHistory(
                runner_id=runner_id,
                event_name="startup_script_starting",
                event_data={
                    "timestamp": datetime.utcnow().isoformat()
                },
                created_by="system",
                modified_by="system"
            )
            session.add(history)
            session.commit()

        # Run startup script
        async def run_script():
            result = await script_management.run_script_for_runner(
                "on_startup",
                runner_id,
                env_vars={},
                initiated_by="system"
            )
            return result

        script_result = asyncio.run(run_script())

        # Run node_exporter.sh script
        async def run_node_exporter():
            node_exporter_result = await script_management.run_custom_script_for_runner(
                runner_id=runner_id,
                script_path="app/db/sample_scripts/node_exporter.sh",
                env_vars={},
                initiated_by="system"
            )
            return node_exporter_result

        node_exporter_result = asyncio.run(run_node_exporter())
        print()
        print("Node Exporter Result:")
        print(node_exporter_result)
        print()

        # Update history in database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if runner:
                if runner.state == "runner_starting_claimed":
                    runner.state = "ready_claimed"
                else:
                    runner.state = "ready"
                # Create history record
                history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="startup_script_completed",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "script_result": script_result,
                        "node_exporter_result": node_exporter_result
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(history)
                session.commit()

        return {
            "startup_script": script_result,
            "node_exporter": node_exporter_result
        }
    except Exception as e:
        # Error handling code remains the same
        logger.error(f"Error running startup script: {e}")

        instance_id = None
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if runner:
                instance_id = runner.identifier  # Store this separately

                # Create history records
                history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="startup_script_failed",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "error": str(e)
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(history)

                history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="runner_shutdown",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "reason": "Startup script failed"
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(history)
                session.commit()

        # Now use the instance_id outside of the session
        if instance_id:
            async def force_shutdown():
                shutdown_result = await runner_management.terminate_runner(
                    runner_id,
                    initiated_by="app_requests_endpoint"
                )
                return shutdown_result

            shutdown_result = asyncio.run(force_shutdown())
            logger.error(f"Error shutting down runner {runner_id}: {shutdown_result}")

        raise
