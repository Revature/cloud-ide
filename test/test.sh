#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Set test directory to be the same as script directory
TEST_DIR="$SCRIPT_DIR"

# Default test type
TEST_TYPE="sanity"
TEST_FILE="test.py"  # Fixed test file name

# Parse command line arguments
# Usage: ./run_tests.sh [test_type]
if [ ! -z "$1" ]; then
  TEST_TYPE="$1"
fi

# Check if we need to install mysql client
if ! command -v mysql &> /dev/null; then
  echo "MySQL client not found. Attempting to install..."
  
  # Detect OS and install mysql client
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try with apt-get (Debian/Ubuntu) first, then yum (RHEL/CentOS)
    if command -v apt-get &> /dev/null; then
      sudo apt-get update && sudo apt-get install -y mysql-client
    elif command -v yum &> /dev/null; then
      sudo yum install -y mysql
    else
      echo "Error: Could not install MySQL client. Please install it manually."
      exit 1
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - try with brew
    if command -v brew &> /dev/null; then
      brew install mysql-client
      echo "You may need to add MySQL to your PATH:"
      echo "echo 'export PATH=\"/usr/local/opt/mysql-client/bin:\$PATH\"' >> ~/.zshrc"
    else
      echo "Error: Homebrew not found. Please install MySQL client manually."
      exit 1
    fi
  else
    echo "Error: Unsupported OS for automatic MySQL client installation."
    exit 1
  fi
  
  # Check if installation was successful
  if ! command -v mysql &> /dev/null; then
    echo "Error: Failed to install MySQL client. Please install it manually."
    exit 1
  fi
fi

# Check if test type directory exists
if [ ! -d "$TEST_DIR/$TEST_TYPE" ]; then
  echo "Error: Test type directory '$TEST_TYPE' not found in $TEST_DIR"
  echo "Available test types:"
  ls -1 "$TEST_DIR"
  exit 1
fi

# Path to config file for this test type
CONFIG_FILE="$TEST_DIR/$TEST_TYPE/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config file not found at $CONFIG_FILE"
  exit 1
fi

# Check for setup and teardown SQL scripts
SETUP_SQL="$TEST_DIR/$TEST_TYPE/setup.sql"
TEARDOWN_SQL="$TEST_DIR/$TEST_TYPE/teardown.sql"

# Try to bring down containers, redirect stderr to stdout for logging
echo "Starting docker containers..."
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down & \
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" build web & \
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" build celery-worker & \
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" build celery-beat & \
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" build nginx && \
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" up -d

# Wait for services to be fully initialized
echo "Waiting for services to initialize..."
sleep 20

# Source the .env file from parent directory to get DB connection string
ENV_FILE="$SCRIPT_DIR/../.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
  exit 1
fi

# Source the .env file to get environment variables
source "$ENV_FILE"

# Parse DATABASE_URL connection string
parse_connection_string() {
  local conn_string="$1"
  
  # Check if string contains '://'
  if [[ "$conn_string" == *"://"* ]]; then
    # Split by '://'
    local protocol="${conn_string%%://*}"
    local rest="${conn_string#*://}"
    
    # Handle case where protocol might be 'mysql+pyadmin'
    if [[ "$protocol" == *"+"* ]]; then
      # For mysql+pyadmin:// format, extract actual protocol
      local dialect="${protocol}"
      protocol="${dialect%%+*}"
    fi
    
    # Split auth and server parts by '@'
    local auth_part="${rest%%@*}"
    local server_part="${rest#*@}"
    
    # Split username and password
    local username="${auth_part%%:*}"
    local password="${auth_part#*:}"
    
    # Split host, port and database
    local host_port="${server_part%%/*}"
    
    # Handle case where there's no database specified
    local database=""
    if [[ "$server_part" == *"/"* ]]; then
      database="${server_part#*/}"
      # Handle query parameters in database name
      database="${database%%\?*}"
      # Remove quotes, carriage returns, and other control characters
      database=$(echo "$database" | tr -d "'\"" | tr -d '\r')
    fi
    
    # Split host and port
    local host="${host_port%%:*}"
    local port
    if [[ "$host_port" == *":"* ]]; then
      port="${host_port#*:}"
    else
      port="3306"  # Default MySQL port
    fi
    # Return the variables in a format that can be evaluated
    echo "HOST=\"$host\"; USERNAME=\"$username\"; PASSWORD=\"$password\"; PORT=\"$port\"; DATABASE=\"$database\";"
  else
    echo "ERROR: Invalid connection string format"
    return 1
  fi
}

# Extract connection parameters from DATABASE_URL
if ! connection_info=$(parse_connection_string "$DATABASE_URL"); then
  echo "Error parsing DATABASE_URL: $connection_info"
  docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
  exit 1
fi

# Load connection variables
eval "$connection_info"

# Check essential connection parameters
if [ -z "$HOST" ] || [ -z "$USERNAME" ] || [ -z "$DATABASE" ]; then
  echo "Error: Missing essential database connection parameters"
  echo "Parsed connection info:"
  echo "$connection_info"
  docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
  exit 1
fi

# Use these variables
DB_HOST="$HOST"
DB_USER="$USERNAME"
DB_PASSWORD="$PASSWORD"
DB_PORT="$PORT"
DB_NAME="$DATABASE"


# Set default port if not specified
if [ -z "$DB_PORT" ]; then
  DB_PORT="3306"
fi

# Add option to choose MySQL client path if standard command fails
MYSQL_CMD="mysql"

# Run setup SQL if it exists
if [ -f "$SETUP_SQL" ]; then
  echo "Connection parameters:"
  echo "  Host: $DB_HOST"
  echo "  User: $DB_USER"
  echo "  Port: $DB_PORT"
  echo "  Database: $DB_NAME"
  
  # Show available databases
  # Actually execute it with the real password - FIXED COMMAND SYNTAX
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -P "$DB_PORT" $DB_NAME < "$SETUP_SQL"
  SETUP_RESULT=$?
  
  if [ $SETUP_RESULT -ne 0 ]; then
    echo "Setup SQL failed with exit code $SETUP_RESULT"
    echo "Database connection failed. Please check your credentials and database name."
    docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
    exit 1
  else
    echo "Setup SQL executed successfully"
  fi
fi

# Try to print the actual test.py file to help debug
if [ -f "$TEST_DIR/$TEST_TYPE/test.py" ]; then
  echo "Found test.py at: $TEST_DIR/$TEST_TYPE/test.py"
else
  echo "ERROR: test.py not found at: $TEST_DIR/$TEST_TYPE/test.py"
  exit 1
fi

# Run tests with explicit path to config file
echo "Running tests from $TEST_DIR/$TEST_TYPE/test.py..."
echo "=========== TEST BEGIN ==========="
python "$TEST_DIR/$TEST_TYPE/$TEST_FILE" "$CONFIG_FILE"
TEST_RESULT=$?

# Check test results
if [ $TEST_RESULT -ne 0 ]; then
  echo "Tests failed with exit code $TEST_RESULT"
else
  echo "All tests passed successfully!"
fi
echo "============ TEST END ============"

# Run teardown SQL if it exists, regardless of test result
if [ -f "$TEARDOWN_SQL" ]; then
    
  # Actually execute it with the real password - FIXED COMMAND SYNTAX
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -P "$DB_PORT" $DB_NAME < "$TEARDOWN_SQL"
  TEARDOWN_RESULT=$?
  
  if [ $TEARDOWN_RESULT -ne 0 ]; then
    echo "Warning: Teardown SQL failed with exit code $TEARDOWN_RESULT"
  else
    echo "Teardown SQL executed successfully"
  fi
fi

# Check test results and dump logs if failed
if [ $TEST_RESULT -ne 0 ]; then
  echo "Tests failed with exit code $TEST_RESULT"
  echo ""
  echo "=========== DOCKER LOGS ==========="
  # Get all running container IDs from this docker-compose project
  CONTAINERS=$(docker-compose -f "$SCRIPT_DIR/../local-compose.yml" ps -q)
  for CONTAINER_ID in $CONTAINERS; do
    # Get container name for better log identification
    CONTAINER_NAME=$(docker inspect --format '{{.Name}}' $CONTAINER_ID | sed 's/^\///')
    echo ""
    echo "===== Logs for container: $CONTAINER_NAME ====="
    docker logs $CONTAINER_ID
  done
  echo "======================================="
else
  echo "All tests passed successfully!"
fi

# Always shut down containers after tests, regardless of test result
echo "Shutting down containers..."
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down