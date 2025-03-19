"""Users API routes."""
import json
import os
from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from sqlmodel import Session, select
from workos import WorkOSClient
from app.db.database import get_session
from app.models.user import User
from app.schemas.user import UserCreate

# We'll need to import Role and UserRole when creating a user.
from app.models.role import Role
from app.models.user_role import UserRole

router = APIRouter()

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))

@router.get("/", response_model=list[User])
def read_users(session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Retrieve all users."""
    users = session.exec(select(User)).all()
    return users #This might work through the middleware

@router.get("/{user_id}")
def read_user(user_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Retrieve a single user by ID."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return Response(status_code=status.HTTP_200_OK, content=json.dumps(user))

@router.post("/", response_model=User)
def create_user(user_create: UserCreate, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Create a new user, reutrn the new user."""
    # Create a new User instance from the UserCreate data.
    user = User(**user_create.model_dump(), created_by="system", modified_by="system")
    password = user_create.model_dump(include='password').get('password')

    try:
        create_user_payload = {
            "email": user.email,
            "password": password,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        user.workos_id = workos.user_management.create_user(**create_user_payload).id
    except Exception as e:
        return Response(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content = '{"response": "Unable to create user"}')

    session.add(user)
    session.commit()


    # Automatically add the new user to the default user role.
    default_role = session.exec(select(Role).where(Role.name == "user")).first()
    if not default_role:
        default_role = Role(name="user", created_by="system", modified_by="system")
        session.add(default_role)
        session.commit()
        session.refresh(default_role)

    # Create a user-role mapping.
    user_role = UserRole(
        user_id=user.id,
        role_id=default_role.id,
        created_by="system",
        modified_by="system"
    )
    session.add(user_role)
    session.commit()
    session.refresh(user_role)
    session.refresh(user)

    return Response(status_code=status.HTTP_200_OK, content=json.dumps(user))

@router.patch("/{user_id}")
def update_user(user_id: int, user: User, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Update an existing user, return the updated user."""
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    update_data = user.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return Response(status_code=status.HTTP_200_OK, content=json.dumps(db_user))

@router.delete("/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Delete a user, return the deleted user."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    session.delete(user)
    session.commit()
    return Response(status_code=status.HTTP_200_OK, content=json.dumps(user))
