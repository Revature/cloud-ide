from backend.app.models import Machine
from sqlmodel import Session, select

def find_machine_by_id(session: Session, id: int) -> Machine:
    statement = select(Machine).where(Machine.id == id)
    return session.exec(statement).first()