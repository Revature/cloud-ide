"""Code Challenge service."""

from app.db import code_challenge_repository as repo
from app.api.routes.code_challenge import ChallengeTestDto, CodeChallengeDto
from app.models.code_challenge import CodeChallenge, CodeChallengeTest

def find_challenge_by_id(id: int) -> CodeChallenge:
    """Get a code challenge ."""
    return repo.get_challenge_by_id(id)


def create_challenge(code_challenge: CodeChallenge, tests: list[CodeChallengeTest]) -> CodeChallenge:
    """Create a code challenge, and persist it in the database along with tests."""

    code_challenge = repo.create_challenge(code_challenge=code_challenge)
    
    for test in tests:
        test.challenge_id = code_challenge.id
    repo.batch_create_tests(tests)

    return code_challenge

def update_challenge(code_challenge: CodeChallenge, tests: list[CodeChallengeTest]) -> CodeChallenge:
    """Modify an existing code challenge."""
    return repo.update_challenge(code_challenge=code_challenge)

def delete_challenge(id: int):
    """Delete a challenge from the database."""
    repo.delete_challenge(id)
