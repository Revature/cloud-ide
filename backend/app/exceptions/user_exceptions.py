"""This file contains custom exceptions which may be raised during user processes."""


class EmailInUseException(Exception):
    """Exception raised when a new user is being created with an email already in use."""

    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"

class NoSuchRoleException(Exception):
    """Exception raised when a requested role is not found in the database."""

    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"
