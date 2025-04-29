"""Script API routes."""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional, List
from app.models.script import Script
from app.business import script_management
from pydantic import BaseModel
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class ScriptCreate(BaseModel):
    """Data model for creating a new script."""
    name: str
    description: str
    event: str
    image_id: int
    script: str

class ScriptUpdate(BaseModel):
    """Data model for updating an existing script."""
    name: Optional[str] = None
    description: Optional[str] = None
    event: Optional[str] = None
    script: Optional[str] = None

@router.get("/", response_model=List[Script])
async def read_scripts(
    request: Request,
    image_id: Optional[int] = Query(None, description="Filter scripts by image ID")
):
    """
    Retrieve a list of scripts.
    
    Optionally filter by image_id.
    """
    # Log request details
    logger.info(f"Request received for scripts endpoint")
    logger.info((f"Client host: {request.client.host}"))

    try:
        # Log before the database call
        print("Attempting to fetch scripts from database")
        
        if image_id:
            print(f"Filtering scripts by image_id: {image_id}")
            scripts = script_management.get_scripts_by_image_id(image_id)
        else:
            scripts = script_management.get_all_scripts()

        # Log the result
        if not scripts:
            print("No scripts found in database")
            return []  # Return empty list instead of 204 to simplify frontend handling

        print(f"Successfully retrieved {len(scripts)} scripts")

        # Optionally log some data about what's being returned
        for i, script in enumerate(scripts):
            print(f"Script {i+1}: ID={script.id}, Name={script.name}, Event={script.event}")

        return scripts

    except Exception as e:
        # Log any exceptions that occur
        print(f"Error fetching scripts: {e!s}")
        print("Detailed exception information:")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e!s}") from e

@router.get("/{script_id}", response_model=Script)
async def read_script(script_id: int):
    """Retrieve a single script by ID."""
    script = script_management.get_script_by_id(script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script

@router.post("/", response_model=Script)
async def create_script(script: ScriptCreate):
    """Create a new script."""
    try:
        new_script = script_management.create_script(
            name=script.name,
            description=script.description,
            event=script.event,
            image_id=script.image_id,
            script=script.script
        )
        return new_script
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create script: {e}")

@router.put("/{script_id}", response_model=Script)
async def update_script(script_id: int, script_update: ScriptUpdate):
    """Update an existing script."""
    # First check if script exists
    existing_script = script_management.get_script_by_id(script_id)
    if not existing_script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    try:
        # Convert Pydantic model to dict, filtering out None values
        update_data = {k: v for k, v in script_update.dict().items() if v is not None}
        
        if not update_data:
            # If no fields to update, just return the existing script
            return existing_script
        
        updated_script = script_management.update_script(script_id, update_data)
        return updated_script
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update script: {e}")

@router.delete("/{script_id}", response_model=dict)
async def delete_script(script_id: int):
    """Delete a script."""
    try:
        # Check if script exists
        existing_script = script_management.get_script_by_id(script_id)
        if not existing_script:
            raise HTTPException(status_code=404, detail="Script not found")
            
        success = script_management.delete_script(script_id)
        if success:
            return {"success": True, "message": f"Script {script_id} deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete script")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete script: {e}")

@router.get("/events", response_model=List[str])
async def get_script_events():
    """Get all available script event types."""
    return [
        "on_create",
        "on_awaiting_client",
        "on_connect",
        "on_disconnect",
        "on_terminate"
    ]

@router.get("/image/{image_id}", response_model=List[Script])
async def read_scripts_by_image(image_id: int):
    """Retrieve all scripts associated with a specific image."""
    scripts = script_management.get_scripts_by_image_id(image_id)
    return scripts
