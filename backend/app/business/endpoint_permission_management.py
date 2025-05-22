# app/business/endpoint_permission_management.py
"""Business logic for managing endpoint permissions."""

from sqlmodel import Session
from app.models.endpoint_permission import EndpointPermission
from app.db import endpoint_permission_repository
from typing import Optional, Any
from app.db.database import engine

def get_all_endpoint_permissions() -> list[EndpointPermission]:
    """Get all endpoint permissions."""
    return endpoint_permission_repository.find_all_endpoint_permissions()

def get_endpoint_permission_by_id(id: int) -> Optional[EndpointPermission]:
    """Get an endpoint permission by ID."""
    return endpoint_permission_repository.find_endpoint_permission_by_id(id)

def get_endpoint_permission_by_resource_endpoint(
    resource: str,
    endpoint: str
) -> Optional[EndpointPermission]:
    """Get permission for a specific resource and endpoint."""
    return endpoint_permission_repository.find_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

def create_endpoint_permission(
    resource: str,
    endpoint: str,
    permission: str,
    created_by: str = "system"
) -> EndpointPermission:
    """Create a new endpoint permission mapping."""
    # Check if already exists
    existing = get_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

    if existing:
        return existing

    # Create new endpoint permission
    new_permission = EndpointPermission(
        resource=resource,
        endpoint=endpoint,
        permission=permission,
        created_by=created_by,
        modified_by=created_by
    )

    return endpoint_permission_repository.create_endpoint_permission(new_permission)

def update_endpoint_permission(
    id: int,
    data: dict[str, Any],
    modified_by: str = "system"
) -> Optional[EndpointPermission]:
    """Update an endpoint permission by ID."""
    # Add the modified_by to data
    data["modified_by"] = modified_by

    return endpoint_permission_repository.update_endpoint_permission(
        id, data
    )

def update_endpoint_permission_by_resource_endpoint(
    resource: str,
    endpoint: str,
    permission: str,
    modified_by: str = "system"
) -> Optional[EndpointPermission]:
    """Update an endpoint permission by resource and endpoint."""
    return endpoint_permission_repository.update_endpoint_permission_by_resource_endpoint(
        resource, endpoint, permission, modified_by
    )

def delete_endpoint_permission(id: int) -> bool:
    """Delete an endpoint permission by ID."""
    return endpoint_permission_repository.delete_endpoint_permission(id)

def delete_endpoint_permission_by_resource_endpoint(
    resource: str,
    endpoint: str
) -> bool:
    """Delete an endpoint permission by resource and endpoint."""
    return endpoint_permission_repository.delete_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

def check_endpoint_permission(
    resource: str,
    endpoint: str,
    access_token: str
) -> bool:
    """
    Check if a user has permission to access an endpoint.

    Args:
        resource: Resource name (e.g., "cloud_connectors")
        endpoint: Endpoint function name (e.g., "create_cloud_connector")
        access_token: User's access token

    Returns:
        True if the user has permission, False otherwise
    """
    from app.business.pkce import user_has_permission

    # Get the permission required for this endpoint
    endpoint_permission = get_endpoint_permission_by_resource_endpoint(
        resource, endpoint
    )

    # If no permission required, allow access
    if not endpoint_permission:
        return True

    # Check if user has the required permission
    required_permission = endpoint_permission.permission
    return user_has_permission(access_token, required_permission)

def initialize_default_permissions() -> None:
    """Initialize default endpoint permissions."""
    permissions = [
        # Cloud Connectors
        {"resource": "cloud_connectors", "endpoint": "read_cloud_connectors", "permission": "ide:cloud_connectors:view"},
        {"resource": "cloud_connectors", "endpoint": "read_cloud_connector", "permission": "ide:cloud_connectors:view"},
        {"resource": "cloud_connectors", "endpoint": "create_cloud_connector", "permission": "ide:cloud_connectors:create"},
        {"resource": "cloud_connectors", "endpoint": "update_cloud_connector", "permission": "ide:cloud_connectors:edit"},
        {"resource": "cloud_connectors", "endpoint": "toggle_cloud_connector_status", "permission": "ide:cloud_connectors:edit"},
        {"resource": "cloud_connectors", "endpoint": "test_cloud_connector", "permission": "ide:cloud_connectors:view"},

        # App Requests
        {"resource": "app_requests", "endpoint": "get_ready_runner", "permission": "ide:app_requests:create"},
        {"resource": "app_requests", "endpoint": "get_ready_runner_with_status", "permission": "ide:app_requests:create"},

        # Endpoint Permissions
        {"resource": "endpoint_permissions", "endpoint": "read_endpoint_permissions", "permission": "ide:endpoint_permissions:view"},
        {"resource": "endpoint_permissions", "endpoint": "create_new_endpoint_permission", "permission": "ide:endpoint_permissions:create"},
        {"resource": "endpoint_permissions", "endpoint": "update_existing_endpoint_permission", "permission": "ide:endpoint_permissions:edit"},
        {"resource": "endpoint_permissions", "endpoint": "delete_existing_endpoint_permission", "permission": "ide:endpoint_permissions:delete"},

        # Images
        {"resource": "images", "endpoint": "read_images", "permission": "ide:images:view"},
        {"resource": "images", "endpoint": "read_image", "permission": "ide:images:view"},
        {"resource": "images", "endpoint": "create_image", "permission": "ide:images:create"},
        {"resource": "images", "endpoint": "update_image", "permission": "ide:images:edit"},
        {"resource": "images", "endpoint": "update_runner_pool", "permission": "ide:images:edit"},
        {"resource": "images", "endpoint": "toggle_image_status", "permission": "ide:images:edit"},
        {"resource": "images", "endpoint": "delete_image", "permission": "ide:images:delete"},

        # Machines
        {"resource": "machines", "endpoint": "read_machines", "permission": "ide:machines:view"},
        {"resource": "machines", "endpoint": "read_machine", "permission": "ide:machines:view"},

        # Runners
        {"resource": "runners", "endpoint": "read_runners", "permission": "ide:runners:view"},
        {"resource": "runners", "endpoint": "read_runner", "permission": "ide:runners:view"},
        {"resource": "runners", "endpoint": "update_runner", "permission": "ide:runners:edit"},
        {"resource": "runners", "endpoint": "stop_runner_endpoint", "permission": "ide:runners:edit"},
        {"resource": "runners", "endpoint": "start_runner_endpoint", "permission": "ide:runners:edit"},
        {"resource": "runners", "endpoint": "terminate_runner", "permission": "ide:runners:delete"},

        # Scripts
        {"resource": "scripts", "endpoint": "read_scripts", "permission": "ide:scripts:view"},
        {"resource": "scripts", "endpoint": "read_script", "permission": "ide:scripts:view"},
        {"resource": "scripts", "endpoint": "create_script", "permission": "ide:scripts:create"},
        {"resource": "scripts", "endpoint": "update_script", "permission": "ide:scripts:edit"},
        {"resource": "scripts", "endpoint": "delete_script", "permission": "ide:scripts:delete"},
        {"resource": "scripts", "endpoint": "read_scripts_by_image", "permission": "ide:scripts:view"},

        # Users
        {"resource": "users", "endpoint": "get_all_users", "permission": "ide:users:view"},
        {"resource": "users", "endpoint": "get_user", "permission": "ide:users:view"},
        {"resource": "users", "endpoint": "get_user_by_email_path", "permission": "ide:users:view"},
        {"resource": "users", "endpoint": "post_user", "permission": "ide:users:create"},
        {"resource": "users", "endpoint": "update_user", "permission": "ide:users:edit"},
        {"resource": "users", "endpoint": "delete_user", "permission": "ide:users:delete"}

        # Add more permissions as needed
    ]

    for perm in permissions:
        create_endpoint_permission(
            resource=perm["resource"],
            endpoint=perm["endpoint"],
            permission=perm["permission"]
        )
