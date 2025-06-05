"""Module for defining code challenge models."""

from sqlmodel import Field, SQLModel
from app.models.mixins import TimestampMixin


class CodeChallenge(TimestampMixin, SQLModel, table=True):
    """Challenge model, represents a code challenge template."""

    __tablename__ = "code_challenge"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    type: str
    description: str
    main_file: str
    challenge_stub: str
    llm_prompt: str

class CodeChallengeSolution(TimestampMixin, SQLModel, table=True):
    """Challenge Solution model, represents a user's attempt to solve a Challenge."""

    __tablename__ = "code_challenge_solution"

    id: int | None = Field(default=None, primary_key=True)
    challenge_id: int = Field(default=None, foreign_key="code_challenge.id")
    user_id: int = Field(default=None, foreign_key="user.id")
    bucket_arn: str

class CodeChallengeTest(TimestampMixin, SQLModel, table=True):
    """Challenge Test Case model, represents many test cases for one challenge."""

    __tablename__ = "code_challenge_test"

    id: int | None = Field(default=None, primary_key=True)
    challenge_id: int = Field(default=None, foreign_key="code_challenge.id")
    test_order: int
    pass_value: str
    test_case: str
    description: str
