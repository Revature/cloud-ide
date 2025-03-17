"""Module for decoding digitally signed tokens."""

import os
import jwt
import json
import httpx
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))


def decode_signed_token(access_token: str):
    """Decode a digitally signed token. Uses workOS signing keys."""
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
