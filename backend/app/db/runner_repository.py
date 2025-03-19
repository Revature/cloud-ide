from app.models import Runner
from sqlmodel import Session, select

def addRunner(session: Session, new_runner: Runner) -> Runner:
    session.add(new_runner)
    session.flush()
    session.refresh(new_runner)
    return new_runner