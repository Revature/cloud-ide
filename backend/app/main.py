"""Main module to start the FastAPI application."""
from dotenv import load_dotenv
from app.api.main import start_api

load_dotenv()

app = start_api()

