# app/repositories/security_group.py
"""Repository layer for the SecurityGroup entity."""
from app.models.security_group import SecurityGroup
from sqlmodel import Session, select

def add_security_group(session: Session, new_security_group: SecurityGroup) -> SecurityGroup:
    """Add a new security group, flush to retrieve ID."""
    session.add(new_security_group)
    session.flush()
    session.refresh(new_security_group)
    return new_security_group

def find_all_security_groups(session: Session) -> list[SecurityGroup]:
    """Retrieve all security groups."""
    statement = select(SecurityGroup)
    return session.exec(statement).all()

def find_security_group_by_id(session: Session, id: int) -> SecurityGroup:
    """Retrieve the security group by its ID."""
    statement = select(SecurityGroup).where(SecurityGroup.id == id)
    return session.exec(statement).first()

def find_security_group_by_name(session: Session, name: str) -> SecurityGroup:
    """Retrieve the security group by its name."""
    statement = select(SecurityGroup).where(SecurityGroup.name == name)
    return session.exec(statement).first()

def find_security_groups_by_cloud_connector_id(session: Session, cloud_connector_id: int) -> list[SecurityGroup]:
    """Retrieve all security groups for a specific cloud connector."""
    statement = select(SecurityGroup).where(SecurityGroup.cloud_connector_id == cloud_connector_id)
    return session.exec(statement).all()

def find_security_group_by_cloud_group_id(session: Session, cloud_group_id: str) -> SecurityGroup:
    """Retrieve the security group by its cloud group ID."""
    statement = select(SecurityGroup).where(SecurityGroup.cloud_group_id == cloud_group_id)
    return session.exec(statement).first()

def update_security_group(session: Session, security_group: SecurityGroup) -> SecurityGroup:
    """Update an existing security group."""
    session.add(security_group)
    session.commit()
    session.refresh(security_group)
    return security_group

def delete_security_group(session: Session, security_group: SecurityGroup) -> None:
    """Delete a security group."""
    session.delete(security_group)
    session.commit()
