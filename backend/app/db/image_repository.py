"""Repository layer for the Image entity."""
from backend.app.models import Image
from sqlmodel import Session, select

def find_image_by_identifier(session:Session, identifier:str) -> Image:
    """Select an image by its identifier."""
    statement = select(Image).where(Image.identifier == identifier)
    return session.exec(statement).first()
