"""Repository for workos_session database access."""
from sqlmodel import select
from app.business.encryption import encrypt_text
from app.db.database import get_session
from app.models.workos_session import WorkosSession


def create_workos_session(workos_session: WorkosSession):
    """Create a workos_session record in the database."""
    with next(get_session()) as database_session:
        database_session.add(workos_session)
        database_session.commit()


def get_refresh_token(access_token: str):
    """Return a refresh token for an access token."""
    with next(get_session()) as database_session:
        encrypted_access_token = encrypt_text(access_token)
        record: WorkosSession = database_session.exec(select(WorkosSession)
            .where(WorkosSession.encrypted_access_token == encrypt_text(access_token))).first()
        if not record:
            raise Exception("Session not found")
        return record.get_decrypted_refresh_token()


def refresh_session(old_access_token: str, access_token: str, refresh_token: str):
    """Update a session with new access and refresh tokens."""
    with next(get_session()) as database_session:
        record: WorkosSession = database_session.exec(select(WorkosSession)
            .where(WorkosSession.encrypted_access_token == encrypt_text(old_access_token))).first()
        if not record:
            raise Exception("Session not found")
        record.set_decrypted_access_token(access_token)
        record.set_decrypted_refresh_token(refresh_token)
        database_session.add(record)
        database_session.commit()
