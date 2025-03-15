"""Main module to start the FastAPI application."""

from fastapi import FastAPI
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from app.db.database import create_db_and_tables
from app.api.main import api_router

# Import business modules
from app.business.resource_setup import setup_resources
from app.business.runner_management import launch_runners, shutdown_all_runners

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager to handle startup and shutdown of the FastAPI application."""
    # Create DB and tables
    create_db_and_tables()

    # Fetch default resources.
    resources = setup_resources()
    image_identifier = resources.image_identifier
    runner_count = resources.runner_pool_size  # from the updated Resources dataclass

    # Launch new runners as per the pool size.
    await launch_runners(image_identifier, runner_count, initiated_by="app_startup")

    # Yield so the app can start serving requests.
    yield

    # On shutdown: terminate all alive runners.
    await shutdown_all_runners()

app = FastAPI(lifespan=lifespan, root_path="/api")
app.include_router(api_router)

@app.get("/")
def read_root():
    """Check if the application is running."""
    return {"message": "Hello, welcome to the cloud ide dev backend!"}
