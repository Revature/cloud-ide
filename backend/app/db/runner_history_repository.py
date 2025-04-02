"""Repository layer for the RunnerHistory entity."""
from app.models import RunnerHistory, Runner
from sqlmodel import Session

def add_runner_history(session: Session, runner: Runner, event_name:str, event_data:dict, created_by="default") -> RunnerHistory:
    """Add a new runner history record, flush to retrieve ID."""
    record = RunnerHistory(
            runner_id=runner.id,
            event_name=event_name,
            event_data=event_data,
            created_by=created_by,
            modified_by=created_by
        )
    session.add(record)
    session.flush()
    session.refresh(record)
    return record

