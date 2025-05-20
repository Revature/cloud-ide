"""Module for checking authentication with WorkOS."""
import os
import json
import logging
import re
from workos import exceptions as workos_exceptions
from app.business.pkce import decode_token
from app.business.workos import get_workos_client
from app.models.workos_session import WorkosSession, create_workos_session, get_refresh_token, refresh_session
from app.schemas.auth_schema import WorkOSAuthDTO

workos = get_workos_client()
logger = logging.getLogger(__name__)

def password_authentication(auth: WorkOSAuthDTO):
    """Authenticate with WorkOS using the password oAuth flow.

    Args:
        auth: app.api.routes.auth.PasswordAuth object containing username, password, host, and user-agent
    Returns:
        A signed access token
    Throws:
        workos.exceptions.BadRequestException - if credentials are not valid
    """
    try:
        workos_auth_response = workos.user_management.authenticate_with_password(
            email=auth.email,
            password=auth.password,
            ip_address=auth.ip_address,
            user_agent=auth.user_agent
        )

        decoded_token = decode_token(workos_auth_response.access_token)

        workos_session = WorkosSession(
            session_id=decoded_token.get('sid'),
            expiration=decoded_token.get('exp'),
            ip_address=auth.ip_address,
            user_agent=auth.user_agent,
            encrypted_refresh_token="",
            encrypted_access_token=""
        )
        workos_session.set_decrypted_access_token(workos_auth_response.access_token)
        workos_session.set_decrypted_refresh_token(workos_auth_response.refresh_token)

        create_workos_session(workos_session)

        return workos_auth_response.access_token

    except workos_exceptions.AuthorizationException as e:
        # Handle the organization selection requirement
        error_str = str(e)
        
        # Check if this is an organization selection issue
        if 'code=organization_selection_required' in error_str:
            logger.info(f"Organization selection required for user: {auth.email}")
            
            # Get the organization ID from environment variable
            organization_id = os.getenv("WORKOS_ORG_ID")
            if not organization_id:
                logger.error("WORKOS_ORG_ID environment variable not set")
                raise ValueError("WORKOS_ORG_ID environment variable not set") from e
            
            # Extract the pending_authentication_token from the exception string
            pending_token_match = re.search(r'pending_authentication_token=([^,\)]+)', error_str)
            if not pending_token_match:
                logger.error(f"Could not extract pending_authentication_token from: {error_str}")
                raise ValueError("Could not extract pending_authentication_token") from e
                
            pending_token = pending_token_match.group(1)
            logger.info(f"Extracted pending_authentication_token: {pending_token}")
            
            # Extract organizations if needed (optional, but could be useful for logging or validation)
            orgs_match = re.search(r'organizations=(\[.*?\])', error_str)
            if orgs_match:
                try:
                    orgs_str = orgs_match.group(1).replace("'", '"')  # Replace single quotes with double quotes for JSON
                    organizations = json.loads(orgs_str)
                    logger.info(f"Available organizations: {organizations}")
                    
                    # Optionally validate that our org_id exists in the available organizations
                    org_ids = [org.get('id') for org in organizations]
                    if organization_id not in org_ids:
                        logger.warning(f"Selected organization ID {organization_id} not in available organizations: {org_ids}")
                except Exception as json_err:
                    logger.warning(f"Could not parse organizations JSON: {json_err}")
            
            # Complete authentication with organization selection
            try:
                logger.info(f"Authenticating with organization selection: org_id={organization_id}, token={pending_token}")
                user_and_organization = workos.user_management.authenticate_with_organization_selection(
                    organization_id=organization_id,
                    pending_authentication_token=pending_token,
                    ip_address=auth.ip_address,
                    user_agent=auth.user_agent
                )
                
                # Process the successful authentication
                decoded_token = decode_token(user_and_organization.access_token)
                
                workos_session = WorkosSession(
                    session_id=decoded_token.get('sid'),
                    expiration=decoded_token.get('exp'),
                    ip_address=auth.ip_address,
                    user_agent=auth.user_agent,
                    encrypted_refresh_token="",
                    encrypted_access_token=""
                )
                workos_session.set_decrypted_access_token(user_and_organization.access_token)
                workos_session.set_decrypted_refresh_token(user_and_organization.refresh_token)
                
                create_workos_session(workos_session)
                
                return user_and_organization.access_token
                
            except Exception as org_select_err:
                logger.exception(f"Error during organization selection: {org_select_err}")
                raise
        else:
            # Not an organization selection issue, re-raise
            raise