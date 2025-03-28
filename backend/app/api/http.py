"""Module for generic HTTP interactions."""
from fastapi import FastAPI, Request

def extract_original_ip(client_ip: str, x_forwarded_for: str):
    """
    Extract the IP of the request.

    By default use X-Forwarded-For, and use the client-ip as
    a fallback.
    """
    # Get client IP
    if x_forwarded_for:
        x_forwarded_for = [ip.strip() for ip in x_forwarded_for.split(",")]
    original_ip = x_forwarded_for[0] if x_forwarded_for else client_ip
    return original_ip
