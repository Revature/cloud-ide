# app/business/resource_setup.py
"""Module for setting up default resources in the database."""

from dataclasses import dataclass
from sqlmodel import Session, select
from app.business.runner_management import launch_runners
from app.business import endpoint_permission_management
from app.db.database import engine, get_session
from app.db.image_repository import find_images_with_pool
from app.models import User, Machine, Image, Script
from datetime import datetime
from app.models import CloudConnector
import os
from pathlib import Path

@dataclass
class Resources:
    """Dataclass for storing default resources."""

    system_user_email: str
    machine_id: int
    image_identifier: str
    runner_pool_size: int

def load_script_from_file(script_file):
    """
    Load script content from a file.

    Args:
        script_file: Relative path to the script file from the scripts directory

    Returns:
        String content of the script file
    """
    # Determine the paths relative to the current file (which is in business/resource_setup.py)
    current_dir = Path(__file__).parent  # business/
    parent_dir = current_dir.parent      # app/

    # First try db/sample_scripts directory
    scripts_dir = parent_dir / "db" / "sample_scripts"
    script_path = scripts_dir / script_file

    try:
        with open(script_path) as f:
            return f.read()
    except FileNotFoundError:
        # Fallback to business/scripts
        business_scripts_dir = current_dir / "scripts"
        script_path = business_scripts_dir / script_file
        try:
            with open(script_path) as f:
                return f.read()
        except FileNotFoundError:
            # Final fallback to app/scripts
            app_scripts_dir = parent_dir / "scripts"
            script_path = app_scripts_dir / script_file
            with open(script_path) as f:
                return f.read()

def setup_resources():
    """
    Fetch or create default User, Machine, Image, and Script.

    Returns a Resources dataclass with the necessary values.
    """
    with Session(engine) as session:
        # 1) Fetch or create a default user.
        stmt_user = select(User).where(User.email == "ashoka.shringla@revature.com")
        system_user = session.exec(stmt_user).first()
        if not system_user:
            system_user = User(
                first_name="Ashoka",
                last_name="Shringla",
                email="ashoka.shringla@revature.com",
                created_by="system",
                modified_by="system"
            )
            session.add(system_user)
            session.commit()
            session.refresh(system_user)

        # 2) Fetch or create default cloud connector.
        stmt_connector = select(CloudConnector).where(CloudConnector.provider == "aws")
        cloud_connector = session.exec(stmt_connector).first()
        if not cloud_connector:
            # Get AWS credentials and region from environment variables
            aws_access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
            aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
            aws_region = os.getenv("AWS_REGION", "us-west-2")

            cloud_connector = CloudConnector(
                provider="aws",
                region=aws_region,
                created_by="system",
                modified_by="system"
            )
            # Set the access_key and secret_key using the hybrid properties
            # which will handle the encryption
            cloud_connector.set_decrypted_access_key(aws_access_key)
            cloud_connector.set_decrypted_secret_key(aws_secret_key)

            session.add(cloud_connector)
            session.commit()
            session.refresh(cloud_connector)

        # 3) Fetch or create default Machine.
        stmt_machine = select(Machine).where(Machine.identifier == "t2.medium")
        db_machine = session.exec(stmt_machine).first()
        if not db_machine:
            db_machine = Machine(
                name="t2.medium",
                identifier="t2.medium",
                cpu_count=2,
                memory_size=4096,
                storage_size=20,
                cloud_connector_id=cloud_connector.id,  # Add cloud connector reference
                created_by="system",
                modified_by="system"
            )
            session.add(db_machine)
            session.commit()
            session.refresh(db_machine)

        # Add t4g.medium ARM-based machine
        stmt_t4g_machine = select(Machine).where(Machine.identifier == "t4g.medium")
        t4g_machine = session.exec(stmt_t4g_machine).first()
        if not t4g_machine:
            t4g_machine = Machine(
                name="t4g.medium",
                identifier="t4g.medium",
                cpu_count=2,
                memory_size=4096,  # 4GB RAM
                storage_size=20,    # 20GB storage
                cloud_connector_id=cloud_connector.id,
                created_by="system",
                modified_by="system"
            )
            session.add(t4g_machine)
            session.commit()
            session.refresh(t4g_machine)

        # 4) Fetch or create default Image.
        stmt_image = select(Image).where(Image.identifier == "ami-0bbfffa970b0280da")
        db_image = session.exec(stmt_image).first()
        if not db_image:
            db_image = Image(
                name="sample-id-image",
                description="An AMI for testing",
                identifier="ami-0bbfffa970b0280da",
                runner_pool_size=1,  # Example pool size
                machine_id=db_machine.id,
                cloud_connector_id=cloud_connector.id,  # Add cloud connector reference
                created_by="system",
                modified_by="system"
            )
            session.add(db_image)
            session.commit()
            session.refresh(db_image)

        # Add new ARM-based image
        stmt_arm_image = select(Image).where(Image.identifier == "ami-03f10f2e6ff098115")
        arm_image = session.exec(stmt_arm_image).first()
        if not arm_image:
            arm_image = Image(
                name="RevPro-Java-Lab-1",
                description="ARM64 with revpro labs extension v0-0-1",
                identifier="ami-03f10f2e6ff098115",
                runner_pool_size=1,  # Start with same pool size
                machine_id=t4g_machine.id,  # Link to t4g.medium machine
                cloud_connector_id=cloud_connector.id,
                created_by="system",
                modified_by="system"
            )
            session.add(arm_image)
            session.commit()
            session.refresh(arm_image)

        # 5) Fetch or create default Script for the "on_awaiting_client" event.
        stmt_script = select(Script).where(Script.event == "on_awaiting_client", Script.image_id == db_image.id)
        awaiting_client_script = session.exec(stmt_script).first()

        # Load script content from external file
        try:
            on_awaiting_client_content = load_script_from_file("on_awaiting_client.sh")
            on_terminate_content = load_script_from_file("on_terminate.sh")
        except (FileNotFoundError, PermissionError) as e:
            print(f"Warning: Could not load script files: {e}")
            print("Creating scripts with embedded content")

            # Fallback to embedded script content
            on_awaiting_client_content = """#!/bin/bash"""
            on_terminate_content = """#!/bin/bash"""

        # Create or update the scripts
        if not awaiting_client_script:
            awaiting_client_script = Script(
                name="Git Clone Script",
                description="Clones a repository specified in runner env_data under 'repo_url'",
                event="on_awaiting_client",
                image_id=db_image.id,
                script=on_awaiting_client_content,
                created_by="system",
                modified_by="system"
            )
            session.add(awaiting_client_script)
            session.commit()
            session.refresh(awaiting_client_script)
        else:
            # Update existing script with new content
            awaiting_client_script.script = on_awaiting_client_content
            awaiting_client_script.modified_by = "system"
            session.add(awaiting_client_script)
            session.commit()

        # Add the same script for ARM image if it doesn't exist
        if arm_image:
            stmt_arm_script = select(Script).where(Script.event == "on_awaiting_client", Script.image_id == arm_image.id)
            arm_awaiting_client_script = session.exec(stmt_arm_script).first()
            if not arm_awaiting_client_script:
                # Clone the script for the ARM image, using the same script content
                arm_awaiting_client_script = Script(
                    name="Git Clone Script (ARM)",
                    description="Clones a repository specified in runner env_data under 'repo_url' for ARM instances",
                    event="on_awaiting_client",
                    image_id=arm_image.id,
                    script=on_awaiting_client_content,  # Use the loaded script content
                    created_by="system",
                    modified_by="system"
                )
                session.add(arm_awaiting_client_script)
                session.commit()
                session.refresh(arm_awaiting_client_script)
            else:
                # Update existing script with new content
                arm_awaiting_client_script.script = on_awaiting_client_content
                arm_awaiting_client_script.modified_by = "system"
                session.add(arm_awaiting_client_script)
                session.commit()

        # Fetch or create default Script for the "on_terminate" event
        stmt_script = select(Script).where(Script.event == "on_terminate", Script.image_id == db_image.id)
        termination_script = session.exec(stmt_script).first()
        if not termination_script:
            termination_script = Script(
                name="GitHub Save Script",
                description="Commits and pushes changes to GitHub on termination",
                event="on_terminate",
                image_id=db_image.id,
                script=on_terminate_content,
                created_by="system",
                modified_by="system"
            )
            session.add(termination_script)
            session.commit()
            session.refresh(termination_script)
        else:
            # Update existing script with new content
            termination_script.script = on_terminate_content
            termination_script.modified_by = "system"
            session.add(termination_script)
            session.commit()

        # Add the same termination script for ARM image if it doesn't exist
        if arm_image:
            stmt_arm_script = select(Script).where(Script.event == "on_terminate", Script.image_id == arm_image.id)
            arm_termination_script = session.exec(stmt_arm_script).first()
            if not arm_termination_script:
                # Clone the script for the ARM image, using the same script content
                arm_termination_script = Script(
                    name="GitHub Save Script (ARM)",
                    description="Commits and pushes changes to GitHub on termination for ARM instances",
                    event="on_terminate",
                    image_id=arm_image.id,
                    script=on_terminate_content,  # Use the loaded script content
                    created_by="system",
                    modified_by="system"
                )
                session.add(arm_termination_script)
                session.commit()
                session.refresh(arm_termination_script)
            else:
                # Update existing script with new content
                arm_termination_script.script = on_terminate_content
                arm_termination_script.modified_by = "system"
                session.add(arm_termination_script)
                session.commit()

        return Resources(
            system_user_email=system_user.email,
            machine_id=db_machine.id,
            image_identifier=db_image.identifier,
            runner_pool_size=db_image.runner_pool_size
        )

async def fill_runner_pools():
    """Fill the runner pools during startup."""
    from app.tasks.runner_pool_management import manage_runner_pool
    # Queue the task to run immediately (using .delay() for async execution)
    manage_runner_pool.delay()

def setup_endpoint_permissions():
    """
    Set up default endpoint permissions.

    This function is a placeholder and should be implemented to set up
    the necessary endpoint permissions in the database.
    """
    with Session(engine) as session:
        # Initialize default permissions
        endpoint_permission_management.initialize_default_permissions(session)
