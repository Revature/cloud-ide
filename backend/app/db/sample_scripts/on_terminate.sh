#!/bin/bash
# Script to commit and push changes on runner termination

# Function to report errors back to the monolith
report_error() {
    local error_message="$1"
    echo "ERROR: $error_message" >&2
    exit 1  # Exit with non-zero status code to indicate failure
}

# Enable better error reporting but with custom error handling
set +e  # Don't exit immediately on error, let us handle it
exec 2>&1  # Redirect stderr to stdout for better logging

# Set trap to catch errors
trap 'report_error "Termination script failed at line $LINENO"' ERR

echo "Starting GitHub save operations..."

# Try to load configuration from .revature file
REVATURE_CONFIG="/home/ubuntu/.revature"

if [ -f "$REVATURE_CONFIG" ]; then
    echo "Loading configuration from .revature file..."
    source "$REVATURE_CONFIG"
    
    # Check if required variables were loaded
    if [ -n "$REPO_NAME" ] && [ -n "$REPO_URL" ] && [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_USERNAME" ]; then
        echo "Successfully loaded configuration from .revature file"
    else
        echo "Configuration file exists but is missing required variables, trying to extract them..."
    fi
else
    echo "No .revature configuration file found, trying to extract variables directly..."
fi

# If variables weren't loaded from .revature, try to extract them
if [ -z "$REPO_NAME" ]; then
    REPO_NAME="{{ git_repo_name }}"
    echo "Extracted REPO_NAME from template variables: $REPO_NAME"
fi

if [ -z "$REPO_URL" ]; then
    REPO_URL="{{ git_url }}"
    echo "Extracted REPO_URL from template variables: $REPO_URL"
fi

if [ -z "$REPO_PATH" ]; then
    REPO_PATH="/home/ubuntu/$REPO_NAME"
    echo "Constructed REPO_PATH: $REPO_PATH"
fi

# If credentials weren't loaded from .revature, try other sources
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_USERNAME" ]; then
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
fi

# Set a default commit message
COMMIT_MESSAGE="Auto-save from cloud IDE on $(date +'%Y-%m-%d %H:%M:%S')"

# Check if required variables are set
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_USERNAME" ]; then
    report_error "GitHub credentials not found in configuration. Cannot proceed with save operations."
fi

# Check if repository path exists
if [ ! -d "$REPO_PATH" ]; then
    report_error "Repository directory not found at $REPO_PATH. Cannot proceed with save operations."
fi

cd "$REPO_PATH" || report_error "Failed to change directory to $REPO_PATH"

# Check if there are any changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit. Exiting."
    echo "SUCCESS: No changes to save, clean termination."
    exit 0
fi

echo "Changes detected, attempting to save..."

# Set proper permissions for the .git directory
echo "Setting proper permissions for the .git directory..."
chmod -R u+rwX .git || echo "Warning: Unable to set permissions for .git directory"

# Configure the repository with authentication
echo "Configuring repository with authentication..."
AUTH_REMOTE_URL=$(echo "$REPO_URL" | sed "s/https:\/\//https:\/\/$GITHUB_USERNAME:$GITHUB_TOKEN@/")

# Ensure the origin remote is set correctly with authentication
git remote remove origin 2>/dev/null || true
git remote add origin "$AUTH_REMOTE_URL" || report_error "Failed to set remote origin"

# Fix ownership and permissions if needed
echo "Ensuring proper ownership of repository files..."
sudo chown -R ubuntu:ubuntu "$REPO_PATH" || echo "Warning: Unable to change ownership (continuing anyway)"

# Add all changes
git add --all || report_error "Failed to add changes to git staging"

# Try to fix Git configuration if needed
git config --global core.editor "true"
git config --global commit.gpgsign false
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_USERNAME@github.com"

# Commit changes using -m to avoid COMMIT_EDITMSG
echo "Committing changes with message: $COMMIT_MESSAGE"
if ! git commit -m "$COMMIT_MESSAGE"; then
    # Try alternative approach if direct commit fails
    echo "Direct commit failed, trying alternative approach..."
    # Create commit by manually specifying all components
    tree=$(git write-tree)
    parent=$(git rev-parse HEAD 2>/dev/null || echo "")
    parent_arg=""
    if [ -n "$parent" ]; then
        parent_arg="-p $parent"
    fi
    commit=$(echo "$COMMIT_MESSAGE" | git commit-tree $tree $parent_arg)
    git update-ref HEAD $commit || report_error "Failed to update HEAD reference"
    echo "Created commit using alternative method: $commit"
fi

# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
    CURRENT_BRANCH="main"
fi
echo "Current branch: $CURRENT_BRANCH"

# Set up tracking for the current branch
git branch --set-upstream-to=origin/$CURRENT_BRANCH $CURRENT_BRANCH 2>/dev/null || true

# Push to the repository (try current branch first, then common branches)
echo "Pushing changes to repository..."
if git push origin $CURRENT_BRANCH 2>/dev/null; then
    echo "Successfully pushed changes to $CURRENT_BRANCH branch"
elif git push origin main 2>/dev/null; then
    echo "Successfully pushed changes to main branch"
elif git push origin master 2>/dev/null; then
    echo "Successfully pushed changes to master branch"
elif git push -u origin HEAD; then
    echo "Successfully pushed changes to origin HEAD"
else
    report_error "Failed to push changes to any branch"
fi

echo "GitHub operations completed successfully."
echo "SUCCESS: All changes saved, clean termination."
exit 0