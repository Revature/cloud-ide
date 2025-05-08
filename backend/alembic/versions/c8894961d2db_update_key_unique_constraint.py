"""update_key_unique_constraint.

Revision ID: c8894961d2db
Revises:
Create Date: 2025-05-05 13:58:42.263579

"""
from typing import Union
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c8894961d2db'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    """Update key table unique constraint."""
    # Drop the existing unique constraint on key_date
    op.drop_index('key_date', table_name='key')

    # Create a new unique constraint on (key_date, cloud_connector_id)
    op.create_unique_constraint(
        'key_date_cloud_connector_unique',
        'key',
        ['key_date', 'cloud_connector_id']
    )

def downgrade():
    """Revert key table unique constraint."""
    # Remove the compound unique constraint
    op.drop_constraint('key_date_cloud_connector_unique', 'key', type_='unique')

    # Restore the original unique constraint on key_date only
    op.create_index('key_date', 'key', ['key_date'], unique=True)
