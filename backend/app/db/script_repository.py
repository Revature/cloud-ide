"""Repository layer for the Script entity."""

from sqlmodel import Session, select
from app.models.script import Script

def find_script_by_event_and_image_id(session: Session, event: str, image_id: int):
    """Get scripts by event and image id."""
    stmt = select(Script).where(Script.event == event, Script.image_id == image_id)
    scripts = session.exec(stmt).first()
    return scripts
