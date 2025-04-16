"""This file contains custom exceptions which may be raised during authentication processes."""

class InvalidSealedSessionException(Exception):
    """Exception raised when a workos sealed sealed session cannot be authenticated or refreshed."""

    def __init__(self, message):
        """Construct an exception."""
        self.message = message
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"
