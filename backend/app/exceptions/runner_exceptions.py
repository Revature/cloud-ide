"""This file contains custom exceptions which may be raised during runner management process."""

class RunnerRetrievalException(Exception):
    """Exception raised for an issue while retrieving a runner."""

    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"

class RunnerExecException(Exception):
    """Exception raised for an issue that prevents the normal flow of the Runner lifecycle."""

    def __init__(self, message):
        """Construct an exception."""
        self.message = message
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"

class RunnerDefinitionException(Exception):
    """Exception raised for when a user has supplied an invalid runner."""

    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"

class ScriptExecutionException(Exception):
    """Exception raised for when a script fails to execute."""

    def __init__(self, message):
        """Construct an exception."""
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message})"
