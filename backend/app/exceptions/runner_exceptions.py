"""This file contains custom exceptions which may be raised during runner management process."""

class RunnerRetrievalException(Exception):
    """Exception raised for an issue while retrieving a runner."""
    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"
    
class RunnerCreationException(Exception):
    """Exception raised for an issue creating a runner."""
    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"
    
class RunnerDefinitionException(Exception):
    """Exception raised for when a user has supplied an invalid runner."""
    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"
    