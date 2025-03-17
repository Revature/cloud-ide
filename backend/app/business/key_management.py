# app/business/key_management.py
"""Module for managing daily key pairs."""

from datetime import date, datetime
from sqlmodel import Session, select
from app.db.database import engine
from app.models.key import Key
from app.models.cloud_connector import CloudConnector
from app.business.cloud_services.factory import get_cloud_service
from app.business.encryption import encrypt_text, decrypt_text
import os

async def get_daily_key(cloud_connector_id: int) -> Key:
    """
    Check if a key already exists for today's date.

    If it exists, returns the key record.
    If not, generates a new keypair via AWS, encrypts the private key material,
    saves the key record to the database, and returns it.
    """
    today = date.today()

    # Check if today's key exists in the database.
    with Session(engine) as session:
        stmt = select(Key).where(Key.key_date == today)
        key_record = session.exec(stmt).first()
        cloud_connector = session.get(CloudConnector, cloud_connector_id)
        if not cloud_connector:
            raise Exception("Cloud connector not found")

        cloud_service = get_cloud_service(cloud_connector)

        if key_record:
            return key_record

    # Define the key name (e.g., "Keypair-YYYY-MM-DD")
    key_name = f"Keypair-{today.strftime('%Y-%m-%d')}-{os.getenv('KEY_TAG', 'ashoka-testing-key')}"

    try:
        # Attempt to create a new keypair with the key_name.
        new_keypair = await cloud_service.create_keypair(key_name)
    except Exception as e:
        # If the error indicates a duplicate, re-check the database.
        if "Duplicate" in str(e):
            with Session(engine) as session:
                stmt = select(Key).where(Key.key_date == today)
                key_record = session.exec(stmt).first()
                if key_record:
                    return key_record
            raise Exception(f"Key pair already exists in AWS but no record found in DB: {e}") from None
        else:
            raise Exception(f"Failed to create new key pair: {e}") from None

    if not isinstance(new_keypair, dict):
        raise Exception(f"Failed to create new key pair: {new_keypair}")

    # Encrypt the private key material using a master encryption key.
    encrypted_material = encrypt_text(new_keypair['PrimaryKey'])

    # Save the new key record to the database.
    with Session(engine) as session:
        key_record = Key(
            key_date=today,
            key_pair_id=new_keypair['KeyPairId'],
            key_name=key_name,
            cloud_connector_id=cloud_connector_id,
            encrypted_key=encrypted_material,
            created_on=datetime.utcnow(),
            updated_on=datetime.utcnow()
        )
        session.add(key_record)
        session.commit()
        session.refresh(key_record)
        return key_record

def get_key_by_id(key_id: int) -> Key:
    """
    Retrieve the Key record from the database given its key_id.

    Raises an exception if the key is not found.
    """
    with Session(engine) as session:
        stmt = select(Key).where(Key.id == key_id)
        key_record = session.exec(stmt).first()
        if key_record is None:
            raise Exception(f"Key record with id {key_id} not found.")
        return key_record
