"""Repository layer for the Machine entity."""
from app.models import Machine
from sqlmodel import Session, select
from app.db.database import engine

def find_all_machines() -> list[Machine]:
    """Select all machines."""
    with Session(engine) as session:
        statement = select(Machine)
        return session.exec(statement).all()

def find_machine_by_id(id: int) -> Machine:
    """Select a machine by its ID."""
    with Session(engine) as session:
        statement = select(Machine).where(Machine.id == id)
        return session.exec(statement).first()
