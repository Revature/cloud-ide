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

class RunnerLaunchError(Exception):
    """Exception raised when a runner fails to launch."""

    def __init__(self, message, error_type="launch_failed", details=None):
        """
        Construct an exception.

        Args:
            message: Human-readable error message
            error_type: Standardized error type for event system
            details: Additional error details for reporting
        """
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"

class RunnerClaimError(Exception):
    """Exception raised when a runner cannot be claimed for a user."""

    def __init__(self, message, error_type="claim_failed", details=None):
        """
        Construct an exception.

        Args:
            message: Human-readable error message
            error_type: Standardized error type for event system
            details: Additional error details for reporting
        """
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"

class RunnerConnectionError(Exception):
    """Exception raised when a connection to a runner cannot be established."""

    def __init__(self, message, error_type="connection_failed", details=None):
        """
        Construct an exception.

        Args:
            message: Human-readable error message
            error_type: Standardized error type for event system
            details: Additional error details for reporting
        """
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"

class ResourceAllocationError(Exception):
    """Exception raised when resources cannot be allocated for a runner."""

    def __init__(self, message, error_type="allocation_failed", details=None):
        """
        Construct an exception.

        Args:
            message: Human-readable error message
            error_type: Standardized error type for event system
            details: Additional error details for reporting
        """
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"

class SecurityConfigurationError(Exception):
    """Exception raised when security configuration for a runner fails."""

    def __init__(self, message, error_type="security_failed", details=None):
        """
        Construct an exception.

        Args:
            message: Human-readable error message
            error_type: Standardized error type for event system
            details: Additional error details for reporting
        """
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"

class RunnerTimeoutError(Exception):
    """Exception raised when a runner operation times out."""

    def __init__(self, message, error_type="timeout", details=None):
        """
        Construct an exception.

        Args:
            message: Human-readable error message
            error_type: Standardized error type for event system
            details: Additional error details for reporting
        """
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)

    def __str__(self):
        """ToString implementation."""
        return f"{self.message}"
