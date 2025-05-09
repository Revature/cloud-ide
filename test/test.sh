#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
TEST_DIR="$SCRIPT_DIR"
LOGS_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOGS_DIR"

# Default values
TEST_TYPE="sanity"
MAX_WAIT_TIME=120
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_PREFIX="${LOGS_DIR}/${TIMESTAMP}_${TEST_TYPE}"

# Handle script termination
trap 'echo -e "\n${YELLOW}Script interrupted. Cleaning up...${NC}"; 
      [ -f "$MYSQL_TEMP_CNF" ] && rm -f "$MYSQL_TEMP_CNF"; 
      docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down; 
      exit 1' SIGINT SIGTERM

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -t|--test-type) TEST_TYPE="$2"; shift 2 ;;
    -w|--wait) MAX_WAIT_TIME="$2"; shift 2 ;;
    -h|--help) 
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -t, --test-type TYPE     Specify test type (default: sanity)"
      echo "  -w, --wait TIME          Maximum wait time in seconds (default: 120)"
      echo "  -h, --help               Display this help message"
      exit 1 ;;
    *) TEST_TYPE="$1"; shift ;;
  esac
done

# Check for test directory and feature files
if [ ! -d "$TEST_DIR/$TEST_TYPE" ]; then
  echo -e "${RED}Error: Test type directory '$TEST_TYPE' not found in $TEST_DIR${NC}"
  echo "Available test types:"
  ls -1 "$TEST_DIR" | grep -v logs
  exit 1
fi

# Check for at least one feature file
FEATURE_COUNT=$(find "$TEST_DIR/$TEST_TYPE" -name "*.feature" | wc -l)
if [ "$FEATURE_COUNT" -eq 0 ]; then
  echo -e "${RED}Error: No feature files found in $TEST_DIR/$TEST_TYPE${NC}"
  exit 1
fi

# Setup and teardown SQL
SETUP_SQL="$TEST_DIR/$TEST_TYPE/setup.sql"
TEARDOWN_SQL="$TEST_DIR/$TEST_TYPE/teardown.sql"

# Stop and start containers
echo "Building and starting containers..."
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" build
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" up -d

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend service...${NC}"
for ((i=1; i<=MAX_WAIT_TIME/2; i++)); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/docs 2>/dev/null | grep -q '200\|301\|302'; then
    echo -e "\n${GREEN}Backend service is ready!${NC}"
    break
  fi
  echo -n "."
  sleep 2
  if [ $i -eq $((MAX_WAIT_TIME/2)) ]; then
    echo -e "\n${RED}Backend service failed to start.${NC}"
    docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
    exit 1
  fi
done

# Load database connection info
if [ ! -f "$SCRIPT_DIR/../.env" ]; then
  echo -e "${RED}Error: .env file not found${NC}"
  docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
  exit 1
fi

source "$SCRIPT_DIR/../.env"

# Parse connection string and create temp MySQL config
parse_db_url() {
  if [[ "$DATABASE_URL" == *"://"* ]]; then
    local rest="${DATABASE_URL#*://}"
    local auth="${rest%%@*}"
    local server="${rest#*@}"
    
    local username="${auth%%:*}"
    local password="${auth#*:}"
    local host="${server%%:*}"
    local port_db="${server#*:}"
    local port="${port_db%%/*}"
    local database="${port_db#*/}"
    database="${database%%\?*}"
    
    echo "HOST=$host PORT=$port USER=$username PASSWORD=$password DATABASE=$database"
  else
    return 1
  fi
}

eval $(parse_db_url)

# Create MySQL config
MYSQL_TEMP_CNF=$(mktemp)
chmod 600 "$MYSQL_TEMP_CNF"
cat > "$MYSQL_TEMP_CNF" <<EOF
[client]
host=$HOST
user=$USER
password=$PASSWORD
port=$PORT
EOF

# Run setup SQL if exists
[ -f "$SETUP_SQL" ] && mysql --defaults-file="$MYSQL_TEMP_CNF" $DATABASE < "$SETUP_SQL"

# Run Karate tests using CLI
echo -e "${YELLOW}Running Karate tests from $TEST_DIR/$TEST_TYPE...${NC}"
echo "=========== TEST BEGIN ==========="
TEST_START_TIME=$(date +%s)

# Create output directory for Karate
KARATE_OUTPUT="${LOGS_DIR}/karate-${TIMESTAMP}"
mkdir -p "$KARATE_OUTPUT"

# Run Karate CLI with the specific test type directory
karate -e "$TEST_TYPE" -o "$KARATE_OUTPUT" "$TEST_DIR/$TEST_TYPE"
TEST_RESULT=$?

TEST_END_TIME=$(date +%s)
TEST_DURATION=$((TEST_END_TIME - TEST_START_TIME))
TEST_DURATION_FORMATTED=$(printf "%02d:%02d" $((TEST_DURATION/60)) $((TEST_DURATION%60)))

# Output results
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}All tests passed successfully!${NC}"
else
  echo -e "${RED}Tests failed with exit code $TEST_RESULT${NC}"
  
  # Save container logs if failed
  echo "Saving container logs..."
  for CONTAINER_ID in $(docker-compose -f "$SCRIPT_DIR/../local-compose.yml" ps -q); do
    CONTAINER_NAME=$(docker inspect --format '{{.Name}}' $CONTAINER_ID | sed 's/^\///')
    docker logs $CONTAINER_ID > "${LOG_PREFIX}_${CONTAINER_NAME}.log" 2>&1
  done
fi
echo "============ TEST END ============"
echo "Test duration: $TEST_DURATION_FORMATTED (mm:ss)"
echo "Karate test reports available at: $KARATE_OUTPUT"

# Run teardown SQL if exists
[ -f "$TEARDOWN_SQL" ] && mysql --defaults-file="$MYSQL_TEMP_CNF" $DATABASE < "$TEARDOWN_SQL"

# Clean up
rm -f "$MYSQL_TEMP_CNF"
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down

# Write summary
cat > "${LOG_PREFIX}_summary.log" <<EOF
========================================
TEST SUMMARY: ${TEST_TYPE}
Date: $(date)
========================================

RESULT: $([ $TEST_RESULT -eq 0 ] && echo "PASS" || echo "FAIL (exit code: $TEST_RESULT)")

Test directory: $TEST_DIR/$TEST_TYPE
Karate Reports: $KARATE_OUTPUT
Test duration: $TEST_DURATION_FORMATTED (mm:ss)

See individual container logs in: $LOGS_DIR
========================================
EOF

# Print final message
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
TOTAL_DURATION_FORMATTED=$(printf "%02d:%02d" $((TOTAL_DURATION/60)) $((TOTAL_DURATION%60)))
echo -e "${YELLOW}Total execution time: $TOTAL_DURATION_FORMATTED (mm:ss)${NC}"

exit $TEST_RESULT