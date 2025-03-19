"""Images API routes."""

from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from sqlmodel import Session, select
from app.db.database import get_session
from app.models.image import Image

router = APIRouter()

@router.post("/", response_model=Image, status_code=status.HTTP_201_CREATED)
def create_image(image: Image, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Create a new Image record."""
    session.add(image)
    session.commit()
    session.refresh(image)
    return image

@router.get("/", response_model=list[Image])
def read_images(session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Retrieve a list of all Images."""
    images = session.exec(select(Image)).all()
    return images

@router.post("/authentication_test", status_code=status.HTTP_201_CREATED)
async def authentication_test(request: Request, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Print all details from the incoming request."""
    # Print headers and query parameters
    print("Headers:", request.headers)
    print("Query Parameters:", request.query_params)

    # Try to read the JSON body, if any
    try:
        body = await request.json()
    except Exception:
        body = None
    print("Body:", body)

    # Optionally, return a simple confirmation response
    return {"detail": "Authentication test: parameters printed to console."}

@router.get("/{image_id}", response_model=Image)
def read_image(image_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Retrieve a single Image by ID."""
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image

@router.put("/{image_id}", response_model=Image)
def update_image(image_id: int, updated_image: Image, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Update an existing Image record."""
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Update fields; typically, you might want to limit which fields can be updated.
    image.name = updated_image.name
    image.description = updated_image.description
    image.identifier = updated_image.identifier
    image.modified_by = updated_image.modified_by
    # Optionally, you might update the modified_on automatically in your model's onupdate configuration.

    session.add(image)
    session.commit()
    session.refresh(image)
    return image

@router.delete("/{image_id}", status_code=status.HTTP_200_OK)
def delete_image(image_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
    """Delete an Image record."""
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    session.delete(image)
    session.commit()
