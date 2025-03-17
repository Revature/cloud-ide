# app/business/cloud_services/base.py
"""Abstract base class for cloud provider services."""

from abc import ABC, abstractmethod
from typing import Any, Optional

class CloudService(ABC):
    """Abstract base class for cloud provider services."""

    def __init__(self, connector):
        """Initialize with a cloud connector model."""
        self.connector = connector
        self.region = connector.region

    ###################
    # Keypair Functionality
    ###################

    @abstractmethod
    async def create_keypair(self, key_name: str) -> dict[str, str]:
        """Create a new keypair and return its details."""
        pass

    @abstractmethod
    async def delete_keypair(self, key_id: str) -> str:
        """Delete a keypair by its ID."""
        pass

    @abstractmethod
    async def get_keypair_id(self, key_name: str) -> str:
        """Get a keypair ID by name."""
        pass

    @abstractmethod
    async def get_keypair_name(self, key_id: str) -> str:
        """Get a keypair name by ID."""
        pass

    ###################
    # EC2 Functionality
    ###################

    @abstractmethod
    async def create_instance(self,
                             key_name: str,
                             image_id: str,
                             instance_type: str,
                             instance_count: int = 1,
                             security_groups: Optional[list[str]] = None) -> str:
        """Create a new instance/VM and return its ID."""
        pass

    @abstractmethod
    async def get_instance_ip(self, instance_id: str) -> str:
        """Get the public IP address of an instance."""
        pass

    @abstractmethod
    async def get_instance_state(self, instance_id: str) -> str:
        """Get the current state of an instance."""
        pass

    @abstractmethod
    async def stop_instance(self, instance_id: str) -> str:
        """Stop an instance and return its state."""
        pass

    @abstractmethod
    async def start_instance(self, instance_id: str) -> str:
        """Start an instance and return its state."""
        pass

    @abstractmethod
    async def terminate_instance(self, instance_id: str) -> str:
        """Terminate/delete an instance and return its state."""
        pass

    @abstractmethod
    async def wait_for_instance_running(self, instance_id: str):
        """Wait for an instance to be in the running state."""
        pass

    ###################
    # S3 Functionality
    ###################

    @abstractmethod
    async def create_s3_bucket(self, bucket_name: str) -> str:
        """Create a new storage bucket."""
        pass

    @abstractmethod
    async def delete_s3_bucket(self, bucket_name: str) -> str:
        """Delete a storage bucket."""
        pass

    @abstractmethod
    async def list_s3_buckets(self) -> list[str]:
        """List all storage buckets."""
        pass

    @abstractmethod
    async def list_s3_objects(self, bucket_name: str) -> list[str]:
        """List all objects in a storage bucket."""
        pass

    @abstractmethod
    async def put_s3_object(self, bucket_name: str, object_name: str, object_data: Any) -> str:
        """Upload an object to a storage bucket."""
        pass

    @abstractmethod
    async def get_s3_object(self, bucket_name: str, object_name: str) -> Any:
        """Download an object from a storage bucket."""
        pass

    @abstractmethod
    async def delete_s3_objects(self, bucket_name: str, object_names: list[str]) -> str:
        """Delete objects from a storage bucket."""
        pass

    ###################
    # SSH Functionality
    ###################

    @abstractmethod
    async def ssh_run_script(self, ip: str, key: str, script: str, username: str = 'ubuntu') -> dict[str, str]:
        """Run a script on a remote instance via SSH."""
        pass
