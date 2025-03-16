"""Module for defining the CloudConnector model."""

from sqlmodel import SQLModel, Field
from typing import Optional
from app.models.mixins import TimestampMixin
from app.business.encryption import encrypt_text, decrypt_text
from sqlalchemy import Column, String

class CloudConnector(TimestampMixin, SQLModel, table=True):
    """
    Model representing a cloud connector with encrypted credentials.

    Provides methods for securely storing and retrieving cloud provider credentials.
    """

    __tablename__ = "cloud_connector"  # Ensure table name matches foreign keys elsewhere

    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str = Field(index=True, description="Cloud provider type (aws, azure, gcp, etc.)")
    region: str = Field(default="us-west-2", description="Default region for this connector")

    # Underlying encrypted fields stored in DB columns "access_key" and "secret_key"
    encrypted_access_key: str = Field(sa_column=Column("access_key", String(255)), default="")
    encrypted_secret_key: str = Field(sa_column=Column("secret_key", String(255)), default="")

    def get_decrypted_access_key(self) -> str:
        """Return the decrypted access key."""
        if not self.encrypted_access_key:
            return ""
        return decrypt_text(self.encrypted_access_key)

    def set_decrypted_access_key(self, value: str):
        """Encrypt and store the access key."""
        if value:
            self.encrypted_access_key = encrypt_text(value)
        else:
            self.encrypted_access_key = ""

    def get_decrypted_secret_key(self) -> str:
        """Return the decrypted secret key."""
        if not self.encrypted_secret_key:
            return ""
        return decrypt_text(self.encrypted_secret_key)

    def set_decrypted_secret_key(self, value: str):
        """Encrypt and store the secret key."""
        if value:
            self.encrypted_secret_key = encrypt_text(value)
        else:
            self.encrypted_secret_key = ""

    class Config:
        """Pydantic model configuration."""

        # Exclude these methods from serialization
        extra = 'ignore'
        # Ignored method fields
        ignored_types = (property, classmethod, staticmethod)
