# app/business/jwt_creation.py
"""Module for creating JWT tokens for nginx url."""
import os
import jwt
from datetime import datetime, timedelta

def create_jwt_token(runner_ip: str, runner_id: int, user_ip: str) -> str:
    """
    Create a JWT token that includes runner_ip, runner_id, and user_ip.

    Args:
        runner_ip: The IP address of the runner
        runner_id: The ID of the runner in the database
        user_ip: The IP address of the user

    Returns:
        A JWT token string
    """
    secret = os.getenv("JWT_SECRET", "default_secret")
    algorithm = os.getenv("JWT_ALGORITHM", "HS256")

    payload = {
        "runner_ip": runner_ip,
        "runner_id": runner_id,
        "user_ip": user_ip
    }

    token = jwt.encode(payload, secret, algorithm=algorithm)
    # jwt.encode may return a string or bytes depending on the version of PyJWT
    return token if isinstance(token, str) else token.decode("utf-8")
