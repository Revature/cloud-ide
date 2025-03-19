"""Module for checking authentication with WorkOS."""
from app.business.pkce import decode_signed_token, decode_token
from app.business.workos import get_workos_client
from app.models.workos_session import WorkosSession, create_workos_session, get_refresh_token, refresh_session
from app.schemas.auth_schema import WorkOSAuthDTO

workos = get_workos_client()

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
        email=auth.email,
        password=auth.password,
        ip_address=auth.ip_address,
        user_agent=auth.user_agent
        )

    decoded_token = decode_token(workos_auth_response.access_token)


    workos_session = WorkosSession(
        session_id = decoded_token.get('sid'),
        expiration =  decoded_token.get('exp'),
        ip_address = auth.ip_address,
        user_agent = auth.user_agent,
        encrypted_refresh_token = "",
        encrypted_access_token = ""
        )
    workos_session.set_decrypted_access_token(workos_auth_response.access_token)
    workos_session.set_decrypted_refresh_token(workos_auth_response.refresh_token)

    print(f'\n\nStoring session: {workos_session}')
    print(f'\n\nUnencrypted token: {workos_auth_response.access_token}')
    print(f'\n\nWith encrypted token: {workos_session.encrypted_access_token}')

    create_workos_session(workos_session)

    return workos_auth_response.access_token
