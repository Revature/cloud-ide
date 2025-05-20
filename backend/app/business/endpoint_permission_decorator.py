# app/business/endpoint_permission_decorator.py
'''Decorator to check if the user has the required permission for this endpoint.'''
from functools import wraps
from fastapi import Request, HTTPException, Depends
from app.db.database import get_session
from sqlmodel import Session
from app.business.pkce import user_has_permission
from typing import Callable, Optional
import logging

logger = logging.getLogger(__name__)

def permission_required(resource: Optional[str] = None):
    """
    Decorator to check if the user has the required permission for this endpoint.

    Args:
        resource: Optional resource name override. If not provided, it will be 
                 extracted from the router prefix.

    Usage:
        @router.get("/")
        @permission_required()
        async def read_items():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, request: Request = None, **kwargs):
            # Get the access token
            access_token = request.headers.get("Access-Token") if request else None
            print(f"Access token: {access_token}")
            
            # If no access token, let the authentication middleware handle it
            if not access_token:
                return await func(*args, **kwargs)
            
            try:
                # Get the endpoint function name
                endpoint_func = func.__name__
                print(f"Endpoint function: {endpoint_func}")
                
                # Determine the resource
                resource_name = resource
                print(f"Resource name: {resource_name}")
                if not resource_name:
                    # Extract from router prefix
                    path_parts = request.url.path.split('/')
                    if len(path_parts) >= 4:  # /api/v1/resource/...
                        resource_name = path_parts[3]
                
                if not resource_name:
                    logger.warning(f"Could not determine resource for {endpoint_func}")
                    return await func(*args, **kwargs)
                
                # Check if this endpoint requires specific permissions
                session = next(get_session())
                from app.db import endpoint_permission_repository
                
                endpoint_permission = endpoint_permission_repository.find_endpoint_permission_by_resource_endpoint(
                    session, resource_name, endpoint_func
                )
                print(f"Endpoint permission: {endpoint_permission}")
                
                # If permission is required, check if user has it
                if endpoint_permission:
                    required_permission = endpoint_permission.permission
                    if not user_has_permission(access_token, required_permission):
                        print(f"User does not have permission: {required_permission}")
                        logger.warning(f"Permission denied: {required_permission} for {resource_name}.{endpoint_func}")
                        raise HTTPException(
                            status_code=403,
                            detail=f"You don't have the required permission: {required_permission}"
                        )
            
            except HTTPException:
                # Rethrow HTTP exceptions
                raise
            except Exception as e:
                # Log other errors but continue - don't block user because permission check failed
                logger.exception(f"Error in permission check: {e}")
            
            # If we get here, either permission check passed or wasn't needed
            print(f"Permission check passed for {endpoint_func}")
            return await func(*args, **kwargs)

        return wrapper

    return decorator