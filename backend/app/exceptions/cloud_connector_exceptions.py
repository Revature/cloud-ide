"""This module defines custom exceptions for cloud connector errors."""

class CloudConnectorError(Exception):
    """Base exception for cloud connector errors."""

    pass

class AuthenticationError(CloudConnectorError):
    """Raised when credentials are invalid."""

    def __init__(self, message, denied_actions=None):
        """Construct an exception."""
        self.message = message
        self.denied_actions = denied_actions or []
        super().__init__(message)

class PermissionError(CloudConnectorError):
    """Raised when credentials are valid but permissions are insufficient."""

    def __init__(self, message, denied_actions=None):
        """Construct an exception."""
        self.message = message
        self.denied_actions = denied_actions or []
        super().__init__(message)

class ConfigurationError(CloudConnectorError):
    """Raised when there's an issue with the cloud connector configuration."""

    def __init__(self, message, denied_actions=None):
        """Construct an exception."""
        self.message = message
        self.denied_actions = denied_actions or []
        super().__init__(message)
