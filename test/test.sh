#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOGS_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOGS_DIR"

# Default values
MAX_WAIT_TIME=120
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_PREFIX="${LOGS_DIR}/${TIMESTAMP}"
SINGLE_TEST=""

# Handle script termination
trap 'echo -e "\n${YELLOW}Script interrupted. Cleaning up...${NC}"; 
      [ -f "$MYSQL_TEMP_CNF" ] && rm -f "$MYSQL_TEMP_CNF"; 
      docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down; 
      exit 1' SIGINT SIGTERM

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -t|--test) SINGLE_TEST="$2"; shift 2 ;;
    -w|--wait) MAX_WAIT_TIME="$2"; shift 2 ;;
    -h|--help) 
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -t, --test FILENAME      Run a specific test feature file"
      echo "  -w, --wait TIME          Maximum wait time in seconds (default: 120)"
      echo "  -h, --help               Display this help message"
      exit 1 ;;
    *) SINGLE_TEST="$1"; shift ;;
  esac
done

# Ensure Karate jar exists
KARATE_JAR="${SCRIPT_DIR}/karate-1.4.0.jar"
if [ ! -f "$KARATE_JAR" ]; then
  echo -e "${YELLOW}Karate JAR not found. Downloading...${NC}"
  curl -L -o "$KARATE_JAR" "https://github.com/karatelabs/karate/releases/download/v1.4.0/karate-1.4.0.jar"
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to download Karate JAR${NC}"
    exit 1
  fi
fi

# Stop and start containers
echo "Stopping any existing containers..."
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down

echo "Building containers in parallel..."
# Use docker-compose build with --parallel flag
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" build --parallel

echo "Starting containers..."
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

# Create output directory for Karate
KARATE_OUTPUT="${LOGS_DIR}/karate-${TIMESTAMP}"
mkdir -p "$KARATE_OUTPUT"

# Run setup SQL if exists
SETUP_SQL="${SCRIPT_DIR}/setup.sql"
if [ -f "$SETUP_SQL" ]; then
  echo -e "${YELLOW}Running database setup...${NC}"
  mysql --defaults-file="$MYSQL_TEMP_CNF" $DATABASE < "$SETUP_SQL"
fi

# Run the tests
echo -e "${YELLOW}Running Karate tests...${NC}"
echo "=========== TEST BEGIN ==========="
TEST_START_TIME=$(date +%s)

TEST_RESULT=0
TOTAL_TESTS=0
FAILED_TESTS=0

if [ -n "$SINGLE_TEST" ]; then
  # Run single specified test
  TEST_FILE="${SCRIPT_DIR}/${SINGLE_TEST}"
  
  # Check if the test file exists
  if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}Error: Test file '$SINGLE_TEST' not found${NC}"
    echo "Available test files:"
    find "$SCRIPT_DIR" -name "*.feature" -type f -printf "%f\n" | sort
    docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
    rm -f "$MYSQL_TEMP_CNF"
    exit 1
  fi
  
  TEST_NAME=$(basename "$TEST_FILE" .feature)
  echo -e "${YELLOW}Running test: $TEST_NAME${NC}"
  TOTAL_TESTS=1
  
  # Run the test with proper format for Karate
  java -jar "$KARATE_JAR" --format html -o "$KARATE_OUTPUT" "$TEST_FILE"
  TEST_RESULT=$?
  FAILED_TESTS=$TEST_RESULT

  if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}Test passed!${NC}"
  else
    echo -e "${RED}Test failed with exit code $TEST_RESULT${NC}"
  fi
else
  # Create a temporary file to store test list with sanity test first
  TEST_LIST_FILE=$(mktemp)
  
  # Check if sanity test exists and add it first
  SANITY_TEST=$(find "$SCRIPT_DIR" -name "sanity.feature" -type f)
  if [ -n "$SANITY_TEST" ]; then
    echo -e "${YELLOW}Sanity test found. Running it first: $(basename "$SANITY_TEST")${NC}"
    echo "$SANITY_TEST" > "$TEST_LIST_FILE"
  fi
  
  # Add all other tests
  find "$SCRIPT_DIR" -name "*.feature" -type f | grep -v "sanity.feature" | sort >> "$TEST_LIST_FILE"
  
  # Check if any feature files exist
  if [ ! -s "$TEST_LIST_FILE" ]; then
    echo -e "${RED}Error: No feature files found in $SCRIPT_DIR${NC}"
    docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down
    rm -f "$MYSQL_TEMP_CNF" "$TEST_LIST_FILE"
    exit 1
  fi
  
  # Run all tests, with fail-fast approach
  echo -e "${YELLOW}Running tests with fail-fast enabled${NC}"
  
  while IFS= read -r TEST_FILE; do
    # Skip if empty line
    [ -z "$TEST_FILE" ] && continue
    
    TEST_NAME=$(basename "$TEST_FILE" .feature)
    
    echo -e "${YELLOW}Running test: $TEST_NAME${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Create test-specific output directory
    TEST_OUTPUT="${KARATE_OUTPUT}/${TEST_NAME}"
    mkdir -p "$TEST_OUTPUT"
    
    # Run test with proper format for Karate
    java -jar "$KARATE_JAR" --format html -o "$TEST_OUTPUT" "$TEST_FILE"
    CURRENT_RESULT=$?
    
    if [ $CURRENT_RESULT -ne 0 ]; then
      TEST_RESULT=1
      FAILED_TESTS=$((FAILED_TESTS + 1))
      echo -e "${RED}Test $TEST_NAME failed with exit code $CURRENT_RESULT${NC}"
      
      # Fail-fast: Stop execution after any test failure
      echo -e "${RED}Fail-fast: Stopping test execution due to failure${NC}"
      break
    else
      echo -e "${GREEN}Test $TEST_NAME passed!${NC}"
    fi
  done < "$TEST_LIST_FILE"
  
  # Clean up the temporary file
  rm -f "$TEST_LIST_FILE"
fi

TEST_END_TIME=$(date +%s)
TEST_DURATION=$((TEST_END_TIME - TEST_START_TIME))
TEST_DURATION_FORMATTED=$(printf "%02d:%02d" $((TEST_DURATION/60)) $((TEST_DURATION%60)))

# Output results
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}All tests passed successfully!${NC}"
else
  echo -e "${RED}$FAILED_TESTS of $TOTAL_TESTS tests failed!${NC}"
  
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
TEARDOWN_SQL="${SCRIPT_DIR}/teardown.sql"
if [ -f "$TEARDOWN_SQL" ]; then
  echo -e "${YELLOW}Running database teardown...${NC}"
  mysql --defaults-file="$MYSQL_TEMP_CNF" $DATABASE < "$TEARDOWN_SQL"
fi

# Clean up
rm -f "$MYSQL_TEMP_CNF"
[ -f "$TEST_LIST_FILE" ] && rm -f "$TEST_LIST_FILE"
docker-compose -f "$SCRIPT_DIR/../local-compose.yml" down

# Write summary
TEST_NAME_INFO=$([ -n "$SINGLE_TEST" ] && echo "$SINGLE_TEST" || echo "ALL TESTS")
cat > "${LOG_PREFIX}_summary.log" <<EOF
========================================
TEST SUMMARY: ${TEST_NAME_INFO}
Date: $(date)
========================================

RESULT: $([ $TEST_RESULT -eq 0 ] && echo "PASS" || echo "FAIL ($FAILED_TESTS of $TOTAL_TESTS tests failed)")

Test directory: $SCRIPT_DIR
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