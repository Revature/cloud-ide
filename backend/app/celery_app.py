"""Module to set up the Celery app and the Celery beat scheduler."""
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "cloud_ide_celery",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.timezone = "UTC"

# Autodiscover tasks from the 'app.tasks' package
celery_app.autodiscover_tasks(["app.tasks"])

try:
    # Imports here because of circular imports
    from app.tasks import starting_runner
    from app.tasks import cleanup_runners
    from app.tasks import runner_pool_management
    from app.tasks import shutdown_runner
except ImportError as e:
    print("Error importing tasks:", e)

# Set up the beat schedule
celery_app.conf.beat_schedule = {
    # This job runs every 15 minutes
    "cleanup-active-runners": {
        "task": "app.tasks.cleanup_runners.cleanup_active_runners",
        "schedule": 600.0,  # Every 10 minutes
    },
    "manage_runner_pool_task": {
        "task": "app.tasks.runner_pool_management.manage_runner_pool",
        "schedule": 900  # Every 15 minutes
    },
}

## Start the Celery worker
# celery -A app.celery_app.celery_app worker --loglevel=info

# # In another terminal, start the Celery beat scheduler
# celery -A app.celery_app.celery_app beat --loglevel=info
