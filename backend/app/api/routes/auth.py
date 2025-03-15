"""Authorization route for acquiring bearer tokens."""
import os
from workos import WorkOSClient, exceptions
from app.api.authentication import password_authentication
from app.schemas.auth_schema import PasswordAuth, WorkOSAuthDTO
from fastapi import APIRouter, Request, Response, status

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))

router = APIRouter()

@router.post("/", status_code=200)
def machine_auth(request: Request, passwordAuth: PasswordAuth, response: Response):
    """Authenticate with username and password, receive access token in Access-Token header."""
    workos_auth_dto = WorkOSAuthDTO(
        email = passwordAuth.email,
        password = passwordAuth.password,
        ip_address = request.client.host,
        user_agent = request.headers.get("User-Agent")
        )

    try:
        access_token = password_authentication(workos_auth_dto)
        response.headers["Access-Token"] = access_token
        return '{"status": 200}'

    except exceptions.BadRequestException as e:
        return {
            "status": "BadRequestException - failed to authenticate or refresh.",
            "code": status.HTTP_401_UNAUTHORIZED,
            "error": str(e),
            "error_type": type(e).__name__
        }
    except Exception as e:
        # raise HTTPException(status_code=500, detail="Internal Server Error..")
        return {
            "status": "error",
            "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "error": str(e),
            "error_type": type(e).__name__
        }
