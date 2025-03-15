"""Users API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db.database import get_session
from app.models.user import User
from app.schemas.user import UserCreate
from app.api.authentication import verify_workos_token

# We'll need to import Role and UserRole when creating a user.
from app.models.role import Role
from app.models.user_role import UserRole

router = APIRouter()

@router.get("/", response_model=list[User])
def read_users(session: Session = Depends(get_session)):
    """Retrieve all users."""
    token_payload: dict = Depends(verify_workos_token)
    # print the payload
    print(token_payload)
    users = session.exec(select(User)).all()
    return users

@router.get("/{user_id}", response_model=User)
def read_user(user_id: int, session: Session = Depends(get_session)):
    """Retrieve a single user by ID."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.post("/", response_model=User)
def create_user(user_create: UserCreate, session: Session = Depends(get_session)):
    """Create a new user, reutrn the new user."""
    # Create a new User instance from the UserCreate data.
    user = User(**user_create.model_dump(), created_by="system", modified_by="system")
    session.add(user)
    session.commit()
    session.refresh(user)

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

    return user

@router.patch("/{user_id}", response_model=User)
def update_user(user_id: int, user: User, session: Session = Depends(get_session)):
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
    return db_user

@router.delete("/{user_id}", response_model=User)
def delete_user(user_id: int, session: Session = Depends(get_session)):
    """Delete a user, return the deleted user."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    session.delete(user)
    session.commit()
    return user
