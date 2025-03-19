"""Repository layer for the Machine entity."""
from backend.app.models import Machine
from sqlmodel import Session, select

def find_machine_by_id(session: Session, id: int) -> Machine:
    """Select a machine by its ID."""
    statement = select(Machine).where(Machine.id == id)
    return session.exec(statement).first()
