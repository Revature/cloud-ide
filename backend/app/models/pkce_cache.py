"""Model for PKCE keys to cache them in the db."""

from sqlmodel import Field, SQLModel, Session, Text, select, Column
from app.db.database import engine
from app.models.mixins import TimestampMixin
from app.exceptions.authentication_exceptions import NoMatchingKeyException


class PKCESet(TimestampMixin, SQLModel, table=True):
    """PKCE key set Model."""

    __tablename__ = "pkce_cache"

    kid: str = Field(default=None, primary_key=True)
    key: str = Field(sa_column=Column("key", Text))


def store_key_set(kid: str, key: str):
    """Store a key set in the cache."""
    with Session(engine) as session:
        record = session.exec(select(PKCESet)
            .where(PKCESet.kid == kid))
        if not record.first():
            session.add(PKCESet(kid = kid, key = key))
            session.commit()
        session.close()

def get_key_set(kid: str):
    """Retrieve a key set from the cache."""
    with Session(engine) as session:
        record: PKCESet = session.exec(select(PKCESet)
            .where(PKCESet.kid == kid)).first()
        if not record:
            raise NoMatchingKeyException("Key not found in database")
        return record.key
