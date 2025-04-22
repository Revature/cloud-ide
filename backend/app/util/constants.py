"""Single source of truth for env variables."""
import os

max_runner_lifetime : int = int(os.getenv("MAX_RUNNER_LIFETIME", str(180)))
max_runner_pool_size : int = int(os.getenv("MAX_RUNNER_POOL_SIZE", str(10)))
domain : str = os.getenv("DOMAIN", "https://devide.revature.com")
auth_mode : str = os.getenv("AUTH_MODE", "PROD")
default_role_name: str = 'user'
