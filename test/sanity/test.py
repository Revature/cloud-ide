"""
Sanity test for web service.
Checks if the API docs page loads successfully at localhost:8020/api/docs
"""

import json
import sys
import requests
from requests.exceptions import RequestException

# Send api call to /api/docs. This verifies that the python api and nginx server
# are both running.
def check_api_docs(secrets:dict):
    """
    Send a request to the API docs endpoint and verify it loads successfully.
    
    Args:
        url (str): The URL to check
        max_retries (int): Maximum number of retry attempts
        retry_delay (int): Seconds to wait between retries
    
    Returns:
        bool: True if successful, False otherwise
    """
    url = f"{secrets['domain']}/api/docs"
    print(f"Testing API docs at {url}")
    try:
        
        response = requests.get(url, timeout=10)
        
        # Check if the response was successful
        if response.status_code == 200:
            # Additional check to verify it's actually the API docs page
            if "swagger" in response.text.lower() or "openapi" in response.text.lower() or "api documentation" in response.text.lower():
                print(f"OK: API docs loaded successfully (HTTP {response.status_code})")
                return True
            else:
                print("FAIL: Got HTTP 200 but content doesn't appear to be API docs")
        else:
            print(f"FAIL Failed with HTTP status code: {response.status_code}")
            
    except RequestException as e:
        print(f"FAIL Request failed: {str(e)}")
    return False

def main():
    """Main function to run the test and return appropriate exit code."""
    # Run the test
    arg = sys.argv[1]
    # Load the secrets file using the standard json library
    try:
        with open(arg, 'r') as f:
            secrets = json.load(f)
    except FileNotFoundError:
        print(f"Error: Secrets file not found at {secrets}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in secrets file {secrets}")
        sys.exit(1)
    success = check_api_docs(secrets)
    
    # Exit with appropriate code
    if success:
        print("Sanity test passed!")
        sys.exit(0)
    else:
        print("Sanity test failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()