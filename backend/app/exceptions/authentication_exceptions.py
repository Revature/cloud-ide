"""This file contains custom exceptions which may be raised during the PKCE key caching process."""

class NoMatchingKeyException(Exception):
    """Exception raised for no matching keys in the cache."""

    def __init__(self, message):
        """Construct an exception."""
        self.message = message
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"

class BadRefreshException(Exception):
    """Exception raised for no matching keys in the cache."""

    def __init__(self, message):
        """Construct an exception."""
        self.message = message
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"

class NoRefreshSessionFound(Exception):
    """Exception raised for no matching keys in the cache."""

    def __init__(self, message):
        """Construct an exception."""
        self.message = message
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"
