"""Repository layer for the Script entity."""

from sqlmodel import Session, select, update
from typing import Any, Optional
from app.models.script import Script

def find_script_by_event_and_image_id(session: Session, event: str, image_id: int):
    """Get scripts by event and image id."""
    stmt = select(Script).where(Script.event == event, Script.image_id == image_id)
    scripts = session.exec(stmt).first()
    return scripts



def find_script_by_event_and_image_id(session: Session, event: str, image_id: int) -> Optional[Script]:
    """Get script by event and image id."""
    stmt = select(Script).where(Script.event == event, Script.image_id == image_id)
    script = session.exec(stmt).first()
    return script


def find_all_scripts(session: Session) -> list[Script]:
    """Get all scripts."""
    stmt = select(Script)
    scripts = session.exec(stmt).all()
    return scripts


def find_script_by_id(session: Session, script_id: int) -> Optional[Script]:
    """Get a script by ID."""
    script = session.get(Script, script_id)
    return script


def find_scripts_by_image_id(session: Session, image_id: int) -> list[Script]:
    """Get all scripts for a specific image ID."""
    stmt = select(Script).where(Script.image_id == image_id)
    scripts = session.exec(stmt).all()
    return scripts


def create_script(session: Session, script: Script) -> Script:
    """Create a new script."""
    session.add(script)
    session.commit()
    session.refresh(script)
    return script


def update_script(session: Session, script_id: int, update_data: dict[str, Any]) -> Script:
    """
    Update a script.

    Args:
        session: Database session
        script_id: ID of the script to update
        update_data: Dictionary of fields to update

    Returns:
        Updated Script object
    """
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


def delete_script(session: Session, script_id: int) -> bool:
    """
    Delete a script.

    Args:
        session: Database session
        script_id: ID of the script to delete

    Returns:
        True if successful, False otherwise
    """
    script = session.get(Script, script_id)
    if not script:
        return False

    session.delete(script)
    session.commit()
    return True


def delete_scripts_by_image_id(session: Session, image_id: int) -> int:
    """
    Delete all scripts for a specific image.

    Args:
        session: Database session
        image_id: ID of the image

    Returns:
        Number of scripts deleted
    """
    # First, get all scripts for this image to count them
    stmt = select(Script).where(Script.image_id == image_id)
    scripts = session.exec(stmt).all()
    count = len(scripts)

    # Delete all scripts for this image
    for script in scripts:
        session.delete(script)

    session.commit()
    return count
