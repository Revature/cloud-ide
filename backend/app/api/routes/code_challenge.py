"""Controller for code challenge routes."""

from typing import List
from fastapi import APIRouter
from pydantic import BaseModel
from app.business import code_challenge as service
from app.models.code_challenge import CodeChallenge

router = APIRouter()

class ChallengeTestDto(BaseModel):
    pass_value: str
    test_case: str

class CodeChallengeDto(BaseModel):
    name: str
    type: str
    description: str
    main_file: str
    challenge_stub: str
    tests: List[ChallengeTestDto]
    llm_prompt: str


@router.post('/')
def post_new_challenge(body: CodeChallengeDto):
    # for test in body.tests:
        
    
    code_challenge = CodeChallenge(**body.model_dump())

    code_challenge = service.create_challenge(code_challenge=code_challenge)