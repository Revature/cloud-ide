#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
FEATURE_DIR="${SCRIPT_DIR}/feature"
LOGS_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOGS_DIR"

# Default values
MAX_WAIT_TIME=120
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_PREFIX="${LOGS_DIR}/${TIMESTAMP}"
SINGLE_TEST=""
TEST_DIR=""

# Handle script termination
trap 'exit 1' SIGINT SIGTERM

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -t|--test) SINGLE_TEST="$2"; shift 2 ;;
    -d|--dir) TEST_DIR="$2"; shift 2 ;;
    -w|--wait) MAX_WAIT_TIME="$2"; shift 2 ;;
    -h|--help) 
      echo "Usage: $0 [OPTIONS] [TEST_FILE|TEST_DIR]"
      echo "Options:"
      echo "  -t, --test FILENAME      Run a specific test feature file"
      echo "  -d, --dir DIRECTORY      Run all tests in a specific directory"
      echo "  -w, --wait TIME          Maximum wait time in seconds (default: 120)"
      echo "  -h, --help               Display this help message"
      echo ""
      echo "Examples:"
      echo "  $0                       Run all feature tests"
      echo "  $0 testfile.feature      Run a specific feature file"
      echo "  $0 testdir               Run all features in the testdir subdirectory"
      exit 1 ;;
    *)
      # Check if the argument is a directory or file
      if [ -z "$SINGLE_TEST" ] && [ -z "$TEST_DIR" ]; then
        if [[ "$1" == *.feature ]]; then
          SINGLE_TEST="$1"
        else
          TEST_DIR="$1"
        fi
      fi
      shift ;;
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

# Start containers using the compose.sh script
echo "Starting Docker containers..."
COMPOSE_SCRIPT="${SCRIPT_DIR}/compose.sh"
if [ ! -x "$COMPOSE_SCRIPT" ]; then
  chmod +x "$COMPOSE_SCRIPT"
fi

"$COMPOSE_SCRIPT" --wait "$MAX_WAIT_TIME"
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to start Docker containers. Exiting.${NC}"
  rm -f "$TEST_LIST_FILE" 2>/dev/null
  exit 1
fi
echo -e "${GREEN}Docker containers started successfully!${NC}"

# Create output directory for Karate
KARATE_OUTPUT="${LOGS_DIR}/karate-${TIMESTAMP}"
mkdir -p "$KARATE_OUTPUT"

# Run the tests
echo -e "${YELLOW}Running Karate tests...${NC}"
echo "=========== TEST BEGIN ==========="
TEST_START_TIME=$(date +%s)

TEST_RESULT=0
TOTAL_TESTS=0
FAILED_TESTS=0

# Create a temporary file to store test list
TEST_LIST_FILE=$(mktemp)

if [ -n "$SINGLE_TEST" ]; then
  # Determine the correct path for the test file
  if [[ "$SINGLE_TEST" == *"/"* ]]; then
    # If path contains slashes, use as is (relative to script dir)
    TEST_FILE="${SCRIPT_DIR}/${SINGLE_TEST}"
  elif [[ -f "${FEATURE_DIR}/${SINGLE_TEST}" ]]; then
    # Check if file exists directly in feature directory
    TEST_FILE="${FEATURE_DIR}/${SINGLE_TEST}"
  else
    # Search recursively for the test file within feature directory
    FOUND_FILE=$(find "${FEATURE_DIR}" -name "${SINGLE_TEST}" -type f | head -n 1)
    if [ -n "$FOUND_FILE" ]; then
      TEST_FILE="$FOUND_FILE"
    else
      echo -e "${RED}Error: Test file '${SINGLE_TEST}' not found${NC}"
      echo "Available test files:"
      find "${FEATURE_DIR}" -name "*.feature" -type f | sed "s|${FEATURE_DIR}/||" | sort
      "$COMPOSE_SCRIPT" # Run cleanup through compose.sh
      rm -f "$TEST_LIST_FILE"
      exit 1
    fi
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
elif [ -n "$TEST_DIR" ]; then
  # Run all tests in a specific directory
  TARGET_DIR="${FEATURE_DIR}/${TEST_DIR}"
  
  if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}Error: Test directory '$TEST_DIR' not found${NC}"
    echo "Available directories:"
    find "${FEATURE_DIR}" -type d | grep -v "^${FEATURE_DIR}$" | sed "s|${FEATURE_DIR}/||" | sort
    "$COMPOSE_SCRIPT" # Run cleanup through compose.sh
    rm -f "$TEST_LIST_FILE"
    exit 1
  fi
  
  # Check if sanity test exists in the target directory and add it first
  SANITY_TEST=$(find "$TARGET_DIR" -name "sanity.feature" -type f)
  if [ -n "$SANITY_TEST" ]; then
    echo -e "${YELLOW}Sanity test found. Running it first: $(basename "$SANITY_TEST")${NC}"
    echo "$SANITY_TEST" > "$TEST_LIST_FILE"
  fi
  
  # Add all other tests from the target directory
  find "$TARGET_DIR" -name "*.feature" -type f | grep -v "sanity.feature" | sort >> "$TEST_LIST_FILE"
  
  # Check if any feature files exist
  if [ ! -s "$TEST_LIST_FILE" ]; then
    echo -e "${RED}Error: No feature files found in $TARGET_DIR${NC}"
    "$COMPOSE_SCRIPT" # Run cleanup through compose.sh
    rm -f "$TEST_LIST_FILE"
    exit 1
  fi
else
  # Run all tests, check if sanity test exists and add it first
  SANITY_TEST=$(find "$FEATURE_DIR" -name "sanity.feature" -type f)
  if [ -n "$SANITY_TEST" ]; then
    echo -e "${YELLOW}Sanity test found. Running it first: $(basename "$SANITY_TEST")${NC}"
    echo "$SANITY_TEST" > "$TEST_LIST_FILE"
  fi
  
  # Add all other tests
  find "$FEATURE_DIR" -name "*.feature" -type f | grep -v "sanity.feature" | sort >> "$TEST_LIST_FILE"
  
  # Check if any feature files exist
  if [ ! -s "$TEST_LIST_FILE" ]; then
    echo -e "${RED}Error: No feature files found in $FEATURE_DIR${NC}"
    "$COMPOSE_SCRIPT" # Run cleanup through compose.sh
    rm -f "$TEST_LIST_FILE"
    exit 1
  fi
fi

# Run tests from the list file if not already executed a single test
if [ -z "$SINGLE_TEST" ]; then
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
fi

# Clean up the temporary file
rm -f "$TEST_LIST_FILE"

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

# Clean up
[ -f "$TEST_LIST_FILE" ] && rm -f "$TEST_LIST_FILE"

# Stop containers using compose.sh
"$COMPOSE_SCRIPT"

# Write summary
TEST_INFO=""
if [ -n "$SINGLE_TEST" ]; then
  TEST_INFO="SINGLE TEST: $SINGLE_TEST"
elif [ -n "$TEST_DIR" ]; then
  TEST_INFO="DIRECTORY: $TEST_DIR"
else
  TEST_INFO="ALL TESTS"
fi

cat > "${LOG_PREFIX}_summary.log" <<EOF
========================================
TEST SUMMARY: ${TEST_INFO}
Date: $(date)
========================================

RESULT: $([ $TEST_RESULT -eq 0 ] && echo "PASS" || echo "FAIL ($FAILED_TESTS of $TOTAL_TESTS tests failed)")

Test directory: $FEATURE_DIR
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