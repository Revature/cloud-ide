#!/bin/bash
# Script to commit and push changes on runner termination

# Function to report errors back to the monolith
report_error() {
    local error_message="$1"
    echo "ERROR: $error_message" >&2
    exit 1
}

# Basic error handling
set +e
exec 2>&1
trap 'report_error "Termination script failed at line $LINENO"' ERR

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
    echo "Found GitHub username: $GITHUB_USERNAME"
    echo "GitHub token: $(if [ -n "$GITHUB_TOKEN" ]; then echo "Present"; else echo "Missing"; fi)"
else
    echo "WARNING: No .revature configuration file found at $REVATURE_CONFIG"
    echo "Fallback not available - the .revature file is required"
    report_error "Configuration file not found"
fi

# Check if required variables are set
if [ -z "$GITHUB_TOKEN" ]; then
    report_error "GitHub token missing in configuration"
fi

if [ -z "$GITHUB_USERNAME" ]; then
    report_error "GitHub username missing in configuration"
fi

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
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit. Exiting."
    echo "SUCCESS: No changes to save, clean termination."
    exit 0
else
    echo "Uncommitted changes found, proceeding with save operation"
fi

# Fix permissions on .git directory
echo "Setting permissions on .git directory..."
chmod -R u+rwX .git 2>/dev/null || echo "Warning: Unable to fix permissions (continuing anyway)"

# Configure Git to avoid permission issues
echo "Configuring Git settings..."
git config --global core.editor "true"
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_USERNAME@github.com"

# Set up repository remote with authentication
echo "Setting up repository remote with authentication..."
AUTH_REMOTE_URL=$(echo "$REPO_URL" | sed "s/https:\/\//https:\/\/$GITHUB_USERNAME:$GITHUB_TOKEN@/")
git remote remove origin 2>/dev/null || true
git remote add origin "$AUTH_REMOTE_URL"

# Simple commit and push
COMMIT_MESSAGE="Auto-save from cloud IDE on $(date +'%Y-%m-%d %H:%M:%S')"
echo "Committing changes with message: $COMMIT_MESSAGE"

echo "Adding files to staging area..."
if ! git add --all; then
    report_error "Failed to add changes to git staging"
fi

echo "Committing changes..."
if ! git commit -m "$COMMIT_MESSAGE"; then
    report_error "Failed to commit changes"
fi

echo "Pushing changes to remote repository..."
if ! git push origin HEAD; then
    report_error "Failed to push changes"
fi

echo "GitHub operations completed successfully."
echo "SUCCESS: All changes saved, clean termination."
exit 0
