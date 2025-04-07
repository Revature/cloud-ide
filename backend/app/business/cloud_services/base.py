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
    async def add_instance_tag(self, instance_id: str, tag: str) -> str:
        """Add a tag to an existing instance."""
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

    @abstractmethod
    async def create_runner_image(self, instance_id: str, image_name: str, image_tags: Optional[list[dict]] = None) -> str:
        """
        Create an AMI from the given instance_id with the given tags.

        image_tags is a list of dictionaries with the tags to be added to the AMI.
        Example: tags = [ {'Key': 'key_name', 'Value': 'example_value'}, {'Key': 'key_name2', 'Value': 'example_value2'} ]
        Returns the AMI ID as a string.
        """
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

    ##############################
    # Security Group Functionality
    ##############################

    @abstractmethod
    async def create_security_group(self, grp_name: str, desc: str) -> str:
        """
        Create a new security group using the provided Description and GroupName.

        Returns the GroupId of the created security group as a string
        """
        pass

    @abstractmethod
    async def delete_security_group(self, group_id: str) -> str:
        """
        Delete the security group with the given GroupId.

        Returns the HTTP status code as a string.
        """
        pass

    @abstractmethod
    async def authorize_security_group_ingress(self, group_id: str, ip: str, port: int = 22) -> str:
        """
        Autorize ingress for a security group on a given port, by a given IP, to a given group.

        IP is in CIDR notation, follwing the format <ip>/<mask>. ie 203.0.113.0/24
        Port is the port to open, default is 22 (SSH).
        Returns the success or failure as a string.
        """
        pass