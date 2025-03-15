"""Module to handle database connection and session management."""

import os
from sqlmodel import SQLModel, create_engine, Session, select
from dotenv import load_dotenv

load_dotenv()

# Define your DATABASE_URL. For MySQL (Aurora), you might use:
# "mysql+pymysql://user:password@aurora-endpoint:3306/dbname"
# For local testing, you can use SQLite:
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    """Create the database and tables if they don't already exist."""
    # Import all models so that they are registered with SQLModel metadata.
    from app.models import user, machine, image, runner, role, user_role, script, runner_history, key, cloud_connector, workos_session, pkce_cache

    # Create any tables that don't exist.

    # drop runner_history and runner tables
    # metadata = SQLModel.metadata
    # tables_to_drop = [
    #     table for table in metadata.tables.values()
    #     if table.name in ['runner_history', 'runner']
    # ]

    # # Drop only the runner and runner_history tables
    # for table in tables_to_drop:
    #     table.drop(engine)

    #SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)

    # Populate roles only if they don't already exist.
    with Session(engine) as session:
        existing_role = session.exec(select(role.Role)).first()
        if not existing_role:
            role.populate_roles()

def get_session():
    """Context manager to provide a session for a block of code."""
    # Use the globally created engine.
    with Session(engine) as session:
        yield session
