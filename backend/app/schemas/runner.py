"""Runner schema."""

from pydantic import BaseModel

class ExtendSessionRequest(BaseModel):
    """Request model for the extend_session endpoint."""

    runner_id: int
    extra_time: int  # extra time in minutes
