from backend.app.models import Image
from sqlmodel import Session, Select, select

def find_image_by_identifier(session:Session, identifier:str) -> Image:
    statement: Select[Image] = select(Image).where(Image.identifier == identifier).first()
    return session.exec(statement)