"""Repository layer for the Machine entity."""
from app.models import Machine
from sqlmodel import Session, select

def find_all_machines(session: Session) -> list[Machine]:
    """Select all machines."""
    statement = select(Machine)
    return session.exec(statement).all()

def find_machine_by_id(session: Session, id: int) -> Machine:
    """Select a machine by its ID."""
    statement = select(Machine).where(Machine.id == id)
    return session.exec(statement).first()
