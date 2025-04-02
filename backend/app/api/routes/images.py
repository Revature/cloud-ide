"""Images API routes."""

from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from sqlmodel import Session, select
from app.db.database import get_session
from app.models.image import Image
from app.business import image_management

router = APIRouter()

# @router.post("/", response_model=Image, status_code=status.HTTP_201_CREATED)
# def create_image(image: Image, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
#     """Create a new Image record."""
#     session.add(image)
#     session.commit()
#     session.refresh(image)
#     return image

@router.get("/", response_model=list[Image])
def read_images(session: Session = Depends(get_session),
                #access_token: str = Header(..., alias="Access-Token")
         ):
    """Retrieve a list of all Images."""
    images = session.exec(select(Image)).all()
    return images

@router.get("/{image_id}", response_model=Image)
def read_image(image_id: int, session: Session = Depends(get_session),
               #access_token: str = Header(..., alias="Access-Token")
               ):
    """Retrieve a single Image by ID."""
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image




# @router.delete("/{image_id}", status_code=status.HTTP_200_OK)
# def delete_image(image_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
#     """Delete an Image record."""
#     image = session.get(Image, image_id)
#     if not image:
#         raise HTTPException(status_code=404, detail="Image not found")
#     session.delete(image)
#     session.commit()
