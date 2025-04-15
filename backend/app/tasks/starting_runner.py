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
from app.business import key_management, health_check
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
            
        # Wait for SSH to be available
        async def wait_for_ssh_available():
            await health_check.wait_for_life(60, public_ip, key, cloud_service)

        asyncio.run(wait_for_ssh_available())
        
        # Update runner state in database
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
    """Run the on_startup script on the runner."""
    try:
        from app.business import script_management
        
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
        
        # Update history in database
        with Session(engine) as session:
            runner = runner_repository.find_runner_by_id(session, runner_id)
            if runner:
                # Create history record
                history = RunnerHistory(
                    runner_id=runner_id,
                    event_name="startup_script_completed",
                    event_data={
                        "timestamp": datetime.utcnow().isoformat(),
                        "script_result": script_result
                    },
                    created_by="system",
                    modified_by="system"
                )
                session.add(history)
                session.commit()
        
        return script_result
    except Exception as e:
        logger.error(f"Error running startup script: {e}")
        raise


# import asyncio
# import logging
# from datetime import datetime
# from app.celery_app import celery_app
# from app.db.database import engine
# from sqlmodel import Session, select
# from app.models.runner import Runner
# from app.models.runner_history import RunnerHistory
# from app.models.image import Image
# from app.models.cloud_connector import CloudConnector
# from app.business import key_management, health_check
# from app.business.cloud_services.cloud_service_factory import get_cloud_service

# logger = logging.getLogger(__name__)

# @celery_app.task(name="app.tasks.starting_runner.update_runner_state")
# def update_runner_state(runner_id: int, instance_id: str):
#     """
#     Update runner state.

#     Wait for the instance to become 'running',
#     update the runner's state to 'ready',
#     set the runner's URL, and record the event in RunnerHistory.
#     """
#     try:
#         # Retrieve the runner and related cloud connector
#         with Session(engine) as session:
#             runner = session.get(Runner, runner_id)
#             if not runner:
#                 # print(f"Runner {runner_id} not found in the database.")
#                 logger.error(f"Runner {runner_id} not found in the database.")
#                 return

#             # Get the image to find the cloud connector
#             image = session.get(Image, runner.image_id)
#             if not image:
#                 # print(f"Image not found for runner {runner_id}.")
#                 logger.error(f"Image not found for runner {runner_id}.")
#                 return

#             # Get the cloud connector
#             cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
#             if not cloud_connector:
#                 # print(f"Cloud connector not found for image {image.id}.")
#                 logger.error(f"Cloud connector not found for image {image.id}.")
#                 return
#             key = key_management.get_runner_key(runner.key_id)

#             # Get the appropriate cloud service
#             cloud_service = get_cloud_service(cloud_connector)

#         # Run the async operations to wait for the instance and get its IP
#         async def wait_and_get_ip():
#             await cloud_service.wait_for_instance_running(instance_id)
#             public_ip = await cloud_service.get_instance_ip(instance_id)
#             await health_check.wait_for_life(60, public_ip, key, cloud_service)
#             return public_ip

#         # Since these are async operations, run them synchronously
#         public_ip = asyncio.run(wait_and_get_ip())

#         # Update the runner in the database
#         with Session(engine) as session:
#             runner = session.get(Runner, runner_id)
#             if runner:
#                 runner.url = public_ip
#                 session.commit()
#                 if runner.state == "runner_starting_claimed":
#                     runner.state = "ready_claimed"
#                 else:
#                     runner.state = "ready"
#                 session.commit()

#                 # Create a new RunnerHistory record
#                 event_data = {
#                     "starting_time": runner.session_start.isoformat() if runner.session_start else "No session_start recorded",
#                     "ready_time": datetime.utcnow().isoformat(),
#                     "instance_id": instance_id,
#                     "public_ip": public_ip
#                 }
#                 new_history = RunnerHistory(
#                     runner_id=runner_id,
#                     event_name="runner_ready",
#                     event_data=event_data,
#                     created_by="system",
#                     modified_by="system"
#                 )
#                 session.add(new_history)
#                 session.commit()

#                 # print(f"Runner {runner_id} updated to 'ready' and history record created.")
#                 logger.info(f"Runner {runner_id} updated to 'ready' and history record created.")

#                 from app.business import script_management
#                 # on_startup script execution
#                 script_result = asyncio.run(script_management.run_script_for_runner(
#                     "on_startup",
#                     runner.id,
#                     env_vars={},
#                     initiated_by="system",
#                 ))
#                 if script_result:
#                     # print(f"Script executed for runner {runner.id}")
#                     logger.info(f"Script executed for runner {runner.id}")
#                     logger.info(f"Script executed for runner {runner.id}")
#                     # print(f"Script result: {script_result}")
#                     logger.info(f"Script result: {script_result}")
#                     logger.info(f"Script result: {script_result}")
#                 else:
#                     # print(f"No script executed for runner {runner.id}")
#                     logger.info(f"No script executed for runner {runner.id}")
#                     logger.info(f"No script executed for runner {runner.id}")

#                 logger.info(f"Runner {runner.id} launched with instance ID {instance_id}")
#             else:
#                 # print(f"Runner {runner_id} not found in the database.")
#                 logger.error(f"Runner {runner_id} not found in the database.")

#     except Exception as e:
#         # print(f"Error in update_runner_state: {e}")
#         logger.error(f"Error in update_runner_state: {e}")
#         raise
