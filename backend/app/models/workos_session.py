"""Model for workOS sessions, tracks access and refresh tokens."""
from sqlmodel import Field, SQLModel, Text, select, Column, String
from app.business.encryption import decrypt_text, encrypt_text
from app.db.database import get_session
from app.models.mixins import TimestampMixin


class WorkosSession(TimestampMixin, SQLModel, table=True):
    """WorkosSession Model."""

    __tablename__ = "workos_session"

    session_id: str = Field(primary_key=True)
    expiration: int
    ip_address: str
    user_agent: str
    encrypted_refresh_token: str = Field(sa_column=Column("refresh_token", String(255)))
    encrypted_access_token: str = Field(sa_column=Column( "access_token", Text)) #Need to index, can't use index=true with sa_column

    def get_decrypted_refresh_token(self) -> str:
        """Return the decrypted refresh token."""
        if not self.encrypted_refresh_token:
            return ""
        return decrypt_text(self.encrypted_refresh_token)

    def set_decrypted_refresh_token(self, value: str):
        """Encrypt and store the refresh token."""
        if value:
            self.encrypted_refresh_token = encrypt_text(value)
        else:
            self.encrypted_refresh_token = ""

    def get_decrypted_access_token(self) -> str:
        """Return the decrypted authentication token."""
        if not self.encrypted_access_token:
            return ""
        return decrypt_text(self.encrypted_access_token)

    def set_decrypted_access_token(self, value: str):
        """Encrypt and store the authentication token."""
        if value:
            self.encrypted_access_token = encrypt_text(value)
        else:
            self.encrypted_access_token = ""


def create_workos_session(workos_session: WorkosSession):
    """Create a workos_session record in the database."""
    with next(get_session()) as database_session:
        database_session.add(workos_session)
        database_session.commit()


def get_refresh_token(access_token: str):
    """Return a refresh token for an access token."""
    with next(get_session()) as database_session:
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
