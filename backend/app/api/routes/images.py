"""Images API routes."""

from fastapi import APIRouter, HTTPException, Header
from app.business import image_management
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
def read_images():
    """Retrieve a list of all Images."""
    images = image_management.get_all_images()
    if not images:
        raise HTTPException(status_code=204, detail="No images found")
    return images

@router.get("/{image_id}", response_model=Image)
def read_image(image_id: int,):
    """Retrieve a single Image by ID."""
    image = image_management.get_image_by_id(image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image

@router.put("/{image_id}", response_model=dict[str, str])
def update_image(
    image_id: int,
    updated_image: Image
):
    """Update an existing Image record."""
    success = image_management.update_image(image_id, updated_image)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": f"Image {image_id} updated successfully"}

# @router.delete("/{image_id}", status_code=status.HTTP_200_OK)
# def delete_image(image_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
#     """Delete an Image record."""
#     image = session.get(Image, image_id)
#     if not image:
#         raise HTTPException(status_code=404, detail="Image not found")
#     session.delete(image)
#     session.commit()
