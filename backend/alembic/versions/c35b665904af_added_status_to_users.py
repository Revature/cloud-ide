"""Added status to users.

Revision ID: c35b665904af
Revises: 1e423e91d361
Create Date: 2025-05-21 14:43:00.130092

"""
from typing import Union
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'c35b665904af'
down_revision: Union[str, None] = '1e423e91d361'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add the column as nullable first
    op.add_column('user', sa.Column('status', sa.String(length=20), nullable=True))

    # Update existing records to set status = 'active'
    op.execute("UPDATE user SET status = 'active' WHERE status IS NULL")

    # For MySQL, you need to specify the existing column type when altering
    # Using the MySQL-specific approach
    op.execute("ALTER TABLE user MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'")


def downgrade() -> None:
    """Downgrade schema."""
    # Simply drop the column
    op.drop_column('user', 'status')
