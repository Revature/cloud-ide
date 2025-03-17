"""Model for PKCE keys to cache them in the db."""

from sqlmodel import Field, SQLModel, Text, select, Column, String
from app.business.encryption import decrypt_text, encrypt_text
from app.db.database import get_session
from app.models.mixins import TimestampMixin

class PKCE(SQLModel, table=True):
    """PKCE Model for caching key sets."""

    __tablename__ = "pkce_cache"

    kid: str = Field(default=None, primary_key=True)
    alg: str
    kty: str
    use: str
    n: str
    e: str
    x5tHashS256: str

class X5CertificateChain(SQLModel, table=True):
    """Lookup table for x5c arrays.

    X5 certificate chains. These are x5 certificates associated with PKCE key sets. One-to-many key sets to certificates.
    """

    __tablename__ = "pkce_certs"

    id: int = Field(default=None, primary_key=True)
    fk_pkce_id: str = Field(foreign_key="pkce_cache.kid")
    x5c: str

def cache_new_key_set(key_set):
    """Store a key set in the database."""
    with(next(get_session())) as session:
        pkce = PKCE(
            kid = key_set["kid"],
            alg = key_set["alg"],
            kty = key_set["kty"],
            use = key_set["use"],
            n = key_set["n"],
            e = key_set["e"],
            x5tHashS256 = key_set["x5t#S256"]
        )

        record = session.exec(select(PKCE)
            .where(PKCE.kid == pkce.kid))

        if not record.first():
            session.add(pkce)
            session.commit()
            session.refresh(pkce)

            for x5c in key_set["x5c"]:
                cert = X5CertificateChain(
                    fk_pkce_id = pkce.kid,
                    x5c = x5c
                )
                session.add(cert)
                session.commit()
    session.close()
