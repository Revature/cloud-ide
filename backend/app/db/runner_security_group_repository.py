# app/repositories/runner_security_group.py
"""Repository layer for the RunnerSecurityGroup entity."""
from app.models.runner_security_group import RunnerSecurityGroup
from app.models.security_group import SecurityGroup
from sqlmodel import Session, select

def add_runner_security_group(session: Session, runner_id: int, security_group_id: int) -> RunnerSecurityGroup:
    """Associate a runner with a security group."""
    runner_security_group = RunnerSecurityGroup(
        runner_id=runner_id,
        security_group_id=security_group_id
    )
    session.add(runner_security_group)
    session.flush()
    return runner_security_group

def find_security_groups_by_runner_id(session: Session, runner_id: int) -> list[SecurityGroup]:
    """Find all security groups associated with a specific runner."""
    statement = select(SecurityGroup).join(
        RunnerSecurityGroup,
        RunnerSecurityGroup.security_group_id == SecurityGroup.id
    ).where(RunnerSecurityGroup.runner_id == runner_id)
    return session.exec(statement).all()

def find_runners_by_security_group_id(session: Session, security_group_id: int) -> list[int]:
    """Find all runner IDs associated with a specific security group."""
    statement = select(RunnerSecurityGroup.runner_id).where(
        RunnerSecurityGroup.security_group_id == security_group_id
    )
    return session.exec(statement).all()

def delete_runner_security_group(session: Session, runner_id: int, security_group_id: int) -> None:
    """Remove the association between a runner and a security group."""
    statement = select(RunnerSecurityGroup).where(
        RunnerSecurityGroup.runner_id == runner_id,
        RunnerSecurityGroup.security_group_id == security_group_id
    )
    runner_security_group = session.exec(statement).first()
    if runner_security_group:
        session.delete(runner_security_group)
        session.flush()

def delete_all_runner_security_groups(session: Session, runner_id: int) -> None:
    """Remove all security group associations for a specific runner."""
    statement = select(RunnerSecurityGroup).where(
        RunnerSecurityGroup.runner_id == runner_id
    )
    runner_security_groups = session.exec(statement).all()
    for runner_security_group in runner_security_groups:
        session.delete(runner_security_group)
    session.flush()
