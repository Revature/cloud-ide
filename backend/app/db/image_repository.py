"""Repository layer for the Image entity."""
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

def find_image_by_id(session: Session, id: str) -> Image:
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
