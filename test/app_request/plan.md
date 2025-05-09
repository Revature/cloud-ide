# Runner API Error Tests Plan

## 1.1 Standard Runner Creation

- **ID**: test_request_runner
- **Description**: Test basic runner creation with valid parameters
- **Endpoint**: POST /api/v1/app_requests/
- **Payload**: Standard app_request_payload from config
- **Expected Status**: 200
- **Validation**:
  - Response contains runner_id
  - Response contains url

## 1.2 Invalid Image ID

- **ID**: test_invalid_image_id
- **Description**: Test runner creation with non-existent image ID
- **Endpoint**: POST /api/v1/app_requests/
- **Payload**: app_request_payload with image_id = 999
- **Expected Status**: 400
- **Validation**:
  - Response contains "Image not found" in error detail

## 1.3 Invalid User Email

- **ID**: test_invalid_user_email
- **Description**: Test runner creation with non-existent user email
- **Endpoint**: POST /api/v1/app_requests/
- **Payload**: app_request_payload with user_email = "nonexistent-user@example.com"
- **Expected Status**: 400
- **Validation**:
  - Response contains "User not found" in error detail

## 1.4 Excessive Session Time

- **ID**: test_excessive_session_time
- **Description**: Test runner creation with session time exceeding maximum allowed
- **Endpoint**: POST /api/v1/app_requests/
- **Payload**: app_request_payload with session_time = 1440 (24 hours)
- **Expected Status**: 400
- **Validation**:
  - Response contains "exceeds maximum" in error detail