from backend.app.models import CloudConnector
from sqlmodel import Session, Select, select

def find_cloud_connector_by_id(session:Session, id:str) -> Image:
    statement: Select[CloudConnector] = select(CloudConnector).where(CloudConnector.id == id).first()
    return session.exec(statement)