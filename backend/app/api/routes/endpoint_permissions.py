"""Endpoint permission management routes."""
from fastapi import APIRouter, HTTPException, Request
from app.models import EndpointPermission
from app.business import endpoint_permission_management, endpoint_permission_decorator
from app.util.transactions import with_database_resilience
from pydantic import BaseModel

router = APIRouter()

class EndpointPermissionCreate(BaseModel):
  """Data model for creating a new endpoint permission."""

  resource: str
  endpoint: str
  permission: str

class EndpointPermissionUpdate(BaseModel):
  """Data model for updating an endpoint permission."""

  permission: str

@router.get("/endpoint-permissions/", response_model=list[EndpointPermission])
@endpoint_permission_decorator.permission_required("endpoint_permissions")
@with_database_resilience
async def read_endpoint_permissions(request: Request):
    """List all endpoint permission mappings."""
    return endpoint_permission_management.get_all_endpoint_permissions()

@router.post("/endpoint-permissions/", response_model=EndpointPermission)
@endpoint_permission_decorator.permission_required("endpoint_permissions")
@with_database_resilience
async def create_new_endpoint_permission(
    endpoint_permission: EndpointPermissionCreate,
    request: Request
):
    """Create a new endpoint permission mapping."""
    # Check if the mapping already exists
    existing = endpoint_permission_management.get_endpoint_permission_by_resource_endpoint(
        endpoint_permission.resource,
        endpoint_permission.endpoint
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Endpoint permission mapping already exists"
        )

    return endpoint_permission_management.create_endpoint_permission(
        resource=endpoint_permission.resource,
        endpoint=endpoint_permission.endpoint,
        permission=endpoint_permission.permission
    )

@router.put("/endpoint-permissions/{resource}/{endpoint}", response_model=EndpointPermission)
@endpoint_permission_decorator.permission_required("endpoint_permissions")
@with_database_resilience
async def update_existing_endpoint_permission(
    resource: str,
    endpoint: str,
    endpoint_permission: EndpointPermissionUpdate,
    request: Request
):
    """Update an existing endpoint permission mapping."""
    updated = endpoint_permission_management.update_endpoint_permission_by_resource_endpoint(
        resource=resource,
        endpoint=endpoint,
        permission=endpoint_permission.permission
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Endpoint permission not found")

    return updated

@router.delete("/endpoint-permissions/{resource}/{endpoint}", response_model=dict)
@endpoint_permission_decorator.permission_required("endpoint_permissions")
@with_database_resilience
async def delete_existing_endpoint_permission(
    resource: str,
    endpoint: str,
    request: Request
):
    """Delete an endpoint permission mapping."""
    success = endpoint_permission_management.delete_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

    if not success:
        raise HTTPException(status_code=404, detail="Endpoint permission not found")

    return {"message": "Endpoint permission deleted successfully"}
