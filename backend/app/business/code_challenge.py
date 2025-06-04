"""Code Challenge service."""

from app.db import code_challenge_repository as repo
from app.models.code_challenge import CodeChallenge

def find_challenge_by_id(id: int) -> CodeChallenge:
    return repo.get_challenge_by_id(id)


def create_challenge(code_challenge: CodeChallenge, tests: dict[str, str]) -> CodeChallenge:
    """Create a code challenge, and persist it in the database."""

    return repo.create_challenge(code_challenge=code_challenge)

def update_challenge(code_challenge: CodeChallenge) -> CodeChallenge:
    """Modify an existing code challenge."""

    return repo.update_challenge(code_challenge=code_challenge)

def delete_challenge(id: int):
    """Delete a challenge from the database."""

    repo.delete_challenge(id)
