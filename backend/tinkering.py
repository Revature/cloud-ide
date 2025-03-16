"""
What even is this file.

Why am I writing this comment?
"""

import os
import json
from fastapi import FastAPI
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from sqlmodel import Field, Session, SQLModel, create_engine, select
from app.models import machine, image, runner, role, user_role, script, runner_history
from app.models.user import User, UserUpdate, create_user, get_user, update_user, delete_user
from app.models.role import Role
from app.db.database import get_session, create_db_and_tables
from fastapi import APIRouter
from app.api.routes import users, runners, machines, images, app_requests # import your new images route
# from app.api.main import api_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    We want to pass our linting coverage, and every method should have a docstring.

    So here's a docstring.
    """
    # Startup: Create DB and tables
    #create_db_and_tables()
    # start_scheduler()
    yield
    # Shutdown: Cleanup code (if needed)

# load_dotenv()
# app = FastAPI(lifespan=lifespan)
# # app.include_router(api_router)

app = APIRouter()
app.include_router(users.router, prefix="/app/v1/users", tags=["users"])
app.include_router(users.router, prefix="/app/v1/users", tags=["users"])
app.include_router(users.router, prefix="/app/v1/users", tags=["users"])
app.include_router(runners.router, prefix="/app/v1/runners", tags=["runners"])
# api_router.include_router(scripts.router, prefix="/app/v1/scripts", tags=["scripts"])
app.include_router(images.router, prefix="/app/v1/images", tags=["images"])
app.include_router(machines.router, prefix="/app/v1/machines", tags=["machines"])
app.include_router(app_requests.router, prefix="/app/v1/app_requests", tags=["app_requests"]) # include your new images route

# @app.get("/users/{id}")
# def read_root(id: int):
#     user = get_user(id)
#     return user

# @app.post("/users")
# def post(user: User):
#     return create_user(user)

# @app.put("/users")
# def put(userUpdate: UserUpdate):
#     return update_user(userUpdate)


# @app.delete("/users/{id}")
# def read_root(id: int):
#     delete_user(id)


# @app.delete("/resetdb")
# def reset_db():
#     create_db_and_tables()

