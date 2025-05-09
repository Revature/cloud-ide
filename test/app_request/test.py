#!/usr/bin/env python3
import json
import sys
import time
import logging
from typing import Dict, Any, Optional

import requests
from requests.exceptions import RequestException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api_tests")


class APITester:
    """Test runner for API functionality tests."""

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
        self.access_token = self.config.get('access_token', 'Auth-Disabled')
        
        # Common headers for requests
        self.headers = {
            "Content-Type": "application/json", 
            "Access-Token": self.access_token
        }

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
                     expected_status: int = 200,
                     custom_headers: Optional[Dict] = None,
                     expect_json: bool = True) -> Optional[Dict]:
        """Make an HTTP request with retry logic.
        
        Args:
            method: HTTP method (GET, POST, DELETE, etc.)
            url: URL to send the request to
            json_data: Optional JSON payload
            expected_status: Expected HTTP status code
            custom_headers: Optional custom headers to use instead of default
            expect_json: Whether to expect and parse JSON response
            
        Returns:
            Response JSON data if successful and expect_json=True,
            Response object if successful and expect_json=False,
            None if request failed
        """
        headers = custom_headers if custom_headers else self.headers
        
        for attempt in range(self.max_retries):
            try:
                if attempt > 0:
                    logger.info(f"Retry attempt {attempt} after {self.retry_delay}s delay")
                    time.sleep(self.retry_delay)
                
                response = requests.request(
                    method=method,
                    url=url,
                    json=json_data,
                    headers=headers,
                    timeout=self.timeout
                )
                
                if response.status_code == expected_status:
                    logger.info(f"Request successful: {method} {url}")
                    if expect_json:
                        try:
                            return response.json() if response.content else {}
                        except json.JSONDecodeError:
                            logger.error(f"Response is not valid JSON: {response.text[:100]}")
                            return None
                    else:
                        return response
                else:
                    logger.error(f"Request failed: {method} {url} - Status: {response.status_code}")
                    logger.error(f"Response: {response.text[:200]}")  # Limit response text length
            except RequestException as e:
                logger.error(f"Request exception: {method} {url} - {str(e)}")
        
        return None

    def test_request_runner(self) -> bool:
        """Test that app_requests produces a valid response.
        
        Returns:
            True if test passes, False otherwise
        """
        logger.info("TEST: Verifying app_requests endpoint")
        payload = self.config.get("app_request_payload", {})
        
        logger.info(f"Testing app_requests with payload: {payload}")
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
            
        logger.info("✓ app_requests test passed")
        return True

    def test_runner_terminate(self) -> bool:
        """Test that a runner can be terminated.
        
        Returns:
            True if test passes, False otherwise
        """
        logger.info("TEST: Verifying runner termination")
        payload = self.config.get("app_request_payload", {})
        
        # Create a runner first
        url = f"{self.domain}/api/v1/app_requests/"
        response = self._make_request("POST", url, json_data=payload)
        if response is None:
            return False
            
        runner_id = response.get("runner_id")
        if not runner_id:
            logger.error("No runner_id in response")
            return False
            
        # Now terminate the runner
        url = f"{self.domain}/api/v1/runners/{runner_id}"
        terminate_response = self._make_request("DELETE", url)
        
        if terminate_response is None:
            return False
            
        logger.info("✓ Runner termination test passed")
        return True

    def test_runner_reachable(self) -> bool:
        """Test that a runner can be reached via its URL.
        
        Returns:
            True if test passes, False otherwise
        """
        logger.info("TEST: Verifying runner reachability")
        payload = self.config.get("app_request_payload", {})
        
        # Create a runner first
        url = f"{self.domain}/api/v1/app_requests/"
        response = self._make_request("POST", url, json_data=payload)
        if response is None:
            return False
            
        runner_url = response.get("url")
        if not runner_url:
            logger.error("No URL in response")
            return False
            
        # Try to access the runner - we only care about HTTP status,
        # not parsing the response as JSON
        reachable_response = self._make_request(
            "GET", 
            runner_url, 
            custom_headers={"Content-Type": "application/json"},
            expect_json=False  # Don't try to parse response as JSON
        )
        
        if reachable_response is None:
            return False
            
        logger.info(f"Runner is reachable with status code: {reachable_response.status_code}")
        logger.info("✓ Runner reachability test passed")
        return True
        
    def run_all_tests(self) -> bool:
        """Run tests until the first failure.
        
        Returns:
            True if all tests pass, False if any test fails
        """
        tests = [
            self.test_request_runner,
            self.test_runner_reachable,
            self.test_runner_terminate
        ]
        
        logger.info(f"Starting test suite with {len(tests)} tests (stopping at first failure)")
        
        for i, test in enumerate(tests, 1):
            logger.info(f"Running test {i}/{len(tests)}: {test.__name__}")
            try:
                if not test():
                    logger.error(f"✗ Test failed: {test.__name__}")
                    logger.error("Stopping test execution to save resources")
                    return False
            except Exception as e:
                logger.exception(f"Test {test.__name__} raised exception: {str(e)}")
                logger.error("Stopping test execution to save resources")
                return False
        
        logger.info("✓ All tests passed successfully")
        return True


def main():
    """Main entry point for the test script."""
    if len(sys.argv) != 2:
        logger.error("Usage: python test.py <config_file_path>")
        sys.exit(1)
        
    config_path = sys.argv[1]
    tester = APITester(config_path)
    
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()