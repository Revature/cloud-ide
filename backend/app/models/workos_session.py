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
    encrypted_refresh_token: str = Field(sa_column=Column("refresh_token", Text))
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
