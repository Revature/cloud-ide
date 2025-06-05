"""Controller for code challenge routes."""

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from app.business import code_challenge_service as service
from app.models.code_challenge import CodeChallenge, CodeChallengeTest

router = APIRouter()

class ChallengeTestDto(BaseModel):
    """DTO for describing code challenges in web requests."""
    test_order: int
    pass_value: str
    test_case: str
    description: str

class CodeChallengeDto(BaseModel):
    """DTO for describing test cases in web requests."""
    name: str
    type: str
    description: str
    main_file: str
    challenge_stub: str
    llm_prompt: str
    tests: list[ChallengeTestDto]


def parse_code_challenge_dto(dto: CodeChallengeDto) -> CodeChallenge:
    """Convert a CodeChallengeDto into a CodeChallenge model."""
    
    return CodeChallenge(**dto.model_dump)

def parse_tests_list(tests_list: list[ChallengeTestDto]) -> list[CodeChallengeTest]:
    """Convert a list of ChallengeTestDto into a list of CodeChallengeTest."""
    
    tests: list[CodeChallengeTest] = []
    for test in tests_list:
        tests.append(CodeChallengeTest(**test.model_dump()))
    return tests

@router.get('/{code_challenge_id}', response_model=CodeChallenge, status_code=200)
def get_challenge(code_challenge_id: int):
    """Get a code challenge by ID."""
    return service.find_challenge_by_id(code_challenge_id)

@router.post('/', response_model=CodeChallenge, status_code=200)
def post_challenge(body: CodeChallengeDto):
    """Post a new code challenge."""
    return service.create_challenge(
        code_challenge=parse_code_challenge_dto(body), 
        tests=parse_tests_list(body.tests))

@router.put('/', response_model=CodeChallenge, status_code=200)
def put_challenge(body: CodeChallengeDto):
    """Update an existing code challenge."""
    return service.update_challenge(
        code_challenge=parse_code_challenge_dto(body),
        tests=parse_tests_list(body.tests)
    )

@router.delete('/{code_challenge_id}')
def delete_challenge(code_challenge_id: int):
    """Delete a code challenge."""
    service.delete_challenge(code_challenge_id)
    return Response(
            status_code=status.HTTP_200_OK,
            content='{"response": "Code Challenge Deleted"}'
        )
