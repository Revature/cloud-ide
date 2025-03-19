"""Repository layer for the Runner entity."""
from app.models import Runner
from sqlmodel import Session

def add_runner(session: Session, new_runner: Runner) -> Runner:
    """Add a new runner, flush to retrieve ID."""
    session.add(new_runner)
    session.flush()
    session.refresh(new_runner)
    return new_runner
