# app/business/cloud_services/aws_service.py
"""AWS implementation of the CloudService interface."""

import os
import boto3
import paramiko
import re
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

    async def validate_account(self) -> list[str]:
        """
        Verify the AWS account by checking the IAM user.

        Returns a list of denied actions strings, or an error message if the account is invalid.
        """
        try:
            denied_actions = []

            identity = self.sts_client.get_caller_identity()
            principal_arn = identity['Arn']

            response = self.iam_client.get_user()
            username = response['User']['UserName']

            response = self.iam_client.simulate_principal_policy(
                PolicySourceArn=principal_arn,
                ActionNames=[
                    'ec2:RunInstances',
                    'ec2:DescribeInstances',
                    'ec2:TerminateInstances',
                    'ec2:StopInstances',
                    'ec2:StartInstances',
                    'ec2:CreateTags',
                    'ec2:DescribeTags',
                    'ec2:CreateImage',
                    'ec2:DeregisterImage',
                    'ec2:CreateKeyPair',
                    'ec2:DeleteKeyPair',
                    'ec2:DescribeKeyPairs',
                    'ec2:CreateSecurityGroup',
                    'ec2:DeleteSecurityGroup',
                    'ec2:AuthorizeSecurityGroupIngress',
                    's3:CreateBucket',
                    's3:DeleteBucket',
                    's3:ListBuckets',
                    's3:ListObjectsV2',
                    's3:GetObject',
                    's3:PutObject',
                    's3:DeleteObject'
                ]
            )

            for result in response['EvaluationResults']:
                if result['EvalDecision'] != 'allowed':
                    denied_actions.append(result['EvalActionName'])

            return denied_actions

        except Exception as e:
            return str(e)

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

    async def wait_for_image_available(self, image_id: str):
        """Wait for an image to be in the available state."""
        waiter = self.ec2_client.get_waiter('image_available')
        waiter.wait(InstanceIds=[image_id])

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
