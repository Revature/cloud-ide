"""Repository layer for the RunnerHistory entity."""
from app.models import RunnerHistory, Runner
from sqlmodel import Session

def add_runner_history(session: Session, runner: Runner, event_name: str, event_data: dict) -> RunnerHistory:
    """Add a new runner history record, flush to retrieve ID."""
    record = RunnerHistory(
            runner_id=runner.id,
            event_name="runner_created",
            event_data=event_data,
            created_by="system",
            modified_by="system"
        )
    session.add(record)
    session.flush()
    session.refresh(record)
    return record

