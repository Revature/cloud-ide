"""Repository layer for the Runner entity."""
from app.models import Runner
from sqlmodel import Session, select

def add_runner(session: Session, new_runner: Runner) -> Runner:
    """Add a new runner, flush to retrieve ID."""
    session.add(new_runner)
    session.flush()
    session.refresh(new_runner)
    return new_runner

def find_all_runners(session: Session) -> list[Runner]:
    """Retrieve all runners."""
    statement = select(Runner)
    return session.exec(statement).all()

def find_runner_by_id(session: Session, id: int) -> Runner:
    """Retrieve the runner by its ID."""
    statement = select(Runner).where(Runner.id == id)
    return session.exec(statement).first()

def find_runner_by_user_id_and_image_id_and_states(session: Session, user_id: int, image_id: int, states: list[str]):
    """Retrieve the runner by its user id, image id, and state. Query used to find the user's already existing runner."""
    stmt_runner = select(Runner).where(
        Runner.user_id == user_id,
        Runner.state.in_(states),  # Changed to include awaiting_client too
        Runner.image_id == image_id
    )
    return session.exec(stmt_runner).first()

def find_runner_by_image_id_and_states(session: Session, image_id: int, states: list[str]):
    """
    Retrieve the runner by its image id and state.

    Query used to pull a runner out of the pool.
    TODO: We should be getting the oldest runner out of this query. That would allow it to accrue
    more bursting credits.
    """
    stmt_runner = select(Runner).where(
        Runner.state.in_(states),  # Changed to include awaiting_client too
        Runner.image_id == image_id
    )
    return session.exec(stmt_runner).first()
