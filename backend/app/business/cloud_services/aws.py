# app/business/cloud_services/aws_service.py
"""AWS implementation of the CloudService interface."""

import os
import boto3
import paramiko
import re
import logging
from io import StringIO
from app.business.cloud_services.base import CloudService
from typing import Any, Optional

logger = logging.getLogger(__name__)

class AWSCloudService(CloudService):
    """AWS implementation of the CloudService interface."""

    def __init__(self, connector):
        """Initialize with AWS credentials from the cloud connector."""
        super().__init__(connector)
        self.ec2_client = boto3.client(
            'ec2',
            aws_access_key_id=connector.get_decrypted_access_key(),
            aws_secret_access_key=connector.get_decrypted_secret_key(),
            region_name=connector.region
        )
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=connector.get_decrypted_access_key(),
            aws_secret_access_key=connector.get_decrypted_secret_key(),
            region_name=connector.region
        )
        self.sts_client = boto3.client(
            'sts',
            aws_access_key_id=connector.get_decrypted_access_key(),
            aws_secret_access_key=connector.get_decrypted_secret_key(),
            region_name=connector.region
        )
        self.iam_client = boto3.client(
            'iam',
            aws_access_key_id=connector.get_decrypted_access_key(),
            aws_secret_access_key=connector.get_decrypted_secret_key(),
            region_name=connector.region
        )

    ########################
    # Account Functionality
    ########################

    async def validate_account(self) -> dict:
        """
        Verify the AWS account by performing dry runs of required operations.

        Returns:
            dict: Status information including success/failure and denied actions
        """
        try:
            denied_actions = []

            # First verify basic credentials with STS
            try:
                self.sts_client.get_caller_identity()
            except Exception as e:
                error_message = str(e)
                print(f"STS validation failed: {error_message}")
                # Add more debug information
                print("Returning failed status due to STS validation failure")
                return {
                    "status": "failed",
                    "denied_actions": ["sts:GetCallerIdentity"],
                    "message": f"Invalid AWS credentials: {error_message}"
                }

            # If we reach here, STS validation succeeded
            print("STS validation succeeded, continuing with permission checks")

            # Define operations to test with dry run
            operations = [
                # EC2 Instance Operations
                {
                    "service": self.ec2_client,
                    "method": "run_instances",
                    "args": {
                        "DryRun": True,
                        "ImageId": "ami-12345678",  # Dummy ID
                        "InstanceType": "t2.micro",
                        "MinCount": 1,
                        "MaxCount": 1,
                        "KeyName": "dummy-key-name"
                    },
                    "action": "ec2:RunInstances"
                },
                {
                    "service": self.ec2_client,
                    "method": "describe_instances",
                    "args": {"DryRun": True, "MaxResults": 5},
                    "action": "ec2:DescribeInstances"
                },
                {
                    "service": self.ec2_client,
                    "method": "terminate_instances",
                    "args": {"DryRun": True, "InstanceIds": ["i-12345678"]},
                    "action": "ec2:TerminateInstances"
                },
                # KeyPair Operations
                {
                    "service": self.ec2_client,
                    "method": "create_key_pair",
                    "args": {"DryRun": True, "KeyName": "dummy-key-name"},
                    "action": "ec2:CreateKeyPair"
                },
                {
                    "service": self.ec2_client,
                    "method": "describe_key_pairs",
                    "args": {"DryRun": True},
                    "action": "ec2:DescribeKeyPairs"
                },
                # Security Group Operations
                {
                    "service": self.ec2_client,
                    "method": "create_security_group",
                    "args": {
                        "DryRun": True,
                        "GroupName": "dummy-sg-name",
                        "Description": "Dummy security group for testing"
                    },
                    "action": "ec2:CreateSecurityGroup"
                }
            ]

            # Test each operation
            for op in operations:
                try:
                    method = getattr(op["service"], op["method"])
                    method(**op["args"])
                except Exception as e:
                    error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                    error_msg = str(e)
                    print(f"Testing {op['action']}: Error code: {error_code}, Message: {error_msg}")

                    # Only DryRunOperation error means success (we have permission)
                    if error_code == "DryRunOperation":
                        # This is a success - we have permission
                        print(f"{op['action']} permission confirmed")
                    else:
                        # Check for auth-related errors first (these are critical failures)
                        auth_error = any(err in error_code.lower() or err in error_msg.lower() for err in [
                            "unauthorized", "accessdenied", "authfailure", "invalidclienttokenid",
                            "signaturenotmatch", "authorizationfailure"
                        ])

                        if auth_error:
                            print(f"{op['action']} authentication failed: {error_code}")
                            # Exit early on authentication errors
                            return {
                                "status": "failed",
                                "denied_actions": [op["action"]],
                                "message": f"Authentication failed: {error_msg}"
                            }

                        # Now check for resource-not-found errors (these are OK)
                        resource_not_found = any(phrase in error_msg.lower() for phrase in [
                            "notfound", "not found", "does not exist", "nonexistent"
                        ])

                        if resource_not_found:
                            print(f"{op['action']} resource not found, but permission is likely OK")
                        else:
                            print(f"{op['action']} permission denied: {error_code}")
                            denied_actions.append(op["action"])

            # S3 Operations (no dry run support)
            try:
                self.s3_client.list_buckets()
            except Exception as e:
                error_msg = str(e).lower()
                # Check for auth errors specifically
                if any(err in error_msg for err in ["unauthorized", "accessdenied", "authfailure",
                                                "invalidclienttokenid", "signaturenotmatch"]):
                    return {
                        "status": "failed",
                        "denied_actions": ["s3:ListBuckets"],
                        "message": f"Authentication failed for S3: {e!s}"
                    }
                denied_actions.append("s3:ListBuckets")

            # Determine status based on results
            if not denied_actions:
                return {
                    "status": "success",
                    "denied_actions": [],
                    "message": "All required permissions are available"
                }
            else:
                return {
                    "status": "failed",
                    "denied_actions": denied_actions,
                    "message": f"Some permissions are missing: {', '.join(denied_actions)}"
                }

        except Exception as e:
            return {
                "status": "failed",
                "denied_actions": [],
                "message": f"Error validating AWS account: {e!s}"
            }

    ########################
    # Keypair Functionality
    ########################

    async def create_keypair(self, key_name: str) -> dict[str, str]:
        """
        Create a new keypair using the provided KeyName.

        Returns a dictionary with the private key and keypair id.
        Example: {'PrimaryKey': <private key>, 'KeyPairId': <keypair id>}
        """
        try:
            response = self.ec2_client.create_key_pair(
                KeyName=key_name
            )
            return {'PrimaryKey': response['KeyMaterial'], 'KeyPairId': response['KeyPairId']}
        except Exception as e:
            return {"error": str(e)}

    async def delete_keypair(self, key_id: str) -> str:
        """
        Delete the keypair with the given KeyId.

        Returns the HTTP status code as a string.
        """
        try:
            response = self.ec2_client.delete_key_pair(
                KeyPairId=key_id
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except Exception as e:
            return str(e)

    async def get_keypair_id(self, key_name: str) -> str:
        """
        Describe the keypair with the given KeyName.

        Returns the KeyPairId as a string.
        """
        try:
            response = self.ec2_client.describe_key_pairs(
                KeyNames=[key_name]
            )
            return response['KeyPairs'][0]['KeyPairId']
        except Exception as e:
            return str(e)

    async def get_keypair_name(self, key_id: str) -> str:
        """
        Describe the keypair with the given KeyPairId.

        Returns the KeyName as a string.
        """
        try:
            response = self.ec2_client.describe_key_pairs(
                KeyPairIds=[key_id]
            )
            return response['KeyPairs'][0]['KeyName']
        except Exception as e:
            return str(e)

    ###################
    # EC2 Functionality
    ###################

    async def create_instance(self,
                             key_name: str,
                             image_id: str,
                             instance_type: str = 't2.medium',
                             instance_count: int = 1,
                             security_groups: Optional[list[str]] = None) -> str:
        """
        Create a new EC2 instance.

        Returns the InstanceId as a string.
        """
        if security_groups is None:
            security_groups = ['sg-0f1d1e7f0e5d8936f']  # Default security group

        try:
            response = self.ec2_client.run_instances(
                ImageId=image_id,
                InstanceType=instance_type,
                MinCount=instance_count,
                MaxCount=instance_count,
                KeyName=key_name,
                SecurityGroupIds=security_groups,
                TagSpecifications=[
                    {
                        'ResourceType': 'instance',
                        'Tags': [
                            {'Key': 'Name', 'Value': os.getenv('RUNNER_TAG', 'Ashoka-Testing')},
                            {'Key': 'CDE-Billing', 'Value': ''},
                        ]
                    }
                ]
            )
            return response['Instances'][0]['InstanceId']
        except Exception as e:
            return str(e)

    async def add_instance_tag(self, instance_id: str, tag: str) -> str:
        """Add a tag to an existing instance."""
        try:
            response = self.ec2_client.create_tags(
                Resources=[instance_id],
                Tags=[
                    {
                        'Key': 'User',
                        'Value': tag
                    }
                ]
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except Exception as e:
            return str(e)

    async def get_instance_ip(self, instance_id: str) -> str:
        """
        Describe the EC2 instance with the given InstanceId.
        Wait for the instance to be running, then fetch the public IP address as a string.
        """
        import re, asyncio
        # Wait for the instance to be running
        try:
            await self.wait_for_instance_running(instance_id)
        except Exception as e:
            return f"Waiter error: {e}"
        # Now try a few times to get the public IP
        max_attempts = 5
        ip_regex = re.compile(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$")
        for attempt in range(max_attempts):
            try:
                response = self.ec2_client.describe_instances(
                    InstanceIds=[instance_id]
                )
                ip = response['Reservations'][0]['Instances'][0]['NetworkInterfaces'][0]['Association']['PublicIp']
                if ip and ip != 'Association' and ip_regex.match(str(ip)):
                    return ip
                await asyncio.sleep(2)
            except Exception as e:
                return str(e)
        return 'AWS Failed to fetch public IP'

    async def get_instance_state(self, instance_id: str) -> str:
        """
        Describe the state of the EC2 instance with the given InstanceId.

        Returns the state as a string.
        """
        try:
            response = self.ec2_client.describe_instances(
                InstanceIds=[instance_id]
            )
            return response['Reservations'][0]['Instances'][0]['State']['Name']
        except Exception as e:
            return str(e)

    # Future Work: Add a check to see if the instance is already stopped
    async def stop_instance(self, instance_id: str) -> str:
        """
        Stop the EC2 instance with the given InstanceId.

        Returns the state as a string.
        """
        try:
            response = self.ec2_client.stop_instances(
                InstanceIds=[instance_id]
            )
            return response['StoppingInstances'][0]['CurrentState']['Name']
        except Exception as e:
            return str(e)

    async def start_instance(self, instance_id: str) -> str:
        """
        Start the EC2 instance with the given InstanceId.

        Returns the state as a string.
        Handles the case where the instance is in 'stopping' by waiting for it to be 'stopped' first.
        """
        try:
            # Check current state
            response = self.ec2_client.describe_instances(InstanceIds=[instance_id])
            state = response['Reservations'][0]['Instances'][0]['State']['Name']
            if state == "stopping":
                waiter = self.ec2_client.get_waiter("instance_stopped")
                waiter.wait(InstanceIds=[instance_id])
            # Start the instance
            response = self.ec2_client.start_instances(InstanceIds=[instance_id])
            # Wait for the instance to be running
            await self.wait_for_instance_running(instance_id)
            # Optionally, re-fetch the state to confirm
            response = self.ec2_client.describe_instances(InstanceIds=[instance_id])
            return response['Reservations'][0]['Instances'][0]['State']['Name']
        except Exception as e:
            return str(e)

    # Future Work: Add a check to see if the instance is already terminated
    # Future Work: Terminate multiple instances at once -> InstanceId -> InstanceIds
    async def terminate_instance(self, instance_id: str) -> str:
        """
        Terminate the EC2 instance with the given InstanceId.

        Returns the state as a string.
        """
        try:
            response = self.ec2_client.terminate_instances(
                InstanceIds=[instance_id]
            )
            return response['TerminatingInstances'][0]['CurrentState']['Name']
        except Exception as e:
            return str(e)

    #####################
    # EC2 Status Waiters
    #####################

    async def wait_for_instance_running(self, instance_id: str):
        """Wait for the EC2 instance with the given instance_id to be in the running state."""
        waiter = self.ec2_client.get_waiter("instance_running")
        waiter.wait(InstanceIds=[instance_id])

    async def wait_for_instance_terminated(self, instance_id: str):
        """Wait for the EC2 instance with the given instance_id to be in the terminated state."""
        # First check current state - if already terminated, return immediately
        response = self.ec2_client.describe_instances(InstanceIds=[instance_id])
        if response and 'Reservations' in response and response['Reservations']:
            instance = response['Reservations'][0]['Instances'][0]
            state = instance.get('State', {}).get('Name', 'unknown')

            # Already terminated
            if state == 'terminated':
                return True

            # Stuck in stopping - special handling
            if state == 'stopping':
                # Configure wait parameters for stopping → terminated transition
                waiter = self.ec2_client.get_waiter("instance_terminated")
                waiter.config.delay = 5 # 5 seconds between checks
                waiter.config.max_attempts = 20  # Max 20 attempts (100 seconds)
                try:
                    waiter.wait(InstanceIds=[instance_id])
                    return True
                except Exception:
                    # Return false if it doesn't transition in that time
                    return False

        # Standard case - use the normal waiter
        waiter = self.ec2_client.get_waiter("instance_terminated")
        waiter.wait(InstanceIds=[instance_id])
        return True

    ###################
    # AMI Functionality
    ###################

    async def create_runner_image(self, instance_id: str, image_name: str, image_tags: Optional[list[dict]] = None) -> str:
        """
        Create an AMI from the given instance_id with the given tags.

        image_tags is a list of dictionaries with the tags to be added to the AMI.
        Example: tags = [ {'Key': 'key_name', 'Value': 'example_value'}, {'Key': 'key_name2', 'Value': 'example_value2'} ]
        Returns the AMI ID as a string.
        """
        if  image_tags is None:
            image_tags = [{'Key': 'Instance', 'Value': instance_id}]

        try:
            response = self.ec2_client.create_image(
                TagSpecifications=[
                    {
                        'ResourceType': 'image',
                        'Tags': image_tags
                    },
                ],
                InstanceId = instance_id,
                Name = image_name,
                NoReboot = True
            )
            return response['ImageId']
        except Exception as e:
            return str(e)

    async def deregister_runner_image(self, image_id: str) -> str:
        """
        Deregister the AMI with the given ImageId.

        Returns the HTTP status code as a string.
        """
        try:
            response = self.ec2_client.deregister_image(
                ImageId = image_id
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except Exception as e:
            return str(e)

    async def wait_for_image_available(self, image_id: str, max_retries: int = 5, retry_delay: int = 10) -> bool:
        """
        Wait for an image to be in the available state with internal retry handling.

        Args:
            image_id: The AWS AMI ID to check
            max_retries: Maximum number of retry attempts (default: 5)
            retry_delay: Delay between retries in seconds (default: 60)

        Returns:
            bool: True if the image is available

        Raises:
            Exception: If the image fails to reach the available state after max retries
        """
        import asyncio
        logger = logging.getLogger(__name__)

        for attempt in range(max_retries + 1):
            try:
                # Check current image state first
                response = self.ec2_client.describe_images(ImageIds=[image_id])

                # Handle missing image
                if not response or 'Images' not in response or len(response['Images']) == 0:
                    if attempt < max_retries:
                        logger.info(f"Image {image_id} not found, retry {attempt+1}/{max_retries}")
                        await asyncio.sleep(retry_delay)
                        continue
                    raise Exception(f"Image {image_id} not found after {max_retries} retries")

                # Check image state
                image_state = response['Images'][0]['State']
                logger.info(f"Image {image_id} state: {image_state}")

                if image_state == 'available':
                    return True
                elif image_state == 'failed':
                    raise Exception(f"Image {image_id} creation failed")
                elif image_state != 'pending':
                    raise Exception(f"Image {image_id} in unexpected state: {image_state}")

                # For pending images, use the waiter with reasonable timeout
                waiter = self.ec2_client.get_waiter('image_available')
                waiter.wait(
                    ImageIds=[image_id]
                )
                # If waiter completes successfully, image is available
                return True

            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Retry {attempt+1}/{max_retries} after error: {e}")
                    await asyncio.sleep(retry_delay)
                elif attempt == max_retries:
                    # One final check before giving up
                    try:
                        final_check = self.ec2_client.describe_images(ImageIds=[image_id])
                        if (final_check and 'Images' in final_check and
                            len(final_check['Images']) > 0 and
                            final_check['Images'][0]['State'] == 'available'):
                            return True
                    except Exception as final_check_error:
                        logger.error(f"Final check failed: {final_check_error}")
                        pass
                    logger.error(f"Failed after {max_retries} retries: {e}")
                    raise

    ###################
    # S3 Functionality
    ###################

    async def create_s3_bucket(self, bucket_name: str) -> str:
        """
        Create a new S3 bucket with the given BucketName.

        Returns the location as a string.
        """
        try:
            response = self.s3_client.create_bucket(
                Bucket=bucket_name
            )
            return response['Location']
        except Exception as e:
            return str(e)

    async def delete_s3_bucket(self, bucket_name: str) -> str:
        """
        Delete the S3 bucket with the given BucketName.

        Returns the HTTP status code as a string.
        """
        try:
            response = self.s3_client.delete_bucket(
                Bucket=bucket_name
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except Exception as e:
            return str(e)

    async def list_s3_buckets(self) -> list[str]:
        """
        List all S3 buckets in the default region.

        Returns a list of bucket names as strings.
        """
        try:
            response = self.s3_client.list_buckets()
            buckets = []
            for bucket in response['Buckets']:
                buckets.append(bucket['Name'])
            return buckets
        except Exception as e:
            return [str(e)]

    async def list_s3_objects(self, bucket_name: str) -> list[str]:
        """
        List all objects in the S3 bucket with the given BucketName.

        Returns a list of object names as strings.
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=bucket_name
            )
            objects = []
            for obj in response['Contents']:
                objects.append(obj['Key'])
            return objects
        except Exception as e:
            return [str(e)]

    async def put_s3_object(self, bucket_name: str, object_name: str, object_data: Any) -> str:
        """
        Create or update the object with the given ObjectName and ObjectData into the S3 bucket with the given BucketName.

        Returns the HTTP status code as a string.
        """
        try:
            response = self.s3_client.put_object(
                Bucket=bucket_name,
                Key=object_name,
                Body=object_data
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except Exception as e:
            return str(e)

    async def get_s3_object(self, bucket_name: str, object_name: str) -> Any:
        """
        Get the object with the given ObjectName from the S3 bucket with the given BucketName.

        Returns the object data as a bytes object.
        """
        try:
            response = self.s3_client.get_object(
                Bucket=bucket_name,
                Key=object_name
            )
            return response['Body'].read()
        except Exception as e:
            return str(e)

    async def delete_s3_objects(self, bucket_name: str, object_names: list[str]) -> str:
        """
        Delete the objects with the given ObjectNames from the S3 bucket with the given BucketName.

        Returns the HTTP status code as a string.
        """
        for obj in object_names:
            try:
                response = self.s3_client.delete_object(
                    Bucket=bucket_name,
                    Key=obj
                )
                return
            except Exception as e:
                return str(e)

    ###################
    # SSH Functionality
    ###################

    async def ssh_run_script(self, ip: str, key: str, script: str, username: str = 'ubuntu') -> dict[str, str]:
        """
        Run the Script on the remote machine with the given IP address.

        Returns the output, error, and exit code as a dictionary.
        {'stdout': value, 'stderr': value, 'exit_code': value}
        """
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        keyfile = StringIO(key)
        private_key = paramiko.RSAKey.from_private_key(keyfile)

        output = ""
        error = ""
        exit_code = 1  # Default to failure

        try:
            ssh.connect(hostname=ip, username=username, pkey=private_key, timeout=30)
            # Execute the main script.
            stdin, stdout, stderr = ssh.exec_command(script)
            # Get the exit code directly from the channel
            exit_code = stdout.channel.recv_exit_status()
            # Then read the output and error
            output = stdout.read().decode()
            error = stderr.read().decode()
        except Exception as e:
            return {'stdout': output, 'stderr': str(e), 'exit_code': 1}  # Return failure for SSH exceptions
        finally:
            ssh.close()

        # Return with the keys expected by parse_script_output
        return {'stdout': output, 'stderr': error, 'exit_code': exit_code}

    ##############################
    # Security Group Functionality
    ##############################

    async def create_security_group(self, grp_name: str, desc: str) -> str:
        """
        Create a new security group using the provided Description and GroupName.

        Returns the GroupId of the created security group as a string
        """
        try:
            response = self.ec2_client.create_security_group(
                Description = desc,
                GroupName = grp_name
            )
            return response['GroupId']
        except Exception as e:
            return {"error": str(e)}

    async def delete_security_group(self, group_id: str) -> str:
        """
        Delete the security group with the given GroupId.

        Returns the HTTP status code as a string.
        """
        try:
            response = self.ec2_client.delete_security_group(
                GroupId = group_id
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except Exception as e:
            return str(e)

    async def authorize_security_group_ingress(self, group_id: str, ip: str, port: int = 22) -> str:
        """
        Autorize ingress for a security group on a given port, by a given IP, to a given group.

        IP is in CIDR notation, follwing the format <ip>/<mask>. ie 203.0.113.0/24
        Port is the port to open, default is 22 (SSH).
        Returns the success or failure as a string.
        """
        try:
            response = self.ec2_client.authorize_security_group_ingress(
                GroupId = group_id,
                IpPermissions = [
                    {
                        'FromPort': port,
                        'IpProtocol': 'tcp',
                        'IpRanges': [
                            {
                                'CidrIp': ip,
                                'Description': f'Port {port} access from {ip}',
                            },
                        ],
                        'ToPort': port,
                    },
                ],
            )
            return response['Return']
        except Exception as e:
            return str(e)
