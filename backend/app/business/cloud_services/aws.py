# app/business/cloud_services/aws_service.py
"""AWS implementation of the CloudService interface."""

import os
import boto3
import paramiko
from io import StringIO
from app.business.cloud_services.base import CloudService
from typing import Any, Optional

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

    ###################
    # Keypair Functionality
    ###################

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
                        ]
                    }
                ]
            )
            return response['Instances'][0]['InstanceId']
        except Exception as e:
            return str(e)

    async def get_instance_ip(self, instance_id: str) -> str:
        """
        Describe the EC2 instance with the given InstanceId.

        Returns the public IP address as a string.
        """
        try:
            response = self.ec2_client.describe_instances(
                InstanceIds=[instance_id]
            )
            return response['Reservations'][0]['Instances'][0]['NetworkInterfaces'][0]['Association']['PublicIp']
        except Exception as e:
            return str(e)

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
        """
        try:
            response = self.ec2_client.start_instances(
                InstanceIds=[instance_id]
            )
            return response['StartingInstances'][0]['CurrentState']['Name']
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

    async def wait_for_instance_running(self, instance_id: str):
        """Wait for the EC2 instance with the given instance_id to be in the running state."""
        waiter = self.ec2_client.get_waiter("instance_running")
        waiter.wait(InstanceIds=[instance_id])

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

        Returns the output and error as a dictionary of strings.
        {'Output': value, 'Error': value}
        """
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        keyfile = StringIO(key)
        private_key = paramiko.RSAKey.from_private_key(keyfile)

        print(f"[DEBUG] SSH_Script called with IP: {ip}, Username: {username}")
        print(f"[DEBUG] Script to execute: {script}")

        output = ""
        error = ""
        try:
            print("[DEBUG] Connecting to SSH...")
            ssh.connect(hostname=ip, username=username, pkey=private_key, timeout=30)
            print("[DEBUG] SSH connection established.")

            # Execute a test echo command to verify connectivity.
            test_cmd = "echo 'Test Echo: SSH Connection Successful'"
            print(f"[DEBUG] Executing test command: {test_cmd}")
            stdin, stdout, stderr = ssh.exec_command(test_cmd)
            test_output = stdout.read().decode().strip()
            test_error = stderr.read().decode().strip()
            print(f"[DEBUG] Test command output: {test_output}")
            if test_error:
                print(f"[DEBUG] Test command error: {test_error}")

            # Execute the main script.
            print("[DEBUG] Executing main script...")
            stdin, stdout, stderr = ssh.exec_command(script)
            output = stdout.read().decode()
            error = stderr.read().decode()
            print(f"[DEBUG] Main script output: {output}")
            if error:
                print(f"[DEBUG] Main script error: {error}")
        except Exception as e:
            print(f"[ERROR] Exception during SSH execution: {e}")
            return {'Output': str(e), 'Error': error}
        finally:
            print("[DEBUG] Closing SSH connection.")
            ssh.close()

        return {'Output': output, 'Error': error}
