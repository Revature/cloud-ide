# app/repositories/security_group.py
"""Repository layer for the SecurityGroup entity."""
from app.models.security_group import SecurityGroup
from sqlmodel import Session, select
from app.db.database import engine

def add_security_group(new_security_group: SecurityGroup) -> SecurityGroup:
    """Add a new security group, flush to retrieve ID."""
    with Session(engine) as session:
        session.add(new_security_group)
        session.commit()
        session.refresh(new_security_group)
        return new_security_group

def find_all_security_groups() -> list[SecurityGroup]:
    """Retrieve all security groups."""
    with Session(engine) as session:
        statement = select(SecurityGroup)
        return session.exec(statement).all()

def find_security_group_by_id(id: int) -> SecurityGroup:
    """Retrieve the security group by its ID."""
    with Session(engine) as session:
        statement = select(SecurityGroup).where(SecurityGroup.id == id)
        return session.exec(statement).first()

def find_security_group_by_name(name: str) -> SecurityGroup:
    """Retrieve the security group by its name."""
    with Session(engine) as session:
        statement = select(SecurityGroup).where(SecurityGroup.name == name)
        return session.exec(statement).first()

def find_security_groups_by_cloud_connector_id(cloud_connector_id: int) -> list[SecurityGroup]:
    """Retrieve all security groups for a specific cloud connector."""
    with Session(engine) as session:
        statement = select(SecurityGroup).where(SecurityGroup.cloud_connector_id == cloud_connector_id)
        return session.exec(statement).all()

def find_security_group_by_cloud_group_id(cloud_group_id: str) -> SecurityGroup:
    """Retrieve the security group by its cloud group ID."""
    with Session(engine) as session:
        statement = select(SecurityGroup).where(SecurityGroup.cloud_group_id == cloud_group_id)
        return session.exec(statement).first()

def update_security_group(security_group: SecurityGroup) -> SecurityGroup:
    """Update an existing security group."""
    with Session(engine) as session:
        session.add(security_group)
        session.commit()
        session.refresh(security_group)
        return security_group

def delete_security_group(security_group: SecurityGroup) -> None:
    """Delete a security group."""
    with Session(engine) as session:
        session.delete(security_group)
        session.commit()
