# app/business/endpoint_permission_management.py
"""Business logic for managing endpoint permissions."""

from sqlmodel import Session
from app.models.endpoint_permission import EndpointPermission
from app.db import endpoint_permission_repository
from typing import Optional, Any

def get_all_endpoint_permissions(session: Session) -> list[EndpointPermission]:
    """Get all endpoint permissions."""
    return endpoint_permission_repository.find_all_endpoint_permissions(session)

def get_endpoint_permission_by_id(session: Session, id: int) -> Optional[EndpointPermission]:
    """Get an endpoint permission by ID."""
    return endpoint_permission_repository.find_endpoint_permission_by_id(session, id)

def get_endpoint_permission_by_resource_endpoint(
    session: Session,
    resource: str,
    endpoint: str
) -> Optional[EndpointPermission]:
    """Get permission for a specific resource and endpoint."""
    return endpoint_permission_repository.find_endpoint_permission_by_resource_endpoint(
        session, resource, endpoint
    )

def create_endpoint_permission(
    session: Session,
    resource: str,
    endpoint: str,
    permission: str,
    created_by: str = "system"
) -> EndpointPermission:
    """Create a new endpoint permission mapping."""
    # Check if already exists
    existing = get_endpoint_permission_by_resource_endpoint(
        session, resource, endpoint
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

    return endpoint_permission_repository.create_endpoint_permission(
        session, new_permission
    )

def update_endpoint_permission(
    session: Session,
    id: int,
    data: dict[str, Any],
    modified_by: str = "system"
) -> Optional[EndpointPermission]:
    """Update an endpoint permission by ID."""
    # Add the modified_by to data
    data["modified_by"] = modified_by

    return endpoint_permission_repository.update_endpoint_permission(
        session, id, data
    )

def update_endpoint_permission_by_resource_endpoint(
    session: Session,
    resource: str,
    endpoint: str,
    permission: str,
    modified_by: str = "system"
) -> Optional[EndpointPermission]:
    """Update an endpoint permission by resource and endpoint."""
    return endpoint_permission_repository.update_endpoint_permission_by_resource_endpoint(
        session, resource, endpoint, permission, modified_by
    )

def delete_endpoint_permission(session: Session, id: int) -> bool:
    """Delete an endpoint permission by ID."""
    return endpoint_permission_repository.delete_endpoint_permission(session, id)

def delete_endpoint_permission_by_resource_endpoint(
    session: Session,
    resource: str,
    endpoint: str
) -> bool:
    """Delete an endpoint permission by resource and endpoint."""
    return endpoint_permission_repository.delete_endpoint_permission_by_resource_endpoint(
        session, resource, endpoint
    )

def check_endpoint_permission(
    session: Session,
    resource: str,
    endpoint: str,
    access_token: str
) -> bool:
    """
    Check if a user has permission to access an endpoint.

    Args:
        session: Database session
        resource: Resource name (e.g., "cloud_connectors")
        endpoint: Endpoint function name (e.g., "create_cloud_connector")
        access_token: User's access token

    Returns:
        True if the user has permission, False otherwise
    """
    from app.business.pkce import user_has_permission

    # Get the permission required for this endpoint
    endpoint_permission = get_endpoint_permission_by_resource_endpoint(
        session, resource, endpoint
    )

    # If no permission required, allow access
    if not endpoint_permission:
        return True

    # Check if user has the required permission
    required_permission = endpoint_permission.permission
    return user_has_permission(access_token, required_permission)

def initialize_default_permissions(session: Session) -> None:
    """Initialize default endpoint permissions."""
    permissions = [
        # Cloud Connectors
        {"resource": "cloud_connectors", "endpoint": "read_cloud_connectors", "permission": "cloud_connectors:view"},
        {"resource": "cloud_connectors", "endpoint": "read_cloud_connector", "permission": "cloud_connectors:view"},
        {"resource": "cloud_connectors", "endpoint": "create_cloud_connector", "permission": "cloud_connectors:create"},
        {"resource": "cloud_connectors", "endpoint": "update_cloud_connector", "permission": "cloud_connectors:edit"},
        {"resource": "cloud_connectors", "endpoint": "toggle_cloud_connector_status", "permission": "cloud_connectors:edit"},
        {"resource": "cloud_connectors", "endpoint": "test_cloud_connector", "permission": "cloud_connectors:view"},

        # App Requests
        {"resource": "app_requests", "endpoint": "get_ready_runner", "permission": "app_requests:create"},
        {"resource": "app_requests", "endpoint": "get_ready_runner_with_status", "permission": "app_requests:create"},

        # Endpoint Permissions
        {"resource": "endpoint_permissions", "endpoint": "read_endpoint_permissions", "permission": "endpoint_permissions:view"},
        {"resource": "endpoint_permissions", "endpoint": "create_new_endpoint_permission", "permission": "endpoint_permissions:create"},
        {"resource": "endpoint_permissions", "endpoint": "update_existing_endpoint_permission", "permission": "endpoint_permissions:edit"},
        {"resource": "endpoint_permissions", "endpoint": "delete_existing_endpoint_permission", "permission": "endpoint_permissions:delete"},

        # Images
        {"resource": "images", "endpoint": "read_images", "permission": "images:view"},
        {"resource": "images", "endpoint": "read_image", "permission": "images:view"},
        {"resource": "images", "endpoint": "create_image", "permission": "images:create"},
        {"resource": "images", "endpoint": "update_image", "permission": "images:edit"},
        {"resource": "images", "endpoint": "update_runner_pool", "permission": "images:edit"},
        {"resource": "images", "endpoint": "toggle_image_status", "permission": "images:edit"},
        {"resource": "images", "endpoint": "delete_image", "permission": "images:delete"},

        # Machines
        {"resource": "machines", "endpoint": "read_machines", "permission": "machines:view"},
        {"resource": "machines", "endpoint": "read_machine", "permission": "machines:view"},

        # Runners
        {"resource": "runners", "endpoint": "read_runners", "permission": "runners:view"},
        {"resource": "runners", "endpoint": "read_runner", "permission": "runners:view"},
        {"resource": "runners", "endpoint": "update_runner", "permission": "runners:edit"},
        {"resource": "runners", "endpoint": "stop_runner_endpoint", "permission": "runners:edit"},
        {"resource": "runners", "endpoint": "start_runner_endpoint", "permission": "runners:edit"},
        {"resource": "runners", "endpoint": "terminate_runner", "permission": "runners:delete"},

        # Scripts
        {"resource": "scripts", "endpoint": "read_scripts", "permission": "scripts:view"},
        {"resource": "scripts", "endpoint": "read_script", "permission": "scripts:view"},
        {"resource": "scripts", "endpoint": "create_script", "permission": "scripts:create"},
        {"resource": "scripts", "endpoint": "update_script", "permission": "scripts:edit"},
        {"resource": "scripts", "endpoint": "delete_script", "permission": "scripts:delete"},
        {"resource": "scripts", "endpoint": "read_scripts_by_image", "permission": "scripts:view"},

        # Users
        {"resource": "users", "endpoint": "get_all_users", "permission": "users:view"},
        {"resource": "users", "endpoint": "get_user", "permission": "users:view"},
        {"resource": "users", "endpoint": "get_user_by_email_path", "permission": "users:view"},
        {"resource": "users", "endpoint": "post_user", "permission": "users:create"},
        {"resource": "users", "endpoint": "update_user", "permission": "users:edit"},
        {"resource": "users", "endpoint": "delete_user", "permission": "users:delete"}

        # Add more here if needed
    ]

    for perm in permissions:
        create_endpoint_permission(
            session=session,
            resource=perm["resource"],
            endpoint=perm["endpoint"],
            permission=perm["permission"]
        )
