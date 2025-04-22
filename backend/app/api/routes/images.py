"""Images API routes."""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from app.business import image_management
from app.models.image import Image
from app.business import image_management
from app.util import constants

router = APIRouter()

class ImageCreate(BaseModel):
    """Schema for creating an Image."""

    name: str
    description: str
    machine_id: int
    cloud_connector_id: int
    runner_id: int

@router.post("/", response_model=Image, status_code=201)
async def create_image(
    image: ImageCreate
):
    """Create a new Image record."""
    try:
        created_image = await image_management.create_image(image.dict(), image.runner_id)
        return created_image
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e!s}") from e

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


class RunnerPoolUpdate(BaseModel):
    """Schema for updating runner pool size."""

    runner_pool_size: int

@router.patch("/{image_id}/runner_pool", response_model=dict[str, str])
def update_runner_pool(
    image_id: int,
    pool_update: RunnerPoolUpdate
):
    """Update the runner pool size of an existing Image."""
    if pool_update.runner_pool_size > constants.max_runner_pool_size:
        raise HTTPException(
            status_code=400,
            detail=f"Runner pool size cannot exceed {constants.max_runner_pool_size}"
        )
    success = image_management.update_runner_pool(image_id, pool_update.runner_pool_size)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": f"Runner pool for image {image_id} updated successfully"}

# @router.delete("/{image_id}", status_code=status.HTTP_200_OK)
# def delete_image(image_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
#     """Delete an Image record."""
#     image = session.get(Image, image_id)
#     if not image:
#         raise HTTPException(status_code=404, detail="Image not found")
#     session.delete(image)
#     session.commit()
