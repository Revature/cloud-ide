"""Repository layer for the RunnerHistory entity."""
from app.models import RunnerHistory
from sqlmodel import Session

def add_runner_history(session: Session, record: RunnerHistory) -> RunnerHistory:
    """Add a new runner history record, flush to retrieve ID."""
    session.add(record)
    session.flush()
    session.refresh(record)
    return record
