"""Repository layer for the Runner entity."""
from app.models import Runner
from sqlmodel import Session, select
from typing import Optional

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

def find_runners_by_status(session: Session, status: str) -> list[Runner]:
    """Find runners with a specific status."""
    query = select(Runner).where(Runner.state == status)
    return session.exec(query).all()

def find_alive_runners(session: Session) -> list[Runner]:
    """Find runners in 'alive' states."""
    alive_states = [
        "runner_starting", "app_starting", "ready",
        "runner_starting_claimed", "ready_claimed", "setup",
        "awaiting_client", "active", "disconnecting", "disconnected"
    ]
    query = select(Runner).where(Runner.state.in_(alive_states))
    return session.exec(query).all()

def find_runner_by_id(session: Session, id: int) -> Runner:
    """Retrieve the runner by its ID."""
    statement = select(Runner).where(Runner.id == id)
    return session.exec(statement).first()

def find_runner_by_instance_id(session: Session, instance_id: str) -> Runner:
    """Retrieve the runner by its instance ID."""
    statement = select(Runner).where(Runner.identifier == instance_id)
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
        Runner.state.in_(states),
        Runner.image_id == image_id
    )
    return session.exec(stmt_runner).first()

def update_runner(session: Session, runner: Runner) -> Runner:
    """Update a runner."""
    session.add(runner)
    session.commit()
    session.refresh(runner)
    return runner

def update_whole_runner(session: Session, runner_id: int, runner_data: Runner) -> Runner:
    """Update an image by its id."""
    db_runner = find_runner_by_id(session, runner_id)
    if not db_runner:
        return None

    for key, value in runner_data.dict(exclude_unset=True).items():
        if hasattr(db_runner, key) and key != "id":
            setattr(db_runner, key, value)

    session.add(db_runner)
    return db_runner

def find_runner_with_lifecycle_token(session: Session, token: str) -> Optional[Runner]:
    """
    Find a runner with the given lifecycle token.

    Args:
        session: Database session
        token: The lifecycle token to look for

    Returns:
        Runner object if found, None otherwise
    """
    stmt = select(Runner).where(Runner.lifecycle_token == token)
    return session.exec(stmt).first()

def find_runner_with_id_and_terminal_token(session: Session, runner_id:int, token: str) -> Runner:
    """Select a runner with a matching terminal token."""
    stmt_runner = select(Runner).where(
        Runner.id == runner_id,
        Runner.terminal_token == token
    )
    return session.exec(stmt_runner).first()

def find_runner_with_terminal_token(session: Session, token: str) -> Runner:
    """Select a runner with a matching terminal token."""
    stmt_runner = select(Runner).where(
        Runner.terminal_token == token
    )
    return session.exec(stmt_runner).first()

# Add to runner_repository.py
def find_runners_by_image_id(session: Session, image_id: int) -> list[Runner]:
    """
    Find all runners associated with a specific image.

    Args:
        session: The database session
        image_id: The ID of the image

    Returns:
        A list of Runner objects
    """
    return session.exec(select(Runner).where(Runner.image_id == image_id)).all()

def delete_runner(session: Session, runner_id: int) -> None:
    """
    Delete a specific runner by ID.

    Args:
        session: The database session
        runner_id: The ID of the runner to delete
    """
    runner = session.get(Runner, runner_id)
    if runner:
        session.delete(runner)
