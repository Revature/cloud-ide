"""Module to handle database connection and session management."""

import os
import logging
from contextlib import contextmanager
from sqlmodel import SQLModel, create_engine, Session, select
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Define your DATABASE_URL. For MySQL (Aurora), you might use:
# "mysql+pymysql://user:password@aurora-endpoint:3306/dbname"
# For local testing, you can use SQLite:
DATABASE_URL = os.getenv("DATABASE_URL")

# Extract engine configuration from environment variables with defaults
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 minutes
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

# Create engine with optimized connection pool settings
engine = create_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,          # Check connection validity before use
    pool_recycle=POOL_RECYCLE,   # Recycle connections
    pool_size=POOL_SIZE,         # Maximum number of persistent connections
    max_overflow=MAX_OVERFLOW,   # Allow this many extra connections when pool is full
    pool_timeout=POOL_TIMEOUT,   # Wait this many seconds for a connection
    connect_args={               # MySQL specific arguments
        "connect_timeout": 10,   # Connection timeout in seconds
    }
)

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

    # Create any tables that don't exist
    SQLModel.metadata.create_all(engine)

    # Populate roles only if they don't already exist
    try:
        with Session(engine) as session:
            existing_role = session.exec(select(role.Role)).first()
            if not existing_role:
                role.populate_roles()
                logger.info("Populated default roles")
    except Exception as e:
        logger.error(f"Failed to populate roles: {e!s}")

def get_session():
    """Get a database session."""
    session = Session(engine)
    try:
        yield session
    except Exception as e:
        logger.warning(f"Session error: {e!s}")
        # Try to reset connection pool if MySQL server has gone away
        if "MySQL server has gone away" in str(e) or "Connection timed out" in str(e):
            logger.info("Attempting to dispose and recreate connection pool")
            try:
                engine.dispose()
            except Exception as dispose_error:
                logger.error(f"Error disposing engine: {dispose_error!s}")

        # Close and recreate session
        try:
            session.close()
        except Exception as close_error:
            logger.error(f"Error closing session: {close_error!s}")
            pass

        # Create a new session
        session = Session(engine)
        yield session
    finally:
        try:
            session.close()
        except Exception as e:
            logger.error(f"Error closing session: {e!s}")

@contextmanager
def manual_session():
    """
    Context manager for manual session handling.

    Example:
        with manual_session() as session:
            # Use session here
    """
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        if "MySQL server has gone away" in str(e) or "Connection timed out" in str(e):
            # Try to reset the connection pool
            try:
                engine.dispose()
                logger.info("Connection pool reset due to MySQL server error")
            except Exception as dispose_error:
                logger.error(f"Error disposing engine: {dispose_error!s}")
                pass
        raise
    finally:
        session.close()
