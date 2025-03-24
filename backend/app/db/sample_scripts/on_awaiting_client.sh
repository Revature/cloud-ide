#!/bin/bash
# Script to set up environment variables and clone repository
# This should run during the "on_awaiting_client" phase

# Function to report errors back to the monolith
report_error() {
    local error_message="$1"
    echo "ERROR: $error_message" >&2
    exit 1  # Exit with non-zero status code to indicate failure
}

# Function to report success in a format that script_management.py can understand
report_success() {
    local success_message="$1"
    echo "SUCCESS: $success_message"
    exit 0
}

# Enable better error reporting but with custom error handling
set +e  # Don't exit immediately on error, let us handle it
exec 2>&1  # Redirect stderr to stdout for better logging

# Set trap to catch errors
trap 'report_error "Script failed at line $LINENO"' ERR

echo "Setting up environment and cloning repository..."

# Extract variables from script vars (directly in context)
REPO_URL="{{ git_url }}"
REPO_NAME="{{ git_repo_name }}"
USER_IP="{{ user_ip }}"
REPO_PATH="/home/ubuntu/$REPO_NAME"

# Extract environment variables from the new payload structure
GIT_ACCESS_TOKEN="{{ env_vars.git_access_token }}"
GIT_USERNAME="{{ env_vars.git_username }}"
HOST="{{ env_vars.HOST }}"
TRAINEE_CODING_LAB_ID="{{ env_vars.TRAINEE_CODING_LAB_ID }}"
PROJECT_TYPE="{{ env_vars.PROJECT_TYPE }}"
GITPOD_WORKSPACE_CONTEXT_URL="{{ env_vars.GITPOD_WORKSPACE_CONTEXT_URL }}"
REVPRO_WORKSPACE_ID="{{ env_vars.REVPRO_WORKSPACE_ID }}"
INTERN_ID="{{ env_vars.INTERN_ID }}"
TOKEN="{{ env_vars.TOKEN }}"

# Create .revature config file in ubuntu home directory
REVATURE_CONFIG="/home/ubuntu/.revature"

# Write configuration to the .revature file
cat > "$REVATURE_CONFIG" << EOF
GIT_ACCESS_TOKEN="$GIT_ACCESS_TOKEN"
GIT_USERNAME="$GIT_USERNAME"
GITHUB_TOKEN="$GIT_ACCESS_TOKEN"
GITHUB_USERNAME="$GIT_USERNAME"
REPO_URL="$REPO_URL"
REPO_NAME="$REPO_NAME"
REPO_PATH="$REPO_PATH"
USER_IP="$USER_IP"
HOST="$HOST"
TRAINEE_CODING_LAB_ID="$TRAINEE_CODING_LAB_ID"
PROJECT_TYPE="$PROJECT_TYPE"
GITPOD_WORKSPACE_CONTEXT_URL="$GITPOD_WORKSPACE_CONTEXT_URL"
REVPRO_WORKSPACE_ID="$REVPRO_WORKSPACE_ID"
INTERN_ID="$INTERN_ID"
TOKEN="$TOKEN"
EOF

# Make the config file readable by both ubuntu and root
chmod 644 "$REVATURE_CONFIG"

# Source the configuration file to make variables available in this session
source "$REVATURE_CONFIG"

# Add to ubuntu's .bashrc for persistence across sessions
if ! grep -q "source $REVATURE_CONFIG" /home/ubuntu/.bashrc; then
    cat >> /home/ubuntu/.bashrc << EOF

# Revature environment configuration
source "$REVATURE_CONFIG"
EOF
fi

# Create a root version of the config for root to source
# This avoids permission issues with .bashrc
sudo bash -c "cat > /root/.revature << EOF
GIT_ACCESS_TOKEN=\"$GIT_ACCESS_TOKEN\"
GIT_USERNAME=\"$GIT_USERNAME\"
GITHUB_TOKEN=\"$GIT_ACCESS_TOKEN\"
GITHUB_USERNAME=\"$GIT_USERNAME\"
REPO_URL=\"$REPO_URL\"
REPO_NAME=\"$REPO_NAME\"
REPO_PATH=\"$REPO_PATH\"
USER_IP=\"$USER_IP\"
HOST=\"$HOST\"
TRAINEE_CODING_LAB_ID=\"$TRAINEE_CODING_LAB_ID\"
PROJECT_TYPE=\"$PROJECT_TYPE\"
GITPOD_WORKSPACE_CONTEXT_URL=\"$GITPOD_WORKSPACE_CONTEXT_URL\"
REVPRO_WORKSPACE_ID=\"$REVPRO_WORKSPACE_ID\"
INTERN_ID=\"$INTERN_ID\"
TOKEN=\"$TOKEN\"
EOF"

# Add to root's .bashrc the proper way
sudo bash -c "if ! grep -q \"source /root/.revature\" /root/.bashrc; then
    echo '
# Revature environment configuration
source /root/.revature' >> /root/.bashrc
fi"

# Configure git globally for ubuntu user
git config --global user.name "$GIT_USERNAME"
git config --global user.email "$GIT_USERNAME@github.com"
git config --global credential.helper store
git config --global --add safe.directory "$REPO_PATH"

# Configure git globally for root user
sudo git config --global user.name "$GIT_USERNAME"
sudo git config --global user.email "$GIT_USERNAME@github.com"
sudo git config --global credential.helper store
sudo git config --global --add safe.directory "$REPO_PATH"

GIT_CREDENTIALS_PATH="/home/ubuntu/.git-credentials"
ROOT_GIT_CREDENTIALS_PATH="/root/.git-credentials"

# Store GitHub credentials for ubuntu user
if [[ "$REPO_URL" == *"github.com"* ]]; then
    echo "https://$GIT_USERNAME:$GIT_ACCESS_TOKEN@github.com" > "$GIT_CREDENTIALS_PATH"
    chmod 600 "$GIT_CREDENTIALS_PATH"
    
    # Also for root user
    echo "https://$GIT_USERNAME:$GIT_ACCESS_TOKEN@github.com" | sudo tee "$ROOT_GIT_CREDENTIALS_PATH" > /dev/null
    sudo chmod 600 "$ROOT_GIT_CREDENTIALS_PATH"
    
    echo "Stored GitHub credentials for both ubuntu and root users"
fi

# Check if the repository already exists
if [ -d "$REPO_PATH" ]; then
    echo "Repository directory already exists at $REPO_PATH"
    
    # Check if it's actually a git repository
    if [ -d "$REPO_PATH/.git" ]; then
        echo "Existing git repository found. Pulling latest changes..."
        cd "$REPO_PATH"
        git pull
    else
        echo "Directory exists but is not a git repository. Removing and cloning..."
        rm -rf "$REPO_PATH"
        # Continue to clone below
    fi
fi

# Clone the repository if it doesn't exist or wasn't a valid git repo
if [ ! -d "$REPO_PATH" ]; then
    echo "Cloning repository from $REPO_URL..."
    # For GitHub repositories
    AUTH_REPO_URL=$(echo "$REPO_URL" | sed "s/https:\/\//https:\/\/$GIT_USERNAME:$GIT_ACCESS_TOKEN@/")
    if ! git clone "$AUTH_REPO_URL" "$REPO_PATH"; then
        report_error "Failed to clone repository from $REPO_URL"
    fi
fi

# Setup Git hooks for tracking commit history and test cases
echo "Setting up Git hooks for tracking commit history and test cases..."
cd "$REPO_PATH"

# Make the repository readable by both ubuntu and root
sudo chmod -R 755 "$REPO_PATH"
sudo chmod -R 755 "$REPO_PATH/.git"

# Mark the repository as safe for both users
git config --global --add safe.directory "$REPO_PATH"
sudo git config --global --add safe.directory "$REPO_PATH"

# Create post-commit hook to track commit history and run tests
cat <<'EOF' > .git/hooks/post-commit
#!/bin/bash
echo "Running post-commit hook..."

# Push changes
echo "Pushing changes to remote repository..."
git push

# Log commit history
echo "Generating commit history log..."
git log -1 --shortstat > history_log.txt

echo "Post-commit hook completed"
EOF
chmod +x .git/hooks/post-commit

# Verify the post-commit hook was created correctly
if [ -x .git/hooks/post-commit ]; then
    echo "Post-commit hook created successfully"
else
    echo "Warning: Failed to create executable post-commit hook"
fi

echo "Git hooks configured for history and test case tracking"

# Make sure hook scripts are executable by both users
sudo chmod a+x .git/hooks/post-commit

echo "Environment setup and repository clone completed successfully!"

# Verify the .revature file exists and is properly set up
echo "Verifying .revature configuration file:"
if [ -f "$REVATURE_CONFIG" ]; then
    echo "Configuration file exists and is properly set up at $REVATURE_CONFIG"
else
    report_error ".revature configuration file was not created properly"
fi

# Verify the root .revature file exists
if sudo test -f "/root/.revature"; then
    echo "Root configuration file exists and is properly set up at /root/.revature"
else
    report_error "Root configuration file was not created properly"
fi

# Verify hooks existence
echo "Verifying Git hooks:"
if [ ! -x "$REPO_PATH/.git/hooks/post-commit" ]; then
    report_error "post-commit hook not found or not executable!"
fi

echo "Git hooks verified successfully."

# Return to home directory
cd ~

# If we've reached this point without errors, the script was successful
report_success "Environment setup and repository clone completed successfully!"