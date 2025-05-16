"""Transaction management utility for API routes."""

import logging
import functools
import asyncio
from typing import Callable, Any, TypeVar
from collections.abc import Awaitable
from fastapi import HTTPException, status
from sqlalchemy.exc import OperationalError, PendingRollbackError, InterfaceError
from pymysql.err import OperationalError as PyMySQLOperationalError
from app.db.database import reset_db_connection

logger = logging.getLogger(__name__)

# Type for async function that returns any type
F = TypeVar('F', bound=Callable[..., Awaitable[Any]])

def with_database_resilience(func: F) -> F:
    """
    Ensure database connection resilience for API routes.

    This decorator:
    1. Ensures database connection errors are handled gracefully
    2. Attempts to reset the connection pool when needed
    3. Converts database exceptions to appropriate HTTP responses

    Args:
        func: The async API route handler function to wrap

    Returns:
        Wrapped function that handles database errors gracefully
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        # First try to reset the connection pool to ensure we start fresh
        try:
            reset_db_connection()
        except Exception as e:
            logger.warning(f"Error resetting connection pool before API call: {e}")

        try:
            # Execute the original function
            return await func(*args, **kwargs)

        except PendingRollbackError as e:
            # Handle transaction errors
            logger.warning(f"PendingRollbackError in API route {func.__name__}: {e}")

            # Reset connection pool
            reset_db_connection()

            # Return a user-friendly error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred. Please retry your request."
            ) from e

        except (OperationalError, InterfaceError, PyMySQLOperationalError) as e:
            # Handle database connection errors
            error_msg = str(e)
            logger.error(f"Database connection error in {func.__name__}: {error_msg}")

            # Reset connection pool for specific errors
            if "MySQL server has gone away" in error_msg or "Connection timed out" in error_msg:
                reset_db_connection()

            # Return appropriate error to client
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection error. Please retry your request."
            ) from e

        except HTTPException:
            # Pass through HTTP exceptions without modification
            raise

        except Exception as e:
            # Handle any other exceptions
            logger.error(f"Error in {func.__name__}: {e}", exc_info=True)

            # Reset connection pool as a precaution
            reset_db_connection()

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {e!s}"
            ) from e

    return wrapper  # type: ignore

def with_background_resilience(func: F) -> F:
    """
    Ensure that database errors are handled properly.

    Similar to with_database_resilience but doesn't convert errors to HTTP exceptions
    since this is meant for background tasks not directly connected to API responses.

    Args:
        func: The async background task function to wrap

    Returns:
        Wrapped function that handles database errors gracefully
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            # Execute the original function
            return await func(*args, **kwargs)

        except (OperationalError, InterfaceError, PendingRollbackError, PyMySQLOperationalError) as e:
            # Handle database errors
            error_msg = str(e)
            logger.error(f"Database error in background task {func.__name__}: {error_msg}")

            # Reset connection pool for specific errors
            if "MySQL server has gone away" in error_msg or "Connection timed out" in error_msg or "PendingRollbackError" in error_msg:
                reset_db_connection()

            # Retry once after a short delay
            logger.info(f"Retrying background task {func.__name__} after database error")
            await asyncio.sleep(1)
            return await func(*args, **kwargs)

        except Exception as e:
            # Handle any other exceptions
            logger.error(f"Error in background task {func.__name__}: {e}", exc_info=True)
            raise

    return wrapper  # type: ignore
