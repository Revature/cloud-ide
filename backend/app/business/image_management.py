"""Module for managing images, templates for runners (AWS AMI & their config)."""

from datetime import datetime, timedelta
from app.models.key import Key
from celery.utils.log import get_task_logger
from sqlmodel import Session, select
from app.db.database import engine
from app.models import Machine, Image, Runner, CloudConnector
from app.business.cloud_services.cloud_service_factory import get_cloud_service
from app.tasks.starting_runner import update_runner_state
from app.business.key_management import get_daily_key
from app.db import image_repository
from app.models.runner_history import RunnerHistory

def get_image_by_identifier(identifier:str) -> Image:
    """Get an image by its identifier (AWS string)."""
    with Session(engine) as session:
        return image_repository.find_image_by_identifier(session, identifier)

def get_image_by_id(id:int) -> Image:
    """Get an image by its id (numeric)."""
    with Session(engine) as session:
        return image_repository.find_image_by_id(session, id)
