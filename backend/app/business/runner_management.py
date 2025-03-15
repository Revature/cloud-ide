# business/runner_management.py
"""Module for managing runners (EC2 instances) for running scripts."""

import uuid
import asyncio
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db.database import engine
from app.models import Machine, Image, Runner, CloudConnector
from app.business.cloud_services.factory import get_cloud_service
from app.tasks.starting_runner import update_runner_state
from app.business.key_management import get_daily_key

async def launch_runners(image_identifier: str, runner_count: int):
    """
    Launch instances concurrently and create Runner records.

    Each new runner is associated with today's key.
    Returns a list of launched instance IDs.
    """
    launched_instance_ids = []

    # Open one DB session for reading resources.
    with Session(engine) as session:
        # 1) Fetch the Image.
        stmt_image = select(Image).where(Image.identifier == image_identifier)
        db_image = session.exec(stmt_image).first()
        if not db_image:
            raise Exception("Image not found")

        # 2) Fetch the Machine associated with the image.
        if db_image.machine_id is None:
            raise Exception("No machine associated with the image")
        stmt_machine = select(Machine).where(Machine.id == db_image.machine_id)
        db_machine = session.exec(stmt_machine).first()
        if not db_machine:
            raise Exception("Machine not found")

        # 3) Get the cloud connector
        cloud_connector = session.get(CloudConnector, db_image.cloud_connector_id)
        if not cloud_connector:
            raise Exception("Cloud connector not found")

        # 4) Get the appropriate cloud service
        cloud_service = get_cloud_service(cloud_connector)

    # 5) Get or create today's key.
    key_record = await get_daily_key(cloud_connector_id=cloud_connector.id)  # Updated to provide cloud_connector_id
    if key_record is None:
        raise Exception("Key not found or created")

    # 6) Launch all instances concurrently using the appropriate cloud service.
    launch_tasks = [
        cloud_service.create_instance(
            key_name=key_record.key_name,
            image_id=db_image.identifier,
            instance_type=db_machine.identifier,
            instance_count=1
        )
        for _ in range(runner_count)
    ]
    instance_ids = await asyncio.gather(*launch_tasks)
    launched_instance_ids.extend(instance_ids)

    # 7) Create Runner records (URL will be updated later by a background job).
    for instance_id in instance_ids:
        with Session(engine) as session:
            new_runner = Runner(
                machine_id=db_machine.id,
                image_id=db_image.id,
                user_id=None,           # No user assigned yet.
                key_id=key_record.id,     # Associate the runner with today's key.
                state="runner_starting",  # State will update once instance is running.
                url="",                 # Empty URL; background task will update it.
                token="",
                identifier=instance_id,
                external_hash=uuid.uuid4().hex,
                session_start=datetime.utcnow(),
                session_end=datetime.utcnow() + timedelta(minutes=10),
                created_by="system",
                modified_by="system"
            )
            session.add(new_runner)
            session.commit()
            session.refresh(new_runner)

            # Queue a Celery task to update runner state when instance is ready.
            update_runner_state.delay(new_runner.id, instance_id)

    return launched_instance_ids

async def shutdown_runners(launched_instance_ids: list):
    """
    Stop and then terminate all instances given in launched_instance_ids.

    Executes on_terminate scripts, then updates the corresponding Runner record
    to "closed" after stopping and to "terminated" after termination.
    Creates detailed history records for each step.
    """
    from app.business.script_management import run_script_for_runner  # Import here to avoid circular imports
    from app.models.runner_history import RunnerHistory

    results = []
    for instance_id in launched_instance_ids:
        result = {"instance_id": instance_id, "status": "success", "details": []}

        # Find the runner first
        with Session(engine) as session:
            stmt = select(Runner).where(Runner.identifier == instance_id)
            runner = session.exec(stmt).first()

            if not runner:
                message = f"Runner with instance identifier {instance_id} not found."
                print(message)
                result["status"] = "error"
                result["details"].append({"step": "find_runner", "status": "error", "message": message})
                results.append(result)
                continue

            # Get the cloud connector and service
            image = session.get(Image, runner.image_id)
            if not image:
                message = f"Image for runner {runner.id} not found."
                print(message)
                result["status"] = "error"
                result["details"].append({"step": "find_image", "status": "error", "message": message})
                results.append(result)
                continue

            cloud_connector = session.get(CloudConnector, image.cloud_connector_id)
            if not cloud_connector:
                message = f"Cloud connector for image {image.id} not found."
                print(message)
                result["status"] = "error"
                result["details"].append({"step": "find_cloud_connector", "status": "error", "message": message})
                results.append(result)
                continue

            # Get the cloud service
            cloud_service = get_cloud_service(cloud_connector)

            # Update runner state to "terminating" before running scripts
            old_state = runner.state
            runner.state = "terminating"
            session.add(runner)

            # Create history record for state change
            terminating_history = RunnerHistory(
                runner_id=runner.id,
                event_name="runner_terminating",
                event_data={
                    "timestamp": datetime.utcnow().isoformat(),
                    "old_state": old_state,
                    "new_state": "terminating"
                },
                created_by="system",
                modified_by="system"
            )
            session.add(terminating_history)
            session.commit()

            result["runner_id"] = runner.id
            result["details"].append({"step": "update_state", "status": "success", "message": "Updated state to terminating"})

            # Execute the on_terminate script if the runner is in a state that requires cleanup
            if old_state not in ["ready", "runner_starting", "app_starting", "terminated", "closed"]:
                try:
                    print(f"Running on_terminate script for runner {runner.id}...")
                    # Run the script with empty env_vars since credentials should be retrieved from the environment
                    script_result = await run_script_for_runner("on_terminate", runner.id, env_vars={})

                    # Create history record for script execution
                    script_history = RunnerHistory(
                        runner_id=runner.id,
                        event_name="script_on_terminate",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "script_result": script_result
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(script_history)
                    session.commit()

                    print(f"Script executed for runner {runner.id}: {script_result}")
                    result["details"].append({"step": "script_execution", "status": "success", "message": "on_terminate script executed"})
                except Exception as e:
                    error_message = f"Error executing on_terminate script for runner {runner.id}: {e!s}"
                    print(error_message)

                    # Create history record for script error
                    error_history = RunnerHistory(
                        runner_id=runner.id,
                        event_name="script_error_on_terminate",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "error": str(e)
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(error_history)
                    session.commit()

                    result["details"].append({"step": "script_execution", "status": "error", "message": error_message})

        # 1) Stop the instance
        try:
            stop_state = await cloud_service.stop_instance(instance_id)

            # After stopping, update the runner state to "closed".
            with Session(engine) as session:
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()
                if runner:
                    runner.state = "closed"
                    runner.ended_on = datetime.utcnow()
                    session.add(runner)

                    # Create history record for stopping the instance
                    stopping_history = RunnerHistory(
                        runner_id=runner.id,
                        event_name="runner_closed",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "old_state": "terminating",
                            "new_state": "closed",
                            "stop_result": stop_state
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(stopping_history)
                    session.commit()

                    print(f"Runner {runner.id} updated to 'closed'.")
                    result["details"].append({"step": "stop_instance", "status": "success", "message": "Instance stopped"})
                else:
                    message = f"Runner with instance identifier {instance_id} not found (stop update)."
                    print(message)
                    result["details"].append({"step": "stop_instance", "status": "error", "message": message})
        except Exception as e:
            error_message = f"Error stopping instance {instance_id}: {e!s}"
            print(error_message)
            result["details"].append({"step": "stop_instance", "status": "error", "message": error_message})

        # 2) Terminate the instance
        try:
            terminate_state = await cloud_service.terminate_instance(instance_id)

            # After termination, update the runner state to "terminated".
            with Session(engine) as session:
                stmt = select(Runner).where(Runner.identifier == instance_id)
                runner = session.exec(stmt).first()
                if runner:
                    runner.state = "terminated"
                    session.add(runner)

                    # Create history record for terminating the instance
                    termination_history = RunnerHistory(
                        runner_id=runner.id,
                        event_name="runner_terminated",
                        event_data={
                            "timestamp": datetime.utcnow().isoformat(),
                            "old_state": "closed",
                            "new_state": "terminated",
                            "terminate_result": terminate_state
                        },
                        created_by="system",
                        modified_by="system"
                    )
                    session.add(termination_history)
                    session.commit()

                    print(f"Runner {runner.id} updated to 'terminated'.")
                    result["details"].append({"step": "terminate_instance", "status": "success", "message": "Instance terminated"})
                else:
                    message = f"Runner with instance identifier {instance_id} not found (terminate update)."
                    print(message)
                    result["details"].append({"step": "terminate_instance", "status": "error", "message": message})
        except Exception as e:
            error_message = f"Error terminating instance {instance_id}: {e!s}"
            print(error_message)
            result["details"].append({"step": "terminate_instance", "status": "error", "message": error_message})

        results.append(result)

    return results

# Add a new function specifically for terminating a single runner by ID
async def terminate_runner(runner_id: int) -> dict:
    """
    Terminate a specific runner by ID.

    Returns a dictionary with the result of the termination process.
    """
    with Session(engine) as session:
        runner = session.get(Runner, runner_id)
        if not runner:
            return {
                "status": "error",
                "message": f"Runner with ID {runner_id} not found"
            }

        if runner.state in ("terminated", "closed"):
            return {
                "status": "error",
                "message": f"Runner with ID {runner_id} is already terminated or closed"
            }

        # Get the instance ID for shutdown_runners
        instance_id = runner.identifier

    # Use the shutdown_runners function to handle the termination
    results = await shutdown_runners([instance_id])

    # Return the result for this specific runner
    if results and results[0]["status"] == "success":
        return {"status": "success", "message": "Runner terminated successfully", "details": results[0]}
    else:
        return {"status": "error", "message": "Failed to terminate runner", "details": results[0] if results else None}

async def shutdown_all_runners():
    """
    Stop and then terminate all instances for runners that are not in the 'terminated' state.

    Uses the shutdown_runners function.
    """
    with Session(engine) as session:
        stmt = select(Runner).where(Runner.state != "terminated")
        runners_to_shutdown = session.exec(stmt).all()
        instance_ids = [runner.identifier for runner in runners_to_shutdown]
    await shutdown_runners(instance_ids)
