"""Repository layer for the Runner entity."""
from app.models import Runner, User
from sqlmodel import Session, select
from typing import Optional
from app.db.database import engine

def add_runner(new_runner: Runner) -> Runner:
    """Add a new runner, flush to retrieve ID."""
    with Session(engine) as session:
        session.add(new_runner)
        session.commit()
        session.refresh(new_runner)
        return new_runner

def find_all_runners() -> list[Runner]:
    """Retrieve all runners."""
    with Session(engine) as session:
        statement = select(Runner)
        return session.exec(statement).all()

def find_runners_by_status(status: str) -> list[Runner]:
    """Find runners with a specific status."""
    with Session(engine) as session:
        query = select(Runner).where(Runner.state == status)
        return session.exec(query).all()

def find_alive_runners() -> list[Runner]:
    """Find runners in 'alive' states."""
    with Session(engine) as session:
        alive_states = [
            "runner_starting", "app_starting", "ready",
            "runner_starting_claimed", "ready_claimed", "setup",
            "awaiting_client", "active", "disconnecting", "disconnected"
        ]
        query = select(Runner).where(Runner.state.in_(alive_states))
        return session.exec(query).all()

def find_runner_by_id(id: int) -> Runner:
    """Retrieve the runner by its ID."""
    with Session(engine) as session:
        statement = select(Runner).where(Runner.id == id)
        return session.exec(statement).first()

def find_runner_by_instance_id(instance_id: str) -> Runner:
    """Retrieve the runner by its instance ID."""
    with Session(engine) as session:
        statement = select(Runner).where(Runner.identifier == instance_id)
        return session.exec(statement).first()

def find_runner_by_user_id_and_image_id_and_states(user_id: int, image_id: int, states: list[str]):
    """Retrieve the runner by its user id, image id, and state. Query used to find the user's already existing runner."""
    with Session(engine) as session:
        stmt_runner = select(Runner).where(
            Runner.user_id == user_id,
            Runner.state.in_(states),  # Changed to include awaiting_client too
            Runner.image_id == image_id
        )
        return session.exec(stmt_runner).first()

def find_runner_by_image_id_and_states(image_id: int, states: list[str]):
    """
    Retrieve the runner by its image id and state.

    Query used to pull a runner out of the pool.
    TODO: We should be getting the oldest runner out of this query. That would allow it to accrue
    more bursting credits.
    """
    with Session(engine) as session:
        stmt_runner = select(Runner).where(
            Runner.state.in_(states),
            Runner.image_id == image_id
        )
        return session.exec(stmt_runner).first()

def update_runner(runner: Runner) -> Runner:
    """Update a runner."""
    with Session(engine) as session:
        session.add(runner)
        session.commit()
        session.refresh(runner)
        return runner

def update_whole_runner(runner_id: int, runner_data: Runner) -> Runner:
    """Update an image by its id."""
    with Session(engine) as session:
        db_runner = find_runner_by_id(runner_id)
        if not db_runner:
            return None

        for key, value in runner_data.dict(exclude_unset=True).items():
            if hasattr(db_runner, key) and key != "id":
                setattr(db_runner, key, value)

        session.add(db_runner)
        return db_runner

def find_runner_with_lifecycle_token(token: str) -> Optional[Runner]:
    """
    Find a runner with the given lifecycle token.

    Args:
        session: Database session
        token: The lifecycle token to look for

    Returns:
        Runner object if found, None otherwise
    """
    with Session(engine) as session:
        stmt = select(Runner).where(Runner.lifecycle_token == token)
        return session.exec(stmt).first()

def find_runner_with_id_and_terminal_token(runner_id:int, token: str) -> Runner:
    """Select a runner with a matching terminal token."""
    with Session(engine) as session:
        stmt_runner = select(Runner).where(
            Runner.id == runner_id,
            Runner.terminal_token == token
        )
        return session.exec(stmt_runner).first()

def find_runner_with_terminal_token(token: str) -> Runner:
    """Select a runner with a matching terminal token."""
    with Session(engine) as session:
        stmt_runner = select(Runner).where(
            Runner.terminal_token == token
        )
        return session.exec(stmt_runner).first()

# Add to runner_repository.py
def find_runners_by_image_id(image_id: int) -> list[Runner]:
    """
    Find all runners associated with a specific image.

    Args:
        session: The database session
        image_id: The ID of the image

    Returns:
        A list of Runner objects
    """
    with Session(engine) as session:
        return session.exec(select(Runner).where(Runner.image_id == image_id)).all()

def delete_runner(runner_id: int) -> None:
    """
    Delete a specific runner by ID.

    Args:
        session: The database session
        runner_id: The ID of the runner to delete
    """
    with Session(engine) as session:
        runner = session.get(Runner, runner_id)
        if runner:
            session.delete(runner)

# With user_email
# Add these functions to app/db/runner_repository.py

def find_all_runners_with_user_email() -> list[tuple[Runner, Optional[str]]]:
    """Retrieve all runners with user email."""
    with Session(engine) as session:
        # Using join to get user email
        statement = select(Runner, User.email).outerjoin(User, Runner.user_id == User.id)
        return session.exec(statement).all()

def find_runners_by_status_with_user_email(status: str) -> list[tuple[Runner, Optional[str]]]:
    """Find runners with a specific status and include user email."""
    with Session(engine) as session:
        query = select(Runner, User.email).outerjoin(User, Runner.user_id == User.id).where(Runner.state == status)
        return session.exec(query).all()

def find_alive_runners_with_user_email() -> list[tuple[Runner, Optional[str]]]:
    """Find runners in 'alive' states and include user email."""
    with Session(engine) as session:
        alive_states = [
            "runner_starting", "app_starting", "ready",
            "runner_starting_claimed", "ready_claimed", "setup",
            "awaiting_client", "active", "disconnecting", "disconnected"
        ]
        query = select(Runner, User.email).outerjoin(User, Runner.user_id == User.id).where(Runner.state.in_(alive_states))
        return session.exec(query).all()

def find_runner_by_id_with_user_email(id: int) -> tuple[Runner, Optional[str]]:
    """Retrieve the runner by its ID and include user email."""
    with Session(engine) as session:
        statement = select(Runner, User.email).outerjoin(User, Runner.user_id == User.id).where(Runner.id == id)
        return session.exec(statement).first()
