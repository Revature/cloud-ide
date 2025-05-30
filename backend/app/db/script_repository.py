"""Repository layer for the Script entity."""

from sqlmodel import Session, select
from typing import Any, Optional
from app.models.script import Script
from app.db.database import engine

def find_script_by_event_and_image_id(event: str, image_id: int):
    """Get scripts by event and image id."""
    with Session(engine) as session:
        stmt = select(Script).where(Script.event == event, Script.image_id == image_id)
        scripts = session.exec(stmt).first()
        return scripts



def find_script_by_event_and_image_id(event: str, image_id: int) -> Optional[Script]:
    """Get script by event and image id."""
    with Session(engine) as session:
        stmt = select(Script).where(Script.event == event, Script.image_id == image_id)
        script = session.exec(stmt).first()
        return script


def find_all_scripts() -> list[Script]:
    """Get all scripts."""
    with Session(engine) as session:
        stmt = select(Script)
        scripts = session.exec(stmt).all()
        return scripts


def find_script_by_id(script_id: int) -> Optional[Script]:
    """Get a script by ID."""
    with Session(engine) as session:
        script = session.get(Script, script_id)
        return script


def find_scripts_by_image_id(image_id: int) -> list[Script]:
    """Get all scripts for a specific image ID."""
    with Session(engine) as session:
        stmt = select(Script).where(Script.image_id == image_id)
        scripts = session.exec(stmt).all()
        return scripts


def create_script(script: Script) -> Script:
    """Create a new script."""
    with Session(engine) as session:
        session.add(script)
        session.commit()
        session.refresh(script)
        return script


def update_script(script_id: int, update_data: dict[str, Any]) -> Script:
    """
    Update a script.

    Args:
        session: Database session
        script_id: ID of the script to update
        update_data: Dictionary of fields to update

    Returns:
        Updated Script object
    """
    with Session(engine) as session:
    # Get the script to update
        script = session.get(Script, script_id)
        if not script:
            raise ValueError(f"Script with ID {script_id} not found")

        # Update the script attributes
        for key, value in update_data.items():
            if hasattr(script, key):
                setattr(script, key, value)

        # Save changes
        session.add(script)
        session.commit()
        session.refresh(script)

        return script


def delete_script(script_id: int) -> bool:
    """
    Delete a script.

    Args:
        session: Database session
        script_id: ID of the script to delete

    Returns:
        True if successful, False otherwise
    """
    with Session(engine) as session:
        script = session.get(Script, script_id)
        if not script:
            return False

        session.delete(script)
        session.commit()
        return True


def delete_scripts_by_image_id(image_id: int) -> int:
    """
    Delete all scripts for a specific image.

    Args:
        session: Database session
        image_id: ID of the image

    Returns:
        Number of scripts deleted
    """
    with Session(engine) as session:
        # First, get all scripts for this image to count them
        stmt = select(Script).where(Script.image_id == image_id)
        scripts = session.exec(stmt).all()
        count = len(scripts)

        # Delete all scripts for this image
        for script in scripts:
            session.delete(script)

        session.commit()
        return count
