"""Enhanced database connection management with robust error handling."""

import os
import logging
import time
from contextlib import contextmanager
from sqlmodel import SQLModel, create_engine, Session, select
from dotenv import load_dotenv
from sqlalchemy.exc import OperationalError, PendingRollbackError, InterfaceError

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Define your DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL")

# Extract engine configuration from environment variables with defaults
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "900"))  # 15 minutes
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

# Create engine with optimized connection pool settings
engine = create_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,                   # Check connection validity before use
    pool_recycle=POOL_RECYCLE,            # Recycle connections after this many seconds
    pool_size=POOL_SIZE,                  # Maximum number of persistent connections
    max_overflow=MAX_OVERFLOW,            # Allow this many extra connections when pool is full
    pool_timeout=POOL_TIMEOUT,            # Wait this many seconds for a connection
    connect_args={                        # MySQL specific arguments
        "connect_timeout": 10,            # Connection timeout in seconds
    }
)

def reset_db_connection():
    """Reset database connection pool."""
    try:
        logger.info("Resetting database connection pool")
        engine.dispose()
    except Exception as e:
        logger.error(f"Error resetting database connection pool: {e}")

def create_db_and_tables():
    """Create the database and tables if they don't already exist."""
    # Import them in order of dependencies (tables with no foreign keys first)
    from app.models import user, machine, role, workos_session, pkce_cache

    # Then import models that depend on the base models
    from app.models import key, cloud_connector, image

    # Import security_group before runner_security_group to ensure the right order
    from app.models import security_group

    # Finally import models that have the most dependencies
    from app.models import runner, user_role, script, runner_history, runner_security_group

    try:
        # Create any tables that don't exist
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables created or verified")
    except Exception as e:
        logger.error(f"Error creating tables: {e!s}")
        # Attempt to reset the connection pool
        reset_db_connection()
        raise

    # Populate roles only if they don't already exist
    try:
        with get_session_context() as session:
            # Import here to avoid circular imports
            from app.models import role
            existing_role = session.exec(select(role.Role)).first()
            if not existing_role:
                role.populate_roles()
                logger.info("Populated default roles")
    except Exception as e:
        logger.error(f"Failed to populate roles: {e!s}")

# def get_session():
#     """
#     Get a database session as a FastAPI dependency.
#     This is deprecated, it may be keeping connecitons checked out.
#     Instead import the engine from this file and create a session like so:
#     with Session(engine) as session:
#     """
#     with get_session_context() as session:
#         yield session

@contextmanager
def get_session_context():
    """
    Context manager for database session handling with robust error recovery.

    Example:
        with get_session_context() as session:
            # Use session here
    """
    session = None
    try:
        # Create a new session
        session = Session(engine)
        yield session
    except (OperationalError, InterfaceError) as e:
        # Handle connection errors
        error_msg = str(e)
        if session:
            session.rollback()
        logger.warning(f"Database connection error in session: {error_msg}")

        # Reset connection pool if MySQL server has gone away or connection timeout
        if "MySQL server has gone away" in error_msg or "Connection timed out" in error_msg:
            reset_db_connection()
            # Short delay to allow reconnection
            time.sleep(0.5)
        raise
    except PendingRollbackError as e:
        # Handle transaction errors
        if session:
            logger.warning(f"PendingRollbackError in session, rolling back: {e}")
            try:
                session.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {rollback_error}")
                # Force connection pool reset
                reset_db_connection()
        raise
    except Exception as e:
        # Handle other exceptions
        if session:
            logger.warning(f"Session error, rolling back: {e}")
            try:
                session.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {rollback_error}")
        raise
    finally:
        # Always close the session
        if session:
            try:
                session.close()
            except Exception as e:
                logger.error(f"Error closing session: {e!s}")
                # Force connection pool reset on session close error
                reset_db_connection()

@contextmanager
def safe_session():
    """
    Context manager for database session with automatic commit/rollback.

    Example:
        with safe_session() as session:
            # Use session here - commits automatically if no exceptions
    """
    with get_session_context() as session:
        try:
            yield session
            session.commit()
        except Exception:
            try:
                session.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {rollback_error}")
            raise
