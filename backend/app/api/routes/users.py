"""Users API routes."""
import logging
from app.models.user import User, UserUpdate
from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlmodel import Session
from workos import exceptions as workos_exceptions
from app.db.database import get_session
from app.exceptions.user_exceptions import EmailInUseException, NoSuchRoleException
from app.schemas.user import UserCreate
from app.business import user_management, endpoint_permission_decorator

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=list[User])
@endpoint_permission_decorator.permission_required("users")
def get_all_users(request: Request, session: Session = Depends(get_session)):
    """Retrieve all users."""
    return user_management.get_all_users(session)

@router.get("/{user_id}")
@router.get("/{user_id}/")
@endpoint_permission_decorator.permission_required("users")
def get_user(request: Request, user_id: int):
    """Retrieve a single user by ID."""
    user = user_management.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return Response(status_code=status.HTTP_200_OK, content=user.model_dump_json())

@router.get("/email/{email}")
@endpoint_permission_decorator.permission_required("users")
def get_user_by_email_path(email: str, request: Request, session: Session = Depends(get_session)):
    """Retrieve a single user by email address using path parameter."""
    user = user_management.get_user_by_email(email, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {email} not found"
        )
    return Response(status_code=status.HTTP_200_OK, content=user.model_dump_json())

@router.post("/", response_model=User)
@endpoint_permission_decorator.permission_required("users")
def post_user(user_create: UserCreate, request: Request,
              session: Session = Depends(get_session)):
    """Create a new user, return the new user."""
    # Create a new User instance from the UserCreate data.
    user = User(**user_create.model_dump(exclude='password'), created_by="system", modified_by="system")
    password = user_create.model_dump(include='password').get('password')

    try:
        # Create the user
        created_user = user_management.create_user(password=password, user=user)

        # Create a clean dictionary directly from the created user's attributes
        # This bypasses potential issues with SQLModel's dict() method
        user_dict = {
            "id": created_user.id,
            "first_name": created_user.first_name,
            "last_name": created_user.last_name,
            "email": created_user.email,
            "workos_id": created_user.workos_id,
            "created_on": created_user.created_on,
            "updated_on": created_user.updated_on,
            "created_by": created_user.created_by,
            "modified_by": created_user.modified_by
        }

        # Return the manually created dictionary
        return user_dict

    except workos_exceptions.BadRequestException as e:
        # Error handlers remain the same
        logger.exception('Unable to persist user with workos.')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                          detail="Unable to create user.") from e
    except EmailInUseException as e:
        logger.exception(f'Email {user.email} already in use.')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                           detail="That email is already in use.") from e
    except NoSuchRoleException as e:
        logger.exception('Unable to assign the default user role to new user.')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                           detail="Unable to create user with default role.") from e
    except Exception as e:
        logger.exception(f'Exception raised while creating new user: {e!s}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                           detail=f"Unable to create user: {e!s}") from e

@router.patch("/{user_id}")
@router.patch("/{user_id}/")
@endpoint_permission_decorator.permission_required("users")
def update_user(user_id: int, user: UserUpdate, request: Request, session: Session = Depends(get_session)):
    """Update an existing user, return the updated user."""
    db_user = user_management.get_user_by_id(user_id, session)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user_management.update_user(user = user, session = session)

    return Response(status_code=status.HTTP_200_OK,
                    content=db_user.model_dump_json())

@router.delete("/{user_id}")
@router.delete("/{user_id}/")
@endpoint_permission_decorator.permission_required("users")
def delete_user(user_id: int, request: Request, session: Session = Depends(get_session)):
    """Delete a user, return the deleted user."""
    user = user_management.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    user_management.delete_user(user_id = user_id, session = session)
    return Response(status_code=status.HTTP_200_OK, content=user.model_dump_json())
