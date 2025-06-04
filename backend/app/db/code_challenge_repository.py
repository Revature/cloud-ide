"""repository for persisting code challenges, tests, and solutions."""

from sqlmodel import Session
from app.models.code_challenge import CodeChallenge
from app.db.database import engine


def get_challenge_by_id(id: int) -> CodeChallenge:
    with Session(engine) as session:
        return session.get(CodeChallenge, id)

def create_challenge(code_challenge: CodeChallenge) -> CodeChallenge:
    with Session(engine) as session:
        session.add(code_challenge)
        session.commit()
        session.refresh(code_challenge)
        return code_challenge

def update_challenge(code_challenge: CodeChallenge) -> CodeChallenge:
    with Session(engine) as session:
        challenge = session.get(CodeChallenge, code_challenge.id)
        challenge.sqlmodel_update(code_challenge.model_dump(exclude_unset=True))
        session.commit()
        session.refresh(challenge)
        return challenge

def delete_challenge(id: int):
    with Session(engine) as session:
        challenge = session.get(CodeChallenge, id)
        session.delete(challenge)
        session.commit()
