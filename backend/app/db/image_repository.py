"""Repository layer for the Image entity."""
from app.models import Image
from sqlmodel import Session, select

def find_image_by_identifier(session:Session, identifier:str) -> Image:
    """Select an image by its identifier."""
    statement = select(Image).where(Image.identifier == identifier)
    return session.exec(statement).first()

def find_image_by_id(session:Session, id:str) -> Image:
    """Select an image by its id."""
    statement = select(Image).where(Image.id == id)
    return session.exec(statement).first()
