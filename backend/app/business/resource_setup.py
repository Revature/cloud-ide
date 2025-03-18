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

        # Add t4g.medium ARM-based machine
        stmt_t4g_machine = select(Machine).where(Machine.identifier == "t4g.medium")
        t4g_machine = session.exec(stmt_t4g_machine).first()
        if not t4g_machine:
            t4g_machine = Machine(
                name="t4g.medium",
                identifier="t4g.medium",
                cpu_count=2,
                memory_size=4096,  # 4GB RAM
                storage_size=20,    # 20GB storage
                cloud_connector_id=cloud_connector.id,
                created_by="system",
                modified_by="system"
            )
            session.add(t4g_machine)
            session.commit()
            session.refresh(t4g_machine)

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

        # Add new ARM-based image
        stmt_arm_image = select(Image).where(Image.identifier == "ami-08d4be6f210cf1976")
        arm_image = session.exec(stmt_arm_image).first()
        if not arm_image:
            arm_image = Image(
                name="arm64-dev-image",
                description="ARM64-based development image for t4g instances",
                identifier="ami-08d4be6f210cf1976",
                runner_pool_size=1,  # Start with same pool size
                machine_id=t4g_machine.id,  # Link to t4g.medium machine
                cloud_connector_id=cloud_connector.id,
                created_by="system",
                modified_by="system"
            )
            session.add(arm_image)
            session.commit()
            session.refresh(arm_image)

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
USER_IP="{{ user_ip }}"
REPO_PATH="/home/ubuntu/$REPO_NAME"

# Extract environment variables from the new payload structure
GIT_ACCESS_TOKEN="{{ env_vars.git_access_token }}"
GIT_USERNAME="{{ env_vars.git_username }}"
HOST_B64="{{ env_vars.HOST }}"
TRAINEE_ID_B64="{{ env_vars.TRAINEE_CODING_LAB_ID }}"
PROJECT_TYPE_B64="{{ env_vars.PROJECT_TYPE }}"
GITPOD_WORKSPACE_URL="{{ env_vars.GITPOD_WORKSPACE_CONTEXT_URL }}"
REVPRO_WORKSPACE_ID="{{ env_vars.REVPRO_WORKSPACE_ID }}"

# Create a file to store environment variables
ENV_FILE="/home/ubuntu/.env_vars"
GITHUB_ENV_FILE="/home/ubuntu/.github_env"

# Write environment variables to file
cat > "$ENV_FILE" << EOF
export GIT_ACCESS_TOKEN="$GIT_ACCESS_TOKEN"
export GIT_USERNAME="$GIT_USERNAME"
export HOST="$HOST_B64"
export TRAINEE_CODING_LAB_ID="$TRAINEE_ID_B64"
export PROJECT_TYPE="$PROJECT_TYPE_B64"
export GITPOD_WORKSPACE_CONTEXT_URL="$GITPOD_WORKSPACE_URL"
export REVPRO_WORKSPACE_ID="$REVPRO_WORKSPACE_ID"
export USER_IP="$USER_IP"
EOF

# Write GitHub specific variables to a separate file for git operations
cat > "$GITHUB_ENV_FILE" << EOF
export GITHUB_TOKEN="$GIT_ACCESS_TOKEN"
export GITHUB_USERNAME="$GIT_USERNAME"
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
export GIT_USERNAME="$GIT_USERNAME"
export HOST="$HOST_B64"
export TRAINEE_CODING_LAB_ID="$TRAINEE_ID_B64"
export PROJECT_TYPE="$PROJECT_TYPE_B64"
export GITPOD_WORKSPACE_CONTEXT_URL="$GITPOD_WORKSPACE_URL"
export REVPRO_WORKSPACE_ID="$REVPRO_WORKSPACE_ID"
export USER_IP="$USER_IP"
export GITHUB_TOKEN="$GIT_ACCESS_TOKEN"
export GITHUB_USERNAME="$GIT_USERNAME"

# Configure git globally for this user
git config --global user.name "$GIT_USERNAME"
git config --global user.email "$GIT_USERNAME@github.com"
git config --global credential.helper store

# Add to system-wide environment if possible
if [ -f "/etc/environment" ] && [ -w "/etc/environment" ]; then
    # Try to append to /etc/environment if writable
    grep -q "GIT_ACCESS_TOKEN" /etc/environment || echo "GIT_ACCESS_TOKEN=$GIT_ACCESS_TOKEN" | sudo tee -a /etc/environment > /dev/null
    grep -q "GIT_USERNAME" /etc/environment || echo "GIT_USERNAME=$GIT_USERNAME" | sudo tee -a /etc/environment > /dev/null
    grep -q "HOST" /etc/environment || echo "HOST=$HOST_B64" | sudo tee -a /etc/environment > /dev/null
    grep -q "TRAINEE_CODING_LAB_ID" /etc/environment || echo "TRAINEE_CODING_LAB_ID=$TRAINEE_ID_B64" | sudo tee -a /etc/environment > /dev/null
    grep -q "PROJECT_TYPE" /etc/environment || echo "PROJECT_TYPE=$PROJECT_TYPE_B64" | sudo tee -a /etc/environment > /dev/null
    grep -q "GITPOD_WORKSPACE_CONTEXT_URL" /etc/environment || echo "GITPOD_WORKSPACE_CONTEXT_URL=$GITPOD_WORKSPACE_URL" | sudo tee -a /etc/environment > /dev/null
    grep -q "REVPRO_WORKSPACE_ID" /etc/environment || echo "REVPRO_WORKSPACE_ID=$REVPRO_WORKSPACE_ID" | sudo tee -a /etc/environment > /dev/null
    grep -q "USER_IP" /etc/environment || echo "USER_IP=$USER_IP" | sudo tee -a /etc/environment > /dev/null
elif [ -d "/etc/profile.d" ]; then
    # Fallback to profile.d
    sudo tee /etc/profile.d/cloudide.sh > /dev/null << EOF
export GIT_ACCESS_TOKEN="$GIT_ACCESS_TOKEN"
export GIT_USERNAME="$GIT_USERNAME"
export HOST="$HOST_B64"
export TRAINEE_CODING_LAB_ID="$TRAINEE_ID_B64"
export PROJECT_TYPE="$PROJECT_TYPE_B64"
export GITPOD_WORKSPACE_CONTEXT_URL="$GITPOD_WORKSPACE_URL"
export REVPRO_WORKSPACE_ID="$REVPRO_WORKSPACE_ID"
export USER_IP="$USER_IP"
EOF
    sudo chmod +x /etc/profile.d/cloudide.sh
fi

# Clone the repository
echo "Cloning repository from $REPO_URL..."

# Use the token for authentication with the proper username
if [[ "$REPO_URL" == *"github.com"* ]]; then
    # For GitHub repositories
    AUTH_REPO_URL=$(echo "$REPO_URL" | sed "s/https:\/\//https:\/\/$GIT_USERNAME:$GIT_ACCESS_TOKEN@/")
    git clone "$AUTH_REPO_URL" "$REPO_PATH"
    
    # Save credentials for future git operations
    mkdir -p /home/ubuntu/.git-credentials
    echo "https://$GIT_USERNAME:$GIT_ACCESS_TOKEN@github.com" > /home/ubuntu/.git-credentials
    chmod 600 /home/ubuntu/.git-credentials
else
    # For non-GitHub repositories, use default approach
    git clone "$REPO_URL" "$REPO_PATH"
fi

# Setup Git hooks for tracking commit history and test cases
echo "Setting up Git hooks for tracking commit history and test cases..."
cd "$REPO_PATH"

# Create post-commit hook to track commit history and run tests
cat <<EOF >.git/hooks/post-commit
#!/bin/bash
git push
git log -1 --shortstat > history_log.txt
mvn test >testCases_log.txt
EOF
chmod +x .git/hooks/post-commit

# Create a simple pre-commit hook for potential future use
cat <<EOF >.git/hooks/pre-commit
#!/bin/bash
# This is a placeholder for pre-commit actions
# No SSH key configuration needed as we're using HTTPS with token
EOF
chmod +x .git/hooks/pre-commit

echo "Git hooks successfully configured for history and test case tracking"
cd ~

# Create a welcome message for the user
cat > /home/ubuntu/welcome.txt << EOF
Welcome to your Cloud IDE environment!

Your repository "$REPO_NAME" has been cloned and is ready for use.
Environment variables have been set up for your session.

Repository path: $REPO_PATH
EOF

echo "Environment setup and repository clone completed successfully!"

# Verify environment variables are set correctly
echo "Verifying environment variables:"
printenv | grep -E 'GIT_ACCESS_TOKEN|GIT_USERNAME|HOST|TRAINEE_CODING_LAB_ID|PROJECT_TYPE|GITHUB_TOKEN|REVPRO_WORKSPACE_ID|GITPOD_WORKSPACE_CONTEXT_URL'

exit 0""",
                created_by="system",
                modified_by="system"
            )
            session.add(awaiting_client_script)
            session.commit()
            session.refresh(awaiting_client_script)

        # Add the same script for ARM image if it doesn't exist
        if arm_image:
            stmt_arm_script = select(Script).where(Script.event == "on_awaiting_client", Script.image_id == arm_image.id)
            arm_awaiting_client_script = session.exec(stmt_arm_script).first()
            if not arm_awaiting_client_script:
                # Clone the script for the ARM image, using the same script content
                arm_awaiting_client_script = Script(
                    name="Git Clone Script (ARM)",
                    description="Clones a repository specified in runner env_data under 'repo_url' for ARM instances",
                    event="on_awaiting_client",
                    image_id=arm_image.id,
                    script=awaiting_client_script.script,  # Reuse the same script content
                    created_by="system",
                    modified_by="system"
                )
                session.add(arm_awaiting_client_script)
                session.commit()
                session.refresh(arm_awaiting_client_script)

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

        # Add the same termination script for ARM image if it doesn't exist
        if arm_image:
            stmt_arm_script = select(Script).where(Script.event == "on_terminate", Script.image_id == arm_image.id)
            arm_termination_script = session.exec(stmt_arm_script).first()
            if not arm_termination_script:
                # Clone the script for the ARM image, using the same script content
                arm_termination_script = Script(
                    name="GitHub Save Script (ARM)",
                    description="Commits and pushes changes to GitHub on termination for ARM instances",
                    event="on_terminate",
                    image_id=arm_image.id,
                    script=termination_script.script,  # Reuse the same script content
                    created_by="system",
                    modified_by="system"
                )
                session.add(arm_termination_script)
                session.commit()
                session.refresh(arm_termination_script)

        return Resources(
            system_user_email=system_user.email,
            machine_id=db_machine.id,
            image_identifier=db_image.identifier,
            runner_pool_size=db_image.runner_pool_size
        )
