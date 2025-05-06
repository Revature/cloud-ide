"""Repository layer for the RunnerHistory entity."""
from app.models import RunnerHistory, Runner
from sqlmodel import Session, select

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

def delete_runner_histories_by_runner_id(session: Session, runner_id: int) -> None:
    """
    Delete all history records for a specific runner.

    Args:
        session: The database session
        runner_id: The ID of the runner
    """
    histories = session.exec(select(RunnerHistory).where(RunnerHistory.runner_id == runner_id)).all()
    for history in histories:
        session.delete(history)
