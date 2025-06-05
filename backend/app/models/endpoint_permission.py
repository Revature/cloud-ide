"""Endpoint Permission Model."""
# app/models/endpoint_permission.py

from sqlmodel import SQLModel, Field
from typing import Optional, ClassVar, Any
from app.models.mixins import TimestampMixin

class EndpointPermission(TimestampMixin, table=True):
    """Table for mapping API endpoints to required permissions."""

    __tablename__ = "endpoint_permission"

    id: Optional[int] = Field(default=None, primary_key=True)
    resource: str = Field(..., index=True, description="Resource name (matches file name)")
    endpoint: str = Field(..., index=True, description="Function name of the endpoint")
    permission: str = Field(..., description="Permission required to access this endpoint")

    model_config: ClassVar[dict[str, Any]] = {
        "schema_extra": {
            "example": {
                "resource": "cloud_connectors",
                "endpoint": "create_cloud_connector",
                "permission": "cloud_connectors:create"
            }
        }
    }
