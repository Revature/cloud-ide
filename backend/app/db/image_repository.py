"""Repository layer for the Image entity."""
from app.db.database import engine
from app.models import Image
from sqlmodel import Session, select, and_, or_
from typing import Optional

def find_all_images(session: Session) -> list[Image]:
    """Select all images."""
    statement = select(Image)
    return session.exec(statement).all()

def find_image_by_identifier(session: Session, identifier: str) -> Image:
    """Select an image by its identifier."""
    statement = select(Image).where(Image.identifier == identifier)
    return session.exec(statement).first()

def find_image_by_id(session: Session, id: int, include_deleted: bool = False, include_inactive: bool = False) -> Optional[Image]:
    """
    Select an image by its id, with options to include deleted and inactive images.

    Args:
        session: Database session
        id: Image ID to find
        include_deleted: If True, will return images even if status is "deleted"
        include_inactive: If True, will return images even if status is "inactive"

    Returns:
        Image or None: The image if found and matches status criteria, otherwise None
    """
    # Start with the base condition - matching the ID
    conditions = [Image.id == id]

    # Add status filters based on parameters
    if not include_deleted:
        conditions.append(Image.status != "deleted")

    if not include_inactive:
        conditions.append(Image.status != "inactive")

    # Combine all conditions with AND
    statement = select(Image).where(and_(*conditions))

    return session.exec(statement).first()

def find_images_by_cloud_connector_id(session: Session, cloud_connector_id: int) -> list[Image]:
    """Select images by their cloud connector id."""
    statement = select(Image).where(Image.cloud_connector_id == cloud_connector_id)
    return session.exec(statement).all()

# In image_repository.py
def update_image(session: Session, image_id: int, image_data) -> Image:
    """Update an image by its id."""
    db_image = find_image_by_id(session, image_id)
    if not db_image:
        return None

    # Handle both dict and Image objects
    if not isinstance(image_data, dict):
        image_data = image_data.dict(exclude_unset=True)

    for key, value in image_data.items():
        if hasattr(db_image, key) and key != "id":
            # Special handling for tags if needed
            if key == "tags" and value is None:
                setattr(db_image, key, [])
            else:
                setattr(db_image, key, value)

    session.add(db_image)
    return db_image

def update_image_status(session: Session, image_id: int, status: str) -> Optional[Image]:
    """
    Update the status of an image.

    Args:
        session: Database session
        image_id: ID of the image to update
        status: New status value ("active" or "inactive")

    Returns:
        Updated Image object or None if not found
    """
    # Find the image (excluding deleted ones)
    image = find_image_by_id(session, image_id, include_deleted=False, include_inactive=True)

    if not image:
        return None

    # Only update if the status is different from current
    if image.status != status:
        image.status = status
        session.add(image)

    return image

def create_image(session: Session, image: Image) -> Image:
    """Create a new image."""
    session.add(image)
    session.commit()
    session.refresh(image)
    return image

def delete_image(session: Session, image_id: int) -> bool:
    """Mark an image as deleted by its id without removing it from the database."""
    db_image = find_image_by_id(session, image_id, include_deleted=False, include_inactive=True)
    if not db_image:
        return False

    # Update status to "deleted" instead of deleting the record
    db_image.status = "deleted"
    session.add(db_image)
    session.commit()
    return True

def find_images_with_pool():
    """Find images with a runner pool > 0."""
    with Session(engine) as session:
        stmt = select(Image).where(Image.runner_pool_size > 0)
        return session.exec(stmt).all()
