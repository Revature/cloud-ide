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
async def create_image(image: ImageCreate):
    """
    Create a new Image record.

    Returns an Image with status 'creating'. The status will be updated to 'active'
    once the cloud provider confirms the image is available.
    """
    try:
        created_image = await image_management.create_image(image.dict(), image.runner_id)
        return created_image
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e!s}") from e

@router.get("/", response_model=list[Image])
def read_images(
                #access_token: str = Header(..., alias="Access-Token")
         ):
    """Retrieve a list of all Images."""
    images = image_management.get_all_images()
    if not images:
        raise HTTPException(status_code=204, detail="No images found")
    return images

@router.get("/{image_id}", response_model=Image)
def read_image(image_id: int,
               #access_token: str = Header(..., alias="Access-Token")
               ):
    """Retrieve a single Image by ID."""
    image = image_management.get_image_by_id(image_id, include_deleted=True, include_inactive=True)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image

@router.put("/{image_id}", response_model=dict[str, str])
def update_image(
    image_id: int,
    updated_image: Image,
    #access_token: str = Header(..., alias="Access-Token")
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

class ImageStatusUpdate(BaseModel):
    """Data model for updating the status of an image."""

    is_active: bool

@router.patch("/{image_id}/toggle", response_model=Image)
async def toggle_image_status(
    image_id: int,
    status_update: ImageStatusUpdate
):
    """
    Update the active status of an image.

    This endpoint toggles an image between 'active' and 'inactive' states.
    When deactivating an image, it will not be available for new runner creation
    but existing runners will continue to function.
    """
    try:
        # Call business logic to update the status
        updated_image = await image_management.update_image_status(
            image_id,
            status_update.is_active
        )

        if not updated_image:
            raise HTTPException(status_code=404, detail="Image not found")

        return updated_image
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update image status: {e!s}"
        ) from e

@router.delete("/{image_id}", response_model=dict[str, str])
async def delete_image(
    image_id: int
):
    """Delete an Image record."""
    success = await image_management.delete_image(image_id)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": f"Image {image_id} deleted successfully"}
