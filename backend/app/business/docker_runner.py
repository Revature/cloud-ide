# app/business/docker_runner.py
""" Docker utilities for running submitted code files in isolated Docker containers. """
import logging
import docker

logger = logging.getLogger(__name__)

class DockerRunner():
    """ Class to handle running code files in Docker containers. """

    def __init__(self):
        """ Initialize the DockerRunner docker client. """
        self.client = docker.from_env()

    def run_code(self, container_image: str, startup_command: str, code_file_path: str, args: str = "") -> str:
        """ Run the specified code file in a Docker container and return the output. """
        try:
            container = self.client.containers.run(
                container_image,
                command=f"{startup_command} {code_file_path} {args}",
                detach=True,
                remove=True
            )
            container.wait()
            logs = container.logs().decode('utf-8')
            return logs
        except docker.errors.ContainerError as e:
            logger.error(f"Container error: {e}")
            return f"Error running code: {e}"
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return f"Unexpected error: {e}"