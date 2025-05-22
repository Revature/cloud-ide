#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
MAX_WAIT_TIME=120
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -w|--wait) MAX_WAIT_TIME="$2"; shift 2 ;;
    -h|--help) 
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -w, --wait TIME          Maximum wait time in seconds (default: 120)"
      echo "  -h, --help               Display this help message"
      exit 1 ;;
    *) shift ;;
  esac
done

# Validate compose file existence
COMPOSE_FILE="${SCRIPT_DIR}/../local-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Error: local-compose.yml not found at ${COMPOSE_FILE}${NC}"
  exit 1
fi

# Function to handle cleanup on script termination
cleanup() {
  echo -e "\n${YELLOW}Script interrupted. Cleaning up...${NC}"
  docker-compose -f "$COMPOSE_FILE" down
  exit 1
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Stop and start containers
echo "Stopping any existing containers..."
docker-compose -f "$COMPOSE_FILE" down

echo "Building containers in parallel..."
# Use docker-compose build with --parallel flag
docker-compose -f "$COMPOSE_FILE" build --parallel
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build containers${NC}"
  exit 1
fi

echo "Starting containers..."
docker-compose -f "$COMPOSE_FILE" up -d
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to start containers${NC}"
  exit 1
fi

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend service...${NC}"
for ((i=1; i<=MAX_WAIT_TIME/2; i++)); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/docs 2>/dev/null | grep -q '200\|301\|302'; then
    echo -e "\n${GREEN}Backend service is ready!${NC}"
    exit 0
  fi
  echo -n "."
  sleep 2
  if [ $i -eq $((MAX_WAIT_TIME/2)) ]; then
    echo -e "\n${RED}Backend service failed to start.${NC}"
    docker-compose -f "$COMPOSE_FILE" down
    exit 1
  fi
done