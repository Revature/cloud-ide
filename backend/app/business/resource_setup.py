# app/business/resource_setup.py
"""Module for setting up default resources in the database."""

from dataclasses import dataclass
from sqlmodel import Session, select
from app.db.database import engine
from app.models import User, Machine, Image, Script
from datetime import datetime
from app.models import CloudConnector
import os

@dataclass
class Resources:
    """Dataclass for storing default resources."""

    system_user_email: str
    machine_id: int
    image_identifier: str
    runner_pool_size: int

def setup_resources():
    """
    Fetch or create default User, Machine, Image, and Script.

    Returns a Resources dataclass with the necessary values.
    """
    with Session(engine) as session:
        # 1) Fetch or create a default user.
        stmt_user = select(User).where(User.email == "ashoka.shringla@revature.com")
        system_user = session.exec(stmt_user).first()
        if not system_user:
            system_user = User(
                first_name="Ashoka",
                last_name="Shringla",
                email="ashoka.shringla@revature.com",
                created_by="system",
                modified_by="system"
            )
            session.add(system_user)
            session.commit()
            session.refresh(system_user)


        # 2) Fetch or create default cloud connector.
        stmt_connector = select(CloudConnector).where(CloudConnector.provider == "aws")
        cloud_connector = session.exec(stmt_connector).first()
        if not cloud_connector:
            # Get AWS credentials and region from environment variables
            aws_access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
            aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
            aws_region = os.getenv("AWS_REGION", "us-west-2")

            cloud_connector = CloudConnector(
                provider="aws",
                region=aws_region,
                created_by="system",
                modified_by="system"
            )
            # Set the access_key and secret_key using the hybrid properties
            # which will handle the encryption
            cloud_connector.set_decrypted_access_key(aws_access_key)
            cloud_connector.set_decrypted_secret_key(aws_secret_key)

            session.add(cloud_connector)
            session.commit()
            session.refresh(cloud_connector)

        # 3) Fetch or create default Machine.
        stmt_machine = select(Machine).where(Machine.identifier == "t2.medium")
        db_machine = session.exec(stmt_machine).first()
        if not db_machine:
            db_machine = Machine(
                name="t2.medium",
                identifier="t2.medium",
                cpu_count=2,
                memory_size=4096,
                storage_size=20,
                cloud_connector_id=cloud_connector.id,  # Add cloud connector reference
                created_by="system",
                modified_by="system"
            )
            session.add(db_machine)
            session.commit()
            session.refresh(db_machine)

        # 4) Fetch or create default Image.
        stmt_image = select(Image).where(Image.identifier == "ami-0bbfffa970b0280da")
        db_image = session.exec(stmt_image).first()
        if not db_image:
            db_image = Image(
                name="sample-id-image",
                description="An AMI for testing",
                identifier="ami-0bbfffa970b0280da",
                runner_pool_size=1,  # Example pool size
                machine_id=db_machine.id,
                cloud_connector_id=cloud_connector.id,  # Add cloud connector reference
                created_by="system",
                modified_by="system"
            )
            session.add(db_image)
            session.commit()
            session.refresh(db_image)

        # 5) Fetch or create default Script for the "on_awaiting_client" event.
        stmt_script = select(Script).where(Script.event == "on_awaiting_client", Script.image_id == db_image.id)
        awaiting_client_script = session.exec(stmt_script).first()
        if not awaiting_client_script:
            awaiting_client_script = Script(
                name="Git Clone Script",
                description="Clones a repository specified in runner env_data under 'repo_url'",
                event="on_awaiting_client",
                image_id=db_image.id,
                script=r"""#!/bin/bash
# Script to set up environment variables and clone repository
# This should run during the "on_awaiting_client" phase

set -e  # Exit on error
echo "Setting up environment and cloning repository..."

# Extract variables from script vars (directly in context)
REPO_URL="{{ git_url }}"
REPO_NAME="{{ git_repo_name }}"
REPO_PATH="/home/ubuntu/$REPO_NAME"

# Extract environment variables - keep as encoded where applicable
GIT_ACCESS_TOKEN="{{ env_vars.git_access_token }}"
HOST_B64="{{ env_vars.host }}"
TRAINEE_ID_B64="{{ env_vars.trainee_coding_lab_id }}"
PROJECT_TYPE_B64="{{ env_vars.project_type }}"
TOKEN_B64="{{ env_vars.token }}"

# Do not decode the Base64 values - use them as is
HOST="$HOST_B64"
TRAINEE_ID="$TRAINEE_ID_B64"
PROJECT_TYPE="$PROJECT_TYPE_B64"
TOKEN="$TOKEN_B64"

# Create a file to store environment variables
ENV_FILE="/home/ubuntu/.env_vars"
GITHUB_ENV_FILE="/home/ubuntu/.github_env"

# Write environment variables to file
cat > "$ENV_FILE" << EOF
export GIT_ACCESS_TOKEN="$GIT_ACCESS_TOKEN"
export HOST="$HOST"
export TRAINEE_CODING_LAB_ID="$TRAINEE_ID"
export PROJECT_TYPE="$PROJECT_TYPE"
export TOKEN="$TOKEN"
EOF

# Write GitHub specific variables to a separate file for git operations
cat > "$GITHUB_ENV_FILE" << EOF
export GITHUB_TOKEN="$GIT_ACCESS_TOKEN"
export GITHUB_USERNAME="git"
EOF

# Make the files readable only by owner
chmod 600 "$ENV_FILE" "$GITHUB_ENV_FILE"

# Source the environment variables for current session
source "$ENV_FILE"
source "$GITHUB_ENV_FILE"

# Make variables available to system environment
# Add to .bashrc for persistence across sessions
cat >> /home/ubuntu/.bashrc << EOF

# Environment variables for the project
source "$ENV_FILE"
source "$GITHUB_ENV_FILE"
EOF

# Export variables for immediate availability via printenv
export GIT_ACCESS_TOKEN="$GIT_ACCESS_TOKEN"
export HOST="$HOST"
export TRAINEE_CODING_LAB_ID="$TRAINEE_ID"
export PROJECT_TYPE="$PROJECT_TYPE"
export TOKEN="$TOKEN"
export GITHUB_TOKEN="$GIT_ACCESS_TOKEN"
export GITHUB_USERNAME="git"

# Add to system-wide environment if possible
if [ -f "/etc/environment" ] && [ -w "/etc/environment" ]; then
    # Try to append to /etc/environment if writable
    grep -q "GIT_ACCESS_TOKEN" /etc/environment || echo "GIT_ACCESS_TOKEN=$GIT_ACCESS_TOKEN" | sudo tee -a /etc/environment > /dev/null
    grep -q "HOST" /etc/environment || echo "HOST=$HOST" | sudo tee -a /etc/environment > /dev/null
    grep -q "TRAINEE_CODING_LAB_ID" /etc/environment || echo "TRAINEE_CODING_LAB_ID=$TRAINEE_ID" | sudo tee -a /etc/environment > /dev/null
    grep -q "PROJECT_TYPE" /etc/environment || echo "PROJECT_TYPE=$PROJECT_TYPE" | sudo tee -a /etc/environment > /dev/null
    grep -q "TOKEN" /etc/environment || echo "TOKEN=$TOKEN" | sudo tee -a /etc/environment > /dev/null
elif [ -d "/etc/profile.d" ]; then
    # Fallback to profile.d
    sudo tee /etc/profile.d/cloudide.sh > /dev/null << EOF
export GIT_ACCESS_TOKEN="$GIT_ACCESS_TOKEN"
export HOST="$HOST"
export TRAINEE_CODING_LAB_ID="$TRAINEE_ID"
export PROJECT_TYPE="$PROJECT_TYPE"
export TOKEN="$TOKEN"
EOF
    sudo chmod +x /etc/profile.d/cloudide.sh
fi

# Clone the repository
echo "Cloning repository from $REPO_URL..."
# Use the token for authentication
AUTH_REPO_URL=$(echo "$REPO_URL" | sed "s/https:\/\//https:\/\/$GITHUB_TOKEN@/")
git clone "$AUTH_REPO_URL" "$REPO_PATH"

# Instead of creating folders in the repo, we'll ensure the environment variables
# are available system-wide and in the user's home directory

echo "Environment setup and repository clone completed successfully!"

# Verify environment variables are set correctly
echo "Verifying environment variables:"
printenv | grep -E 'GIT_ACCESS_TOKEN|HOST|TRAINEE_CODING_LAB_ID|PROJECT_TYPE|TOKEN|GITHUB_TOKEN'

exit 0""",
                created_by="system",
                modified_by="system"
            )
            session.add(awaiting_client_script)
            session.commit()
            session.refresh(awaiting_client_script)

        # 5) Fetch or create default Script for the "on_terminate" event
        stmt_script = select(Script).where(Script.event == "on_terminate", Script.image_id == db_image.id)
        termination_script = session.exec(stmt_script).first()
        if not termination_script:
            termination_script = Script(
                name="GitHub Save Script",
                description="Commits and pushes changes to GitHub on termination",
                event="on_terminate",
                image_id=db_image.id,
                script=r"""#!/bin/bash
# Script to commit and push changes on runner termination

set -e  # Exit on error
echo "Starting GitHub save operations..."

# Extract variables from script vars (directly in context)
REPO_NAME="{{ git_repo_name }}"
REPO_URL="{{ git_url }}"
REPO_PATH="/home/ubuntu/$REPO_NAME"

# Load environment variables that were set during on_awaiting_client
# Try different sources in order of preference
if [ -f "/home/ubuntu/.github_env" ]; then
    echo "Loading GitHub credentials from .github_env file..."
    source /home/ubuntu/.github_env
elif grep -q "GITHUB_TOKEN" /home/ubuntu/.bashrc; then
    echo "Loading GitHub credentials from .bashrc file..."
    GITHUB_TOKEN=$(grep "GITHUB_TOKEN" /home/ubuntu/.bashrc | cut -d'=' -f2 | tr -d '"')
    GITHUB_USERNAME=$(grep "GITHUB_USERNAME" /home/ubuntu/.bashrc | cut -d'=' -f2 | tr -d '"')
else
    echo "No GitHub credentials found in environment files."
fi

# Set a default commit message
COMMIT_MESSAGE="Auto-save from cloud IDE on $(date +'%Y-%m-%d %H:%M:%S')"

# Check if required variables are set
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_USERNAME" ]; then
    echo "ERROR: GitHub credentials not found in environment variables. Skipping git operations."
    exit 0  # Exit without error to allow runner termination to proceed
fi

# Check if repository path exists
if [ ! -d "$REPO_PATH" ]; then
    echo "ERROR: Repository directory not found at $REPO_PATH. Skipping git operations."
    exit 0
fi

cd "$REPO_PATH" || exit 1

# Check if there are any changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit. Exiting."
    exit 0
fi

# Configure the repository with authentication
echo "Configuring repository with authentication..."
AUTH_REMOTE_URL=$(echo "$REPO_URL" | sed "s/https:\/\//https:\/\/$GITHUB_TOKEN@/")

# Ensure the origin remote is set correctly with authentication
git remote remove origin 2>/dev/null || true
git remote add origin "$AUTH_REMOTE_URL"

# Add all changes
git add --all

# Commit changes
git commit -m "$COMMIT_MESSAGE"

# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Set up tracking for the current branch
git branch --set-upstream-to=origin/$CURRENT_BRANCH $CURRENT_BRANCH 2>/dev/null || true

# Push to the repository (try current branch first, then common branches)
echo "Pushing changes to repository..."
git push origin $CURRENT_BRANCH 2>/dev/null ||
git push origin main 2>/dev/null ||
git push origin master 2>/dev/null ||
git push -u origin HEAD

echo "Successfully pushed changes to repository"
echo "GitHub operations completed successfully."
exit 0""",
                created_by="system",
                modified_by="system"
            )
            session.add(termination_script)
            session.commit()
            session.refresh(termination_script)

        return Resources(
            system_user_email=system_user.email,
            machine_id=db_machine.id,
            image_identifier=db_image.identifier,
            runner_pool_size=db_image.runner_pool_size
        )
