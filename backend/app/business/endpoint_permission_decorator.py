# app/business/endpoint_permission_decorator.py
"""Decorator to check if the user has the required permission for this endpoint."""
from functools import wraps
from fastapi import Request, HTTPException, Depends, status
from app.db.database import engine
from app.db import endpoint_permission_repository
from sqlmodel import Session
from app.business.pkce import user_has_permission
from app.util import constants
from typing import Callable, Optional, Any
import logging
import inspect

logger = logging.getLogger(__name__)

def permission_required(resource: Optional[str] = None):
    """
    Check if the user has the required permission for this endpoint.

    Args:
        resource: Optional resource name override. If not provided, it will be extracted from the router prefix.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(request: Request, *args, **kwargs):
            # check if AUTH_MODE is on
            if constants.auth_mode == "OFF":
                print("Auth mode is OFF, skipping permission check")
                return await func(*args, request=request, **kwargs)

            # Get the access token
            access_token = request.headers.get("Access-Token")

            # If no access token, raise appropriate exception
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )

            try:
                # Determine the resource
                resource_name = resource
                if not resource_name:
                    path_parts = request.url.path.split('/')
                    max_parts = 4
                    if len(path_parts) >= max_parts:  # /api/v1/resource/...
                        resource_name = path_parts[3]

                if not resource_name:
                    logger.warning(f"Could not determine resource for {func.__name__}")
                    return await func(*args, request=request, **kwargs)

                # Check if endpoint requires specific permissions
                endpoint_permission = endpoint_permission_repository.find_endpoint_permission_by_resource_endpoint(
                    resource_name, func.__name__
                )

                # If permission is required, check if user has it
                if endpoint_permission:
                    required_permission = endpoint_permission.permission
                    if not user_has_permission(access_token, required_permission):
                        logger.warning(f"Permission denied: {required_permission} for {resource_name}.{func.__name__}")
                        raise HTTPException(
                            status_code=403,
                            detail=f"You don't have the required permission: {required_permission}"
                        )

            except HTTPException:
                raise
            except Exception as e:
                logger.exception(f"Error in permission check: {e}")

            # Permission check passed
            print("Permission check passed async")
            kwargs['request'] = request  # Add request as a keyword argument
            if inspect.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(request: Request, *args, **kwargs):
            # check if AUTH_MODE is on
            if constants.auth_mode == "OFF":
                print("Auth mode is OFF, skipping permission check")
                return func(*args, request=request, **kwargs)

            # Get the access token
            access_token = request.headers.get("Access-Token")

            # If no access token, raise appropriate exception
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )

            try:
                # Determine the resource
                resource_name = resource
                if not resource_name:
                    path_parts = request.url.path.split('/')
                    max_parts = 4
                    if len(path_parts) >= max_parts:  # /api/v1/resource/...
                        resource_name = path_parts[3]

                if not resource_name:
                    logger.warning(f"Could not determine resource for {func.__name__}")
                    return func(*args, request=request, **kwargs)

                # Check if endpoint requires specific permissions
                endpoint_permission = endpoint_permission_repository.find_endpoint_permission_by_resource_endpoint(
                    resource_name, func.__name__
                )

                # If permission is required, check if user has it
                if endpoint_permission:
                    required_permission = endpoint_permission.permission
                    if not user_has_permission(access_token, required_permission):
                        logger.warning(f"Permission denied: {required_permission} for {resource_name}.{func.__name__}")
                        raise HTTPException(
                            status_code=403,
                            detail=f"You don't have the required permission: {required_permission}"
                        )

            except HTTPException:
                raise
            except Exception as e:
                logger.exception(f"Error in permission check: {e}")

            # Permission check passed
            print("Permission check passed sync")
            kwargs['request'] = request  # Add request as a keyword argument
            return func(*args, **kwargs)

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
