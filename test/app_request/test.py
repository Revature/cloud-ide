#!/usr/bin/env python3
import json
import sys
import time
import logging
import requests
from typing import Dict, Any, Optional
from requests.exceptions import RequestException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api_tests")


class RunnerAPITester:
    """Basic test runner for Runner API functionality tests with focus on error handling."""

    def __init__(self, config_path: str):
        """Initialize the API tester with configuration.
        
        Args:
            config_path: Path to the configuration JSON file
        """
        self.config = self._load_config(config_path)
        self.domain = self.config.get('domain')
        self.timeout = self.config.get('timeout', 30)
        self.max_retries = self.config.get('max_retries', 1)
        self.retry_delay = self.config.get('retry_delay', 2)
        self.access_token = self.config.get('access_token', None)
        
        # Common headers for requests
        self.headers = {"Content-Type": "application/json"}
        if self.access_token:
            self.headers["Access-Token"] = self.access_token

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load the configuration from a JSON file.
        
        Args:
            config_path: Path to the configuration file
            
        Returns:
            Dictionary containing configuration
            
        Raises:
            SystemExit: If the file is not found or contains invalid JSON
        """
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Error: Config file not found at {config_path}")
            sys.exit(1)
        except json.JSONDecodeError:
            logger.error(f"Error: Invalid JSON in config file {config_path}")
            sys.exit(1)

    def _make_request(self, method: str, url: str, 
                     json_data: Optional[Dict] = None,
                     expected_status: int = 200) -> Optional[Dict]:
        """Make an HTTP request with retry logic.
        
        Args:
            method: HTTP method (GET, POST, DELETE, etc.)
            url: URL to send the request to
            json_data: Optional JSON payload
            expected_status: Expected HTTP status code
            
        Returns:
            Response JSON data if successful, None if request failed
        """
        for attempt in range(self.max_retries + 1):  # +1 for initial attempt
            try:
                if attempt > 0:
                    logger.info(f"Retry attempt {attempt} after {self.retry_delay}s delay")
                    time.sleep(self.retry_delay)
                
                response = requests.request(
                    method=method,
                    url=url,
                    json=json_data,
                    headers=self.headers,
                    timeout=self.timeout
                )
                
                # Log the response status
                logger.info(f"Request {method} {url} - Status: {response.status_code}")
                
                if response.status_code == expected_status:
                    # For successful requests with content, parse as JSON
                    if response.content:
                        try:
                            return response.json()
                        except json.JSONDecodeError:
                            logger.error(f"Response is not valid JSON: {response.text[:100]}")
                            return None
                    return {}  # Empty but successful response
                else:
                    # Log error response
                    logger.error(f"Unexpected status code: {response.status_code}")
                    logger.error(f"Response: {response.text[:200]}")  # Limit length of output
                    
                    # If we're expecting an error code and got it, still try to parse the response
                    if response.status_code == expected_status:
                        try:
                            return response.json() if response.content else {}
                        except json.JSONDecodeError:
                            logger.error(f"Error response is not valid JSON: {response.text[:100]}")
                            return None
            except RequestException as e:
                logger.error(f"Request exception: {method} {url} - {str(e)}")
        
        return None

    # 1.1 - Standard runner creation (baseline)
    def test_request_runner(self) -> bool:
        """Test that app_requests produces a valid response with standard parameters.
        
        Returns:
            True if test passes, False otherwise
        """
        logger.info("TEST 1.1: Standard runner creation")
        payload = self.config.get("app_request_payload", {})
        
        url = f"{self.domain}/api/v1/app_requests/"
        
        response = self._make_request("POST", url, json_data=payload)
        if response is None:
            return False
            
        # Validate response format
        required_fields = ["runner_id", "url"]
        missing_fields = [field for field in required_fields if field not in response]
        
        if missing_fields:
            logger.error(f"Response missing required fields: {missing_fields}")
            return False
            
        logger.info(f"✓ Test 1.1 passed - Runner created with ID: {response.get('runner_id')}")
        return True

    # 1.2 - Test invalid image ID
    def test_invalid_image_id(self) -> bool:
        """Test app_requests with a non-existent image ID.
        
        Returns:
            True if test correctly returns 400 error, False otherwise
        """
        logger.info("TEST 1.2: Invalid image ID error handling")
        
        # Clone the payload and modify image_id
        payload = self.config.get("app_request_payload", {}).copy()
        payload["image_id"] = 999  # Non-existent image ID
        
        url = f"{self.domain}/api/v1/app_requests/"
        
        # Expect a 400 Bad Request
        response = self._make_request(
            "POST", 
            url, 
            json_data=payload,
            expected_status=400  # We expect a 400 error
        )
        
        # In this case, we expect a response with an error
        if response is None:
            logger.error("No response received for invalid image ID test")
            return False
            
        # Check if the error message contains "Image not found"
        detail = response.get("detail", "")
        if "Image not found" not in detail:
            logger.error(f"Expected 'Image not found' in error detail, got: {detail}")
            return False
            
        logger.info("✓ Test 1.2 passed - Invalid image ID correctly rejected with 400 error")
        return True

    # 1.3 - Test invalid user email
    def test_invalid_user_email(self) -> bool:
        """Test app_requests with a non-existent user email.
        
        Returns:
            True if test correctly returns 400 error, False otherwise
        """
        logger.info("TEST 1.3: Invalid user email error handling")
        
        # Clone the payload and modify user_email
        payload = self.config.get("app_request_payload", {}).copy()
        payload["user_email"] = "nonexistent-user@example.com"  # Non-existent user
        
        url = f"{self.domain}/api/v1/app_requests/"
        
        # Expect a 400 Bad Request
        response = self._make_request(
            "POST", 
            url, 
            json_data=payload,
            expected_status=400  # We expect a 400 error
        )
        
        # In this case, we expect a response with an error
        if response is None:
            logger.error("No response received for invalid user email test")
            return False
            
        # Check if the error message contains "User not found"
        detail = response.get("detail", "")
        if "User not found" not in detail:
            logger.error(f"Expected 'User not found' in error detail, got: {detail}")
            return False
            
        logger.info("✓ Test 1.3 passed - Invalid user email correctly rejected with 400 error")
        return True

    # 1.4 - Test session time exceeds maximum
    def test_excessive_session_time(self) -> bool:
        """Test app_requests with a session time that exceeds the maximum.
        
        Returns:
            True if test correctly returns 400 error, False otherwise
        """
        logger.info("TEST 1.4: Excessive session time error handling")
        
        # Clone the payload and modify session_time
        payload = self.config.get("app_request_payload", {}).copy()
        
        # Set session_time to a very high value (e.g., 24 hours in minutes)
        payload["session_time"] = 999999
        
        url = f"{self.domain}/api/v1/app_requests/"
        
        # Expect a 400 Bad Request
        response = self._make_request(
            "POST", 
            url, 
            json_data=payload,
            expected_status=400  # We expect a 400 error
        )
        
        # In this case, we expect a response with an error
        if response is None:
            logger.error("No response received for excessive session time test")
            return False
            
        # Check if the error message contains "exceeds maximum"
        detail = response.get("detail", "")
        if "exceeds maximum" not in detail.lower():
            logger.error(f"Expected 'exceeds maximum' in error detail, got: {detail}")
            return False
            
        logger.info("✓ Test 1.4 passed - Excessive session time correctly rejected with 400 error")
        return True

    def run_all_tests(self) -> bool:
        """Run all tests in sequence.
        
        Returns:
            True if all tests pass, False if any test fails
        """
        tests = [
            self.test_request_runner,      # 1.1
            self.test_invalid_image_id,    # 1.2
            self.test_invalid_user_email,  # 1.3
            self.test_excessive_session_time  # 1.4
        ]
        
        logger.info(f"Starting test suite with {len(tests)} tests")
        
        all_passed = True
        for i, test in enumerate(tests, 1):
            logger.info(f"Running test {i}/{len(tests)}: {test.__name__}")
            try:
                if not test():
                    logger.error(f"✗ Test failed: {test.__name__}")
                    all_passed = False
            except Exception as e:
                logger.exception(f"Test {test.__name__} raised exception: {str(e)}")
                all_passed = False
        
        if all_passed:
            logger.info("✓ All tests passed successfully")
        else:
            logger.error("✗ One or more tests failed")
            
        return all_passed


def main():
    """Main entry point for the test script."""
    if len(sys.argv) != 2:
        logger.error("Usage: python error_tests.py <config_file_path>")
        sys.exit(1)
        
    config_path = sys.argv[1]
    tester = RunnerAPITester(config_path)
    
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()