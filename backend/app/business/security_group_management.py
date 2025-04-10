"""Business logic for managing security groups for runners."""

import logging
import uuid
from sqlmodel import Session
from app.db.database import engine
from app.models.security_group import SecurityGroup
from app.models.runner_security_group import RunnerSecurityGroup
from app.db import security_group_repository, runner_security_group_repository, cloud_connector_repository
from app.business.cloud_services import cloud_service_factory
from app.exceptions.runner_exceptions import RunnerExecException

logger = logging.getLogger(__name__)

async def create_security_group(
    cloud_connector_id: int,
    open_ssh: bool = True
) -> str:
    """
    Create a new security group in the cloud provider with default SSH access.

    Args:
        cloud_connector_id: ID of the cloud connector
        additional_ports: Optional list of additional ports to open

    Returns:
        The cloud provider ID of the created security group
    """
    try:
        with Session(engine) as session:
            # Get the cloud connector
            cloud_connector = cloud_connector_repository.find_cloud_connector_by_id(
                session,
                cloud_connector_id
            )

            if not cloud_connector:
                logger.error(f"Cloud connector {cloud_connector_id} not found")
                raise RunnerExecException(f"Cloud connector {cloud_connector_id} not found")

            # Get the cloud service
            cloud_service = cloud_service_factory.get_cloud_service(cloud_connector)

            # Create a unique name for the security group
            unique_id = str(uuid.uuid4())[:8]
            group_name = f"runner-sg-{unique_id}"

            # Create the security group in the cloud provider
            cloud_group_id = await cloud_service.create_security_group(
                group_name,
                f"Security group for runner {unique_id}"
            )

            if isinstance(cloud_group_id, dict) and "error" in cloud_group_id:
                logger.error(f"Failed to create security group: {cloud_group_id['error']}")
                raise RunnerExecException(f"Failed to create security group: {cloud_group_id['error']}")

            # Prepare inbound rules
            inbound_rules = {}

            # Always open SSH port (22) by default unless specified otherwise
            if open_ssh:
                ssh_result = await cloud_service.authorize_security_group_ingress(
                    cloud_group_id,
                    "0.0.0.0/0",  # Broad SSH access
                    22  # SSH port
                )

                # Log a warning about broad SSH access
                logger.warning(
                    f"SSH access (0.0.0.0/0) enabled for security group {group_name}. "
                    "This is a potential security risk!"
                )

                # Store SSH rule in inbound rules
                inbound_rules["port_22"] = {
                    "port": 22,
                    "cidr": "0.0.0.0/0",
                    "result": ssh_result
                }

            # Store the security group in the database
            new_security_group = SecurityGroup(
                name=group_name,
                cloud_group_id=cloud_group_id,
                cloud_connector_id=cloud_connector_id,
                status="active",
                inbound_rules=inbound_rules,
                outbound_rules={}
            )

            db_security_group = security_group_repository.add_security_group(session, new_security_group)
            session.commit()

            logger.info(f"Security group created with ID {db_security_group.id} and cloud ID {cloud_group_id}")
            return cloud_group_id

    except Exception as e:
        logger.error(f"Error creating security group: {e!s}")
        raise RunnerExecException(f"Failed to create security group: {e!s}") from e

async def associate_security_group_with_runner(runner_id: int, cloud_group_id: str) -> bool:
    """
    Associate an existing security group with a runner after the runner is created.

    Args:
        runner_id: ID of the runner
        cloud_group_id: Cloud provider ID of the security group

    Returns:
        True if successful, False otherwise
    """
    try:
        with Session(engine) as session:
            # Find the security group by cloud provider ID
            security_group = security_group_repository.find_security_group_by_cloud_group_id(
                session,
                cloud_group_id
            )

            if not security_group:
                logger.error(f"Security group with cloud ID {cloud_group_id} not found")
                return False

            # Associate the security group with the runner
            runner_security_group_repository.add_runner_security_group(
                session,
                runner_id,
                security_group.id
            )

            session.commit()
            return True

    except Exception as e:
        logger.error(f"Error associating security group with runner {runner_id}: {e!s}")
        return False

# TODO better way to know what ports are needed for the runner
async def authorize_user_access(runner_id: int, user_ip: str, user_email: str, cloud_service, port: int = 3000) -> bool:
    """
    Add ingress rule to allow user's IP access to a specific port on the runner.

    Args:
        runner_id: ID of the runner
        user_ip: IP address of the user who will connect to the runner
        cloud_service: The cloud service implementation to use
        port: Port to open access to (default is 3000)

    Returns:
        True if successful, False otherwise
    """
    try:
        with Session(engine) as session:
            # Find the security groups associated with this runner
            security_groups = runner_security_group_repository.find_security_groups_by_runner_id(
                session,
                runner_id
            )

            if not security_groups:
                # print(f"No security groups found for runner {runner_id}")
                logger.error(f"No security groups found for runner {runner_id}")
                return False

            # Format IP for security group rule
            ip_cidr = f"{user_ip}/32"

            success = True
            for sg in security_groups:
                if sg.status != "active":
                    continue

                # Add ingress rule for the specified port
                result = await cloud_service.authorize_security_group_ingress(
                    sg.cloud_group_id,
                    ip_cidr,
                    port
                )

                # Update the security group record with the new rule
                if not sg.inbound_rules:
                    sg.inbound_rules = {}

                port_key = f"port_{port}"
                sg.inbound_rules[port_key] = {
                    "port": port,
                    "cidr": ip_cidr,
                    "result": result
                }

                security_group_repository.update_security_group(session, sg)

                # Consider the operation failed if any SG update fails
                if result != "True" and not result:
                    success = False

                try:
                    # print(f"Adding tag to security group for user {user_ip}")
                    logger.info(f"Adding tag to security group for user {user_ip}")
                    tag_result = await cloud_service.add_instance_tag(
                        sg.cloud_group_id,
                        user_email
                    )
                    # print(f"Tag addition result: {tag_result}")
                    logger.info(f"Tag addition result: {tag_result}")
                except Exception as e:
                    # print(f"Failed to add instance tag: {e!s}")
                    logger.error(f"Failed to add instance tag: {e!s}", exc_info=True)

            session.commit()
            return success

    except Exception as e:
        logger.error(f"Error authorizing user access for runner {runner_id} with IP {user_ip}: {e!s}")
        return False

async def tag_security_group(security_group_cloud_id: str, tag_key: str, tag_value: str, cloud_service) -> bool:
    """
    Add a tag to a security group.

    Args:
        security_group_cloud_id: Cloud provider ID of the security group
        tag_key: Key for the tag
        tag_value: Value for the tag
        cloud_service: The cloud service implementation to use

    Returns:
        True if successful, False otherwise
    """
    try:
        # Using the same method as for tagging instances
        result = await cloud_service.add_instance_tag(security_group_cloud_id, f"{tag_key}={tag_value}")

        if result == "200":
            return True
        return False

    except Exception as e:
        logger.error(f"Error tagging security group {security_group_cloud_id}: {e!s}")
        return False

async def delete_security_group(cloud_group_id: str, cloud_service) -> bool:
    """
    Delete a security group.

    Args:
        cloud_group_id: Cloud provider ID of the security group
        cloud_service: The cloud service implementation to use

    Returns:
        True if successful, False otherwise
    """
    try:
        # Delete from cloud provider
        # print(f"Deleting security group {cloud_group_id} from cloud provider")
        result = await cloud_service.delete_security_group(cloud_group_id)
        # print(f"Delete result: {result}")
        success_status_code = 200
        # Update database status
        with Session(engine) as session:
            security_group = security_group_repository.find_security_group_by_cloud_group_id(
                session,
                cloud_group_id
            )

            if security_group:
                # If successful deletion or group doesn't exist anymore, remove from DB
                if result == success_status_code:
                    security_group.status = "deleted"
                    security_group_repository.update_security_group(session, security_group)
                else:
                    # Otherwise, mark as pending deletion for retry
                    security_group.status = "pending_deletion"
                    security_group_repository.update_security_group(session, security_group)

                session.commit()

            return result == success_status_code

    except Exception as e:
        logger.error(f"Error deleting security group {cloud_group_id}: {e!s}")
        return False

async def handle_runner_termination(runner_id: int, cloud_service) -> bool:
    """
    Handle security group cleanup when a runner is terminated.

    Args:
        runner_id: ID of the runner
        cloud_service: The cloud service implementation to use

    Returns:
        True if successful, False otherwise
    """
    # print(f"Handling termination of runner {runner_id}")
    logger.info(f"Handling termination of runner {runner_id}")
    try:
        success = True
        with Session(engine) as session:
            # Find all security groups associated with this runner
            security_groups = runner_security_group_repository.find_security_groups_by_runner_id(
                session,
                runner_id
            )
            # print(f"Found {len(security_groups)} security groups for runner {runner_id}")
            logger.info(f"Found {len(security_groups)} security groups for runner {runner_id}")

            for sg in security_groups:
                # Check if any other runners are using this security group
                other_runners = runner_security_group_repository.find_runners_by_security_group_id(
                    session,
                    sg.id
                )

                # remove the current runner from the list
                other_runners = [r for r in other_runners if r != runner_id]

                # print(f"Found {len(other_runners)} other runners using security group {sg.id}")
                logger.info(f"Found {len(other_runners)} other runners using security group {sg.id}")

                # Only delete the security group if no other runners are using it
                if not other_runners:
                    success = await delete_security_group(sg.cloud_group_id, cloud_service)
                else:
                    logger.info(f"Security group {sg.id} still in use by {len(other_runners)} other runners, not deleting")

            session.commit()
            return success

    except Exception as e:
        logger.error(f"Error handling security groups for terminated runner {runner_id}: {e!s}")
        return False
