"""repository for persisting code challenges, tests, and solutions."""

from sqlmodel import Session, select
from app.models.code_challenge import CodeChallenge, CodeChallengeTest
from app.db.database import engine


def get_challenge_by_id(id: int) -> CodeChallenge:
    """Get a code challenge by id."""
    with Session(engine) as session:
        return session.get(CodeChallenge, id)

def create_challenge(code_challenge: CodeChallenge) -> CodeChallenge:
    """Persist a new code challenge."""
    with Session(engine) as session:
        session.add(code_challenge)
        session.commit()
        session.refresh(code_challenge)
        return code_challenge

def update_challenge(code_challenge: CodeChallenge) -> CodeChallenge:
    """Persist changes to a code challenge."""
    with Session(engine) as session:
        challenge = session.get(CodeChallenge, code_challenge.id)
        challenge.sqlmodel_update(code_challenge.model_dump(exclude_unset=True))
        session.commit()
        session.refresh(challenge)
        return challenge

def delete_challenge(id: int):
    """Remove a code challenge record from the database by id."""
    with Session(engine) as session:
        challenge = session.get(CodeChallenge, id)
        session.delete(challenge)
        session.commit()

def get_test_by_id(id: int) -> CodeChallengeTest:
    """Get a code challenge test case by id."""
    with Session(engine) as session:
        return session.get(CodeChallengeTest, id)

def get_tests_for_challenge(challenge: int | CodeChallenge) -> list[CodeChallengeTest]:
    """Get all test cases associated with a code challenge."""
    if(type(challenge) is int):
        challenge = challenge.id

    with Session(engine) as session:
        statement = select(CodeChallengeTest).where(CodeChallengeTest.challenge_id == challenge)
        return session.exec(statement).all()

def create_test(test: CodeChallengeTest) -> CodeChallengeTest:
    """Persist a new test case associated with a code challenge."""
    with Session(engine) as session:
        session.add(test)
        session.commit()
        session.refresh(test)
        return test

def batch_create_tests(tests: list[CodeChallengeTest]):
    """Persist a number of test cases already associated with a code challenge."""
    with Session(engine) as session:
        for test in tests:
            session.add(test)
        session.commit()

def update_test(test: CodeChallengeTest) -> CodeChallengeTest:
    """Persist changes to a number of test cases."""
    with Session(engine) as session:
        test = session.get(CodeChallengeTest, test.id)
        test.sqlmodel_update(test.model_dump(exclude_unset=True))
        session.commit()
        session.refresh(test)
        return test
