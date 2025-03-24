"""Module for generic HTTP interactions."""
from fastapi import FastAPI, Request

def extract_original_ip(req: Request):
    """
    Extract the IP of the request.

    By default use X-Forwarded-For, and use the client-ip as
    a fallback.
    """
    # Get client IP
    client_ip = req.client.host
    x_forwarded_for_header = req.headers.get("X-Forwarded-For")
    x_forwarded_for = None
    if x_forwarded_for_header:
        x_forwarded_for = [ip.strip() for ip in x_forwarded_for_header.split(",")]
    original_ip = x_forwarded_for[0] if x_forwarded_for else client_ip
    return original_ip
