#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
FEATURE_DIR="${SCRIPT_DIR}/feature"
UTIL_DIR="${SCRIPT_DIR}/util"
COMPILED_FILE="${SCRIPT_DIR}/compiled.txt"
SINGLE_TEST=""
TEST_DIR=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -t|--test) SINGLE_TEST="$2"; shift 2 ;;
    -d|--dir) TEST_DIR="$2"; shift 2 ;;
    -o|--output) COMPILED_FILE="$2"; shift 2 ;;
    -h|--help) 
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -t, --test FILENAME      Compile a specific test feature file"
      echo "  -d, --dir DIRECTORY      Compile all tests in a specific directory"
      echo "  -o, --output FILENAME    Output file (default: ./compiled.txt)"
      echo "  -h, --help               Display this help message"
      echo ""
      echo "Examples:"
      echo "  $0                       Compile all feature tests and util features"
      echo "  $0 -t testfile.feature   Compile a specific feature file"
      echo "  $0 -d testdir            Compile all features in the testdir subdirectory"
      exit 0 ;;
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

# Ensure output directory exists
mkdir -p "$(dirname "$COMPILED_FILE")"

# Clear the output file
> "$COMPILED_FILE"

# Function to add a feature file to compilation
add_to_compilation() {
  local TEST_FILE="$1"
  local BASE_DIR="$2"
  local REL_PATH=$(echo "$TEST_FILE" | sed "s|${BASE_DIR}/||")
  local DIR_PREFIX=$(basename "$BASE_DIR")
  
  echo "Adding: $DIR_PREFIX/$REL_PATH"
  echo "==== $DIR_PREFIX/$REL_PATH ====" >> "$COMPILED_FILE"
  cat "$TEST_FILE" >> "$COMPILED_FILE"
  echo "" >> "$COMPILED_FILE"  # Add blank line for readability
}

# Add all utility feature files first
if [ -d "$UTIL_DIR" ]; then
  echo -e "${YELLOW}Adding utility feature files from: $UTIL_DIR${NC}"
  UTIL_FILES=$(find "$UTIL_DIR" -name "*.feature" -type f | sort)
  
  if [ -n "$UTIL_FILES" ]; then
    while IFS= read -r UTIL_FILE; do
      add_to_compilation "$UTIL_FILE" "$UTIL_DIR"
    done <<< "$UTIL_FILES"
  else
    echo -e "${YELLOW}No utility feature files found in $UTIL_DIR${NC}"
  fi
else
  echo -e "${YELLOW}Utility directory $UTIL_DIR not found${NC}"
fi

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
      exit 1
    fi
  fi
  
  echo -e "${YELLOW}Compiling single test: $(basename "$TEST_FILE")${NC}"
  add_to_compilation "$TEST_FILE" "$FEATURE_DIR"
  
elif [ -n "$TEST_DIR" ]; then
  # Compile all tests in a specific directory
  TARGET_DIR="${FEATURE_DIR}/${TEST_DIR}"
  
  if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}Error: Test directory '$TEST_DIR' not found${NC}"
    echo "Available directories:"
    find "${FEATURE_DIR}" -type d | grep -v "^${FEATURE_DIR}$" | sed "s|${FEATURE_DIR}/||" | sort
    exit 1
  fi
  
  echo -e "${YELLOW}Compiling tests from directory: $TEST_DIR${NC}"
  
  # Add sanity test first if it exists
  SANITY_TEST=$(find "$TARGET_DIR" -name "sanity.feature" -type f)
  if [ -n "$SANITY_TEST" ]; then
    echo -e "${YELLOW}Sanity test found. Adding it first: $(basename "$SANITY_TEST")${NC}"
    add_to_compilation "$SANITY_TEST" "$FEATURE_DIR"
  fi
  
  # Add all other tests from the target directory
  FEATURE_COUNT=0
  while IFS= read -r TEST_FILE; do
    [ "$(basename "$TEST_FILE")" = "sanity.feature" ] && continue  # Skip sanity test as it's already added
    add_to_compilation "$TEST_FILE" "$FEATURE_DIR"
    FEATURE_COUNT=$((FEATURE_COUNT + 1))
  done < <(find "$TARGET_DIR" -name "*.feature" -type f | sort)
  
  if [ $FEATURE_COUNT -eq 0 ] && [ -z "$SANITY_TEST" ]; then
    echo -e "${RED}Error: No feature files found in $TARGET_DIR${NC}"
    exit 1
  fi
else
  # Compile all tests
  echo -e "${YELLOW}Compiling all feature files...${NC}"
  
  # Add sanity test first if it exists
  SANITY_TEST=$(find "$FEATURE_DIR" -name "sanity.feature" -type f)
  if [ -n "$SANITY_TEST" ]; then
    echo -e "${YELLOW}Sanity test found. Adding it first: $(basename "$SANITY_TEST")${NC}"
    add_to_compilation "$SANITY_TEST" "$FEATURE_DIR"
  fi
  
  # Add all other tests
  FEATURE_COUNT=0
  while IFS= read -r TEST_FILE; do
    [ "$(basename "$TEST_FILE")" = "sanity.feature" ] && continue  # Skip sanity test as it's already added
    add_to_compilation "$TEST_FILE" "$FEATURE_DIR"
    FEATURE_COUNT=$((FEATURE_COUNT + 1))
  done < <(find "$FEATURE_DIR" -name "*.feature" -type f | sort)
  
  if [ $FEATURE_COUNT -eq 0 ] && [ -z "$SANITY_TEST" ]; then
    echo -e "${RED}Error: No feature files found in $FEATURE_DIR${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Compilation complete!${NC}"
echo "Output file: $COMPILED_FILE"
echo "Total size: $(wc -l < "$COMPILED_FILE") lines"
exit 0