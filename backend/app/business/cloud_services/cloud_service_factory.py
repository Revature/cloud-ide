# app/business/cloud_services/factory.py
"""Factory for creating cloud services."""

from app.business.cloud_services.base import CloudService
from app.business.cloud_services.aws import AWSCloudService

# Registry of cloud services
CLOUD_SERVICES: dict[str, type[CloudService]] = {
    "aws": AWSCloudService,
    # Add more providers as they are implemented
    # "azure": AzureCloudService,
    # "gcp": GCPCloudService,
}

def get_cloud_service(connector) -> CloudService:
    """
    Get a cloud service instance for the given connector.

    Args:
        connector: A CloudConnector model instance

    Returns:
        An instance of the appropriate CloudService implementation

    Raises:
        ValueError: If the connector's provider is not supported
    """
    service_class = CLOUD_SERVICES.get(connector.provider.lower())
    if not service_class:
        supported = ", ".join(CLOUD_SERVICES.keys())
        raise ValueError(
            f"Unsupported cloud provider '{connector.provider}'. "
            f"Supported providers are: {supported}"
        )

    return service_class(connector)
