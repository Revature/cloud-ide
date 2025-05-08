"""Repository layer for the Image entity."""
from app.db.database import get_session
from app.models import Image
from sqlmodel import Session, select

def find_all_images(session: Session) -> list[Image]:
    """Select all images."""
    statement = select(Image)
    return session.exec(statement).all()

def find_image_by_identifier(session: Session, identifier: str) -> Image:
    """Select an image by its identifier."""
    statement = select(Image).where(Image.identifier == identifier)
    return session.exec(statement).first()

def find_image_by_id(session: Session, id: int) -> Image:
    """Select an image by its id."""
    statement = select(Image).where(Image.id == id)
    return session.exec(statement).first()

def update_image(session: Session, image_id: int, image_data: Image) -> Image:
    """Update an image by its id."""
    db_image = find_image_by_id(session, image_id)
    if not db_image:
        return None

    for key, value in image_data.dict(exclude_unset=True).items():
        if hasattr(db_image, key) and key != "id":
            setattr(db_image, key, value)

    session.add(db_image)
    return db_image

def create_image(session: Session, image: Image) -> Image:
    """Create a new image."""
    session.add(image)
    session.commit()
    session.refresh(image)
    return image

def delete_image(session: Session, image_id: int) -> bool:
    """Mark an image as deleted by its id without removing it from the database."""
    db_image = find_image_by_id(session, image_id)
    if not db_image:
        return False

    # Update status to "deleted" instead of deleting the record
    db_image.status = "deleted"
    session.add(db_image)
    session.commit()
    return True

def find_images_with_pool(session: Session = next(get_session())):
    """Find images with a runner pool > 0."""
    stmt = select(Image).where(Image.runner_pool_size > 0)
    return session.exec(stmt).all()
