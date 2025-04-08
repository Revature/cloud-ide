"""Security group model."""
from typing import Any
from sqlmodel import SQLModel, Field, Column, JSON
from app.models.mixins import TimestampMixin

class SecurityGroup(TimestampMixin, SQLModel, table=True):
    __tablename__ = "security_group"
    """Security group model for runner network access control."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    cloud_connector_id: int = Field(foreign_key="cloud_connector.id")
    cloud_group_id: str
    # Status of the security group (active, pending_deletion, etc.)
    status: str = Field(default="active", index=True)

    # Store inbound/outbound rules as JSON
    inbound_rules: dict[str, Any] = Field(
        default={},
        sa_column=Column(JSON, nullable=False)
    )
    outbound_rules: dict[str, Any] = Field(
        default={},
        sa_column=Column(JSON, nullable=False)
    )