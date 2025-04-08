"""Runner Security Group Model."""
from sqlmodel import SQLModel, Field, Column, JSON
from app.models.mixins import TimestampMixin

class RunnerSecurityGroup(TimestampMixin, SQLModel, table=True):
    __tablename__ = "runner_security_group"
    """Association table linking runners to security groups."""

    runner_id: int = Field(
        foreign_key="runner.id",
        primary_key=True
    )
    security_group_id: int = Field(
        foreign_key="security_group.id",
        primary_key=True
    )
