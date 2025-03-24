"""Single source of truth for env variables."""
import os
max_runner_lifetime = os.getenv("MAX_RUNNER_LIFETIME", str(180))
domain = os.getenv("DOMAIN", "https://devide.revature.com")
auth_mode = os.getenv("AUTH_MODE", "ON")
