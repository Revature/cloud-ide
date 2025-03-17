"""Main module to start the FastAPI application."""

from fastapi import FastAPI
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from app.db.database import create_db_and_tables, engine
from app.api.main import api_router

# Import business modules
from app.business.resource_setup import setup_resources
from app.business.runner_management import launch_runners, shutdown_all_runners
from app.models.image import Image

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager to handle startup and shutdown of the FastAPI application."""
    # Create DB and tables
    create_db_and_tables()

    # Set up default resources
    setup_resources()

    # Find all images with pool size > 0 and launch runners for each
    with Session(engine) as session:
        stmt = select(Image).where(Image.runner_pool_size > 0)
        images = session.exec(stmt).all()
        
        for image in images:
            # Launch runners for each image based on its pool size
            await launch_runners(
                image_identifier=image.identifier,
                runner_count=image.runner_pool_size,
                initiated_by="app_startup"
            )

    # Yield so the app can start serving requests
    yield

    # On shutdown: terminate all alive runners
    await shutdown_all_runners()

app = FastAPI(lifespan=lifespan, root_path="/api")
app.include_router(api_router)

@app.get("/")
def read_root():
    """Check if the application is running."""
    return {"message": "Hello, welcome to the cloud ide dev backend!"}