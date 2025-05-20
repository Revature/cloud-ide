"""Module for decoding digitally signed tokens."""

import os
import time
import jwt
import json
import httpx
from workos import WorkOSClient

from app.business.workos import get_workos_client
from app.exceptions.authentication_exceptions import NoMatchingKeyException
from app.models.pkce_cache import get_key_set, store_key_set

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))


def decode_token(access_token: str):
    """Decode a token without verifying it's contents."""
    key_set = find_key_set(kid = jwt.get_unverified_header(access_token)["kid"])
    key = jwt.algorithms.RSAAlgorithm.from_jwk(key_set)
    return jwt.decode(access_token, key=key, algorithms=["RS256"], options={"verify_signature": False})

def auto_verify_token(access_token: str):
    """Use PyJWT's verify behavior to verify token."""
    key_set = find_key_set(kid = jwt.get_unverified_header(access_token)["kid"])
    key = jwt.algorithms.RSAAlgorithm.from_jwk(key_set)
    return jwt.decode(access_token, key=key, algorithms=["RS256"])

def verify_token_exp(access_token: str):
    """Manually verify token."""
    key_set = find_key_set(kid = jwt.get_unverified_header(access_token)["kid"])
    key = jwt.algorithms.RSAAlgorithm.from_jwk(key_set)
    decoded_token = jwt.decode(access_token, key=key, algorithms=["RS256"], options={"verify_signature": False})
    print("decoded token")
    print(decoded_token)
    print("\n")

    if int(time.time()) >= decoded_token.get("exp"):
        return False
    # We will want to add other logic here verifying orginization, user, issuer, role, etc
    return True

def find_key_set(kid: str):
    """Find a key set in the cache or get from workos."""
    try:
        return get_key_set(kid = kid)
    except NoMatchingKeyException:
        update_keys()

    return get_key_set(kid = kid)

def update_keys():
    """Update the cache with new keys."""
    workos_client = get_workos_client()
    response = httpx.get(workos_client.user_management.get_jwks_url())
    keys = json.loads(response.text)

    for jwk in keys["keys"]:
        kid = jwk["kid"]
        keystring = json.dumps(jwk)
        store_key_set(kid, keystring)

def get_user_permissions_from_token(access_token: str) -> list:
    """
    Extract user permissions from a WorkOS JWT token.

    Returns:
        List of permission strings
    """
    try:
        # Use your existing function to decode the token
        decoded = decode_token(access_token)

        # Extract permissions directly from the token
        # Based on the actual token structure you shared
        if "permissions" in decoded and isinstance(decoded["permissions"], list):
            return decoded["permissions"]

        return []
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error extracting permissions from token: {e!s}")
        return []

def user_has_permission(access_token: str, required_permission: str) -> bool:
    """
    Check if a user has a specific permission based on their JWT token.

    Args:
        access_token: The JWT token from WorkOS
        required_permission: The permission string to check for

    Returns:
        True if the user has the permission, False otherwise
    """
    try:
        # Get all user permissions
        user_permissions = get_user_permissions_from_token(access_token)

        # Check if the required permission is in the user's permissions
        return required_permission in user_permissions
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error checking user permission: {e!s}")
        return False

# This function is deprecated in favor of the newer ones in this file
def decode_signed_token(access_token: str):
    """Decode a digitally signed token. Uses workOS signing keys.

    DEPRECATED
    """
    # get the signing keys
    # TODO: We should cache these keys until the parsing fails to match a kid, then refresh it.
    response = httpx.get(workos.user_management.get_jwks_url())
    keys = json.loads(response.text)

    # parse the signing keys - fix this up later, logic could be better
    public_keys = {}
    for jwk in keys["keys"]:
        kid = jwk["kid"]
        public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))

    kid = jwt.get_unverified_header(access_token)["kid"]
    key = public_keys[kid]

    return jwt.decode(access_token, key=key, algorithms=["RS256"], options={"verify_exp": False})

