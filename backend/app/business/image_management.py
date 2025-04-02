"""Module for managing images, templates for runners (AWS AMI & their config)."""

from celery.utils.log import get_task_logger
from sqlmodel import Session
from app.db.database import engine
from app.models import Image
from app.db import image_repository, machine_repository, cloud_connector_repository
from app.business.cloud_services import cloud_service_factory
from app.exceptions.runner_exceptions import RunnerExecException

logger = get_task_logger(__name__)

def get_all_images() -> list[Image]:
    """Get all images."""
    with Session(engine) as session:
        return image_repository.find_all_images(session)

def get_image_by_identifier(identifier:str) -> Image:
    """Get an image by its identifier (AWS string)."""
    with Session(engine) as session:
        return image_repository.find_image_by_identifier(session, identifier)

def get_image_by_id(id:int) -> Image:
    """Get an image by its id (numeric)."""
    with Session(engine) as session:
        return image_repository.find_image_by_id(session, id)
    
def update_image(image_id: int, updated_image: Image) -> bool:
    """Update an existing image with new values."""
    with Session(engine) as session:
        # Get the updated image from repository
        db_image = image_repository.update_image(session, image_id, updated_image)
        if not db_image:
            logger.error(f"Image with id {image_id} not found for updating")
            return False
        
        session.commit()
        
        return True

def get_image_config(image_id: int, initiated_by: str = "default") -> dict:
    """Get all the config necessary for cloud manipulation on an image. TODO: Refactor to use sql joins."""
    # Open one DB session for reading resources.
    results:dict = {}
    with Session(engine) as session:
        # 1) Fetch the Image.
        db_image : Image = image_repository.find_image_by_id(session, image_id)
        if not db_image:
            logger.error(f"[{initiated_by}] Image with id not found: {image_id}")
            raise RunnerExecException("Image not found")
        results["image"]=db_image

        # 2) Fetch the Machine associated with the image.
        if db_image.machine_id is None:
            logger.error(f"[{initiated_by}] No machine associated with image {db_image.id}")
            raise RunnerExecException("No machine associated with the image")

        db_machine = machine_repository.find_machine_by_id(session, db_image.machine_id)
        if not db_machine:
            logger.error(f"[{initiated_by}] Machine not found: {db_image.machine_id}")
            raise RunnerExecException("Machine not found")
        results["machine"]=db_machine

        # 3) Get the cloud connector
        db_cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(session, db_image.cloud_connector_id)
        if not db_cloud_connector:
            logger.error(f"[{initiated_by}] Cloud connector not found: {db_image.cloud_connector_id}")
            raise RunnerExecException("Cloud connector not found")
        results["cloud_connector"]=db_cloud_connector

        # 4) Get the appropriate cloud service
        cloud_service = cloud_service_factory.get_cloud_service(db_cloud_connector)
        results["cloud_service"] = cloud_service
        return results
