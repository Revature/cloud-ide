import json
import sys
import requests
from requests.exceptions import RequestException

# Send api call to /api/docs. This verifies that the python api and nginx server
# are both running.
def request_runner(secrets:dict):
    """Send a request to the app_requests and verify that it produces a code 200 response."""
    
    payload=secrets["app_request_payload"]
    print(f"Testing app_requests with the payload: {payload}")
    try:
        response = requests.post(url=f"{secrets['domain']}/api/v1/app_requests/", json=payload, 
                                 headers={"Content-Type":"application/json", "Access-Token":"Auth-Disabled"},
                                   timeout=120)
        # Check if the response was successful
        if response.status_code == 200:
            res = response.json()
            print(f"OK: Response with status {response.status_code} and body {res}")
            return True
        else:
            print(f"FAIL: HTTP status code: {response.status_code}")
            return False
            
    except RequestException as e:
        print(f"FAIL: {str(e)}")
    return False

def runner_terminate(secrets:dict):
    """Send a request to app_request and verify that it can be terminated."""
    payload=secrets["app_request_payload"]
    print(f"Testing that the runner can be terminated: {payload}")
    try:
        response = requests.post(url=f"{secrets['domain']}/api/v1/app_requests/", json=payload, 
                                 headers={"Content-Type":"application/json", "Access-Token":"Auth-Disabled"},
                                   timeout=120)
        # Check if the response was successful
        if response.status_code == 200:
            res = response.json()
        else:
            print(f"FAIL: HTTP status code: {response.status_code}")
            return False
        response = requests.delete(f"{secrets['domain']}/api/v1/runners/{res['runner_id']}",
                                    headers={"Content-Type":"application/json", "Access-Token":"Auth-Disabled"},
                                    timeout=120)
        if response.status_code == 200:
            return True
        else:
            print(f"FAIL: HTTP status code: {response.status_code}")
            return False
            
    except RequestException as e:
        print(f"FAIL: {str(e)}")
    return False

def runner_reachable(secrets:dict):
    """Send a request to app_request and verify that the runner is reachable."""
    url=f"{secrets['domain']}/api/v1/app_requests/"
    payload=secrets["app_request_payload"]
    print(f"Testing that the runner is reachable: {payload}")
    try:
        response = requests.post(url, json=payload, 
                                 headers={"Content-Type":"application/json", "Access-Token":"Auth-Disabled"},
                                   timeout=120)
        # Check if the response was successful
        if response.status_code == 200:
            res = response.json()
            dest_url = res["url"]
        else:
            print(f"FAIL: HTTP status code: {response.status_code}")
            return False
        response = requests.get(dest_url, 
                                 headers={"Content-Type":"application/json"},
                                   timeout=120)
        if response.status_code == 200:
            return True
        else:
            print(f"FAIL: HTTP status code: {response.status_code}")
            return False
            
    except RequestException as e:
        print(f"FAIL: {str(e)}")
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
    
    tests = [request_runner, runner_reachable, runner_terminate]
    for test in tests :
        success = test(secrets)
        if not success:
            sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    main()