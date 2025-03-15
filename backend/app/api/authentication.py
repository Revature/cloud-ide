"""Module for checking authentication with WorkOS."""
import time
import os
from workos import WorkOSClient
from app.business.pkce import decode_signed_token
from app.models.workos_session import WorkosSession, create_workos_session, get_refresh_token, refresh_session
from app.schemas.auth_schema import WorkOSAuthDTO

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))

# Moving this behavior into a decorator to apply to routes might be best
def token_authentication(access_token: str):
    """Authenticate with workos access token.

    Checks if access token is valid, attempts to refresh if expired. If access and refresh tokens are both invalid,
    throws a workos.exceptions.BadRequestException. Otherwise returns the access_token. Assume it is a new access token
    acquired after refreshing, and return the token to the requester.

    If a refresh is performed, the workos_session table is updated with new access and refresh tokens.

    Args:
        access_token: str - signed access token to be decoded and checked

    Returns:
        A newly refreshed access token, or the same access token if it was not expired.

    Throws:
        workos.exceptions.BadRequestException - if the access token is expired and refresh token not valid.
    """
    # check access token
    decoded_token = decode_signed_token(access_token)
    if int(time.time()) >= decoded_token.get("exp"): #If time has advanced beyond expiration, need to refresh
        refresh_response = workos.user_management.authenticate_with_refresh_token(refresh_token=get_refresh_token(access_token))
        # print(f"\n    REFRESH RESPONSE TOKEN A:\n{refresh_response.access_token}\n    REFRESH RESPONSE TOKEN B: {refresh_response.refresh_token}\n")
        refresh_session(access_token, refresh_response.access_token, refresh_response.refresh_token)
        access_token = refresh_response.access_token
    return access_token

def password_authentication(auth: WorkOSAuthDTO):
    """Authenticate with WorkOS using the password oAuth flow.

    Args:
        auth: app.api.routes.auth.PasswordAuth object containing username, password, host, and user-agent
    Returns:
        A signed access token
    Throws:
        workos.exceptions.BadRequestException - if credentials are not valid
    """
    workos_auth_response = workos.user_management.authenticate_with_password(
        email=auth.email, password=auth.password, ip_address=auth.ip_address, user_agent=auth.user_agent
    )


    print("\n\nDebug - decoding signed token\n\n")

    decoded_token = decode_signed_token(workos_auth_response.access_token)

    print("\n\nDebug - getting expiration\n\n")
    expiration = decoded_token.get("exp")

    print("\n\nDebug - creating workos session object\n\n")
    workos_session = WorkosSession(
        session_id = decoded_token.get("sid"),
        expiration = expiration,
        ip_address = auth.ip_address,
        user_agent = auth.user_agent,
        encrypted_refresh_token = "",
        encrypted_access_token = ""
        )
    print("\n\nDebug - encrypting tokens\n\n")
    workos_session.set_decrypted_access_token(workos_auth_response.access_token)
    workos_session.set_decrypted_refresh_token(workos_auth_response.refresh_token)

    # store the session in the database
    print("\n\nDebug - saving to db\n\n")
    create_workos_session(workos_session)

    print("\n\nDebug - done with auth function\n\n")
    return workos_auth_response.access_token
