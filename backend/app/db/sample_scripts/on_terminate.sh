#!/bin/bash
# Script to commit and push changes on runner termination

# Function to report errors in a format that script_management.py can understand
report_error() {
    local error_message="$1"
    echo "ERROR: $error_message" >&2
    exit 1
}

# Function to report success in a format that script_management.py can understand
report_success() {
    local success_message="$1"
    echo "SUCCESS: $success_message"
    exit 0
}

# Enable better error reporting with specific context
set -o pipefail  # Ensures pipeline failures are caught

echo "Starting GitHub save operations..."

# Load configuration from .revature file
REVATURE_CONFIG="/home/ubuntu/.revature"
echo "Looking for configuration file at $REVATURE_CONFIG"

if [ -f "$REVATURE_CONFIG" ]; then
    echo "Configuration file found, loading settings..."
    source "$REVATURE_CONFIG"
    echo "Configuration loaded successfully"
    
    # Log what we found (without sensitive data)
    echo "Found repository name: $REPO_NAME"
    echo "Found repository path: $REPO_PATH"
    echo "Found GitHub username: $GIT_USERNAME"

    # Check for both variable naming conventions (new and old)
    if [ -n "$GIT_ACCESS_TOKEN" ]; then
        echo "GitHub token: Present (using GIT_ACCESS_TOKEN)"
        GITHUB_TOKEN="$GIT_ACCESS_TOKEN"
        GITHUB_USERNAME="$GIT_USERNAME"
    elif [ -n "$GITHUB_TOKEN" ]; then
        echo "GitHub token: Present (using GITHUB_TOKEN)"
    else
        echo "GitHub token: Missing"
    fi
else
    report_error "No .revature configuration file found at $REVATURE_CONFIG"
fi

# Check if required variables are set - accommodate both naming conventions
if [ -z "$GITHUB_TOKEN" ] && [ -z "$GIT_ACCESS_TOKEN" ]; then
    report_error "GitHub token missing in configuration"
fi

if [ -z "$GITHUB_USERNAME" ] && [ -z "$GIT_USERNAME" ]; then
    report_error "GitHub username missing in configuration"
fi

# Use the new variable names if available, fall back to old ones if needed
GITHUB_TOKEN=${GIT_ACCESS_TOKEN:-$GITHUB_TOKEN}
GITHUB_USERNAME=${GIT_USERNAME:-$GITHUB_USERNAME}

if [ -z "$REPO_NAME" ]; then
    report_error "Repository name missing in configuration"
fi

if [ -z "$REPO_PATH" ]; then
    # Construct repo path if not defined in config
    REPO_PATH="/home/ubuntu/$REPO_NAME"
    echo "Repository path not found in config, using constructed path: $REPO_PATH"
fi

# Check if repository exists
if [ ! -d "$REPO_PATH" ]; then
    report_error "Repository directory not found at $REPO_PATH"
fi

echo "Changing to repository directory: $REPO_PATH"
cd "$REPO_PATH" || report_error "Failed to change directory to $REPO_PATH"

# Check if there are any changes to commit
echo "Checking for uncommitted changes..."
if [ -z "$(sudo git status --porcelain)" ]; then
    echo "No changes to commit. Exiting."
    report_success "No changes to save, clean termination"
fi

# Fix permissions on .git directory
echo "Setting permissions on .git directory..."
sudo chmod -R u+rwX .git 2>/dev/null || echo "Warning: Unable to fix permissions (continuing anyway)"

# Configure Git to avoid permission issues
echo "Configuring Git settings..."
sudo git config --global core.editor "true"
sudo git config --global user.name "$GITHUB_USERNAME"
sudo git config --global user.email "$GITHUB_USERNAME@github.com"
sudo git config --global --add safe.directory "$REPO_PATH"

# Make sure credential helper is set
sudo git config --global credential.helper store

# Simple commit and push
COMMIT_MESSAGE="Auto-save from cloud IDE on $(date +'%Y-%m-%d %H:%M:%S')"
echo "Committing changes with message: $COMMIT_MESSAGE"

echo "Adding files to staging area..."
if ! sudo git add --all; then
    report_error "Failed to add changes to git staging"
fi

echo "Committing changes..."
if ! sudo git commit -m "$COMMIT_MESSAGE"; then
    report_error "Failed to commit changes"
fi

echo "Pushing changes to remote repository..."
# Try to push using credential helper first
if ! sudo git push origin HEAD; then
    # If push fails, try with explicit credentials
    echo "Initial push failed, trying with explicit authentication..."

    if [ -n "$REPO_URL" ]; then
        # Create a temporary remote with authentication
        AUTH_REMOTE_URL="https://$GITHUB_USERNAME:$GITHUB_TOKEN@${REPO_URL#https://}"
        
        # Use the temporary remote to push
        if ! sudo git push "$AUTH_REMOTE_URL" HEAD; then
            report_error "Failed to push changes using explicit authentication"
        fi
    else
        report_error "Failed to push changes and no REPO_URL available for fallback"
    fi
fi

echo "GitHub operations completed successfully."
report_success "All changes saved, clean termination"