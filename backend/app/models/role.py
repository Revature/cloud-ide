"""Role model for the application."""

from __future__ import annotations
from sqlmodel import SQLModel, Field, select
from app.models.mixins import TimestampMixin
from app.db.database import get_session

class Role(TimestampMixin, SQLModel, table=True):
    """Role model for the application."""

    id: int | None = Field(default=None, primary_key=True)
    name: str

def populate_roles():
    """Populate the roles table with default roles."""
    # Use the get_session generator to obtain a session.
    session = next(get_session())
    try:
        # Check if any roles already exist.
        existing_roles = session.exec(select(Role)).all()
        if existing_roles:
            # Roles already exist; nothing to do.
            return

        # Otherwise, create the default roles.
        role_admin = Role(id=1, name="admin", created_by="system", modified_by="system")
        role_user = Role(id=2, name="user", created_by="system", modified_by="system")
        session.add(role_admin)
        session.add(role_user)
        session.commit()
    finally:
        session.close()
