# Test Coverage Analysis: Karate Tests vs. BDD Test Plan

## 1. Runner API Endpoints Coverage

| Test Case ID | Description | Covered by Provided Karate Tests | Notes |
|--------------|-------------|-----------------------------------|-------|
| **A1** | Retrieve all runners successfully | ✅ | Covered in first file |
| **A2** | Filter runners by status successfully | ✅ | Covered in first file |
| **A3** | Filter runners by alive_only successfully | ✅ | Covered in first file |
| **A4** | No runners found returns OK | ✅ | Partially covered (status 200 or 204 in A3) |
| **A5** | Cannot use both status and alive_only parameters | ✅ | Covered in first file |
| **B1** | Retrieve a runner by ID successfully | ✅ | Covered in first file |
| **B2** | Runner not found returns 400 | ✅ | Covered in first file (though it's testing for 404, not 400) |
| **C1** | Successfully extend a runner session | ❌ | Not covered |
| **C2** | Extend session for non-existent runner returns 404 | ✅ | Covered in first file |
| **C3** | Extension exceeding 3-hour limit returns 400 | ❌ | Not covered |
| **C4** | Verify history record creation after extension | ❌ | Not covered |
| **D1** | Successfully get a devserver URL | ❌ | Not covered |
| **D2** | Missing port parameter causes validation error | ✅ | Covered in first file |
| **E1** | Successfully update runner to app_starting state | ❌ | Not covered |
| **E2** | Successfully update runner to ready state | ❌ | Not covered |
| **E3** | Successfully update runner to active state | ❌ | Not covered |
| **E4** | Successfully update runner to disconnecting state | ❌ | Not covered |
| **E5** | Runner not found returns 404 | ✅ | Covered in first file |
| **E6** | Invalid state returns 400 | ✅ | Covered in first file |
| **E7** | Script execution for app_starting runs on_create script | ❌ | Not covered |
| **E8** | Script execution for active runs on_connect script | ❌ | Not covered |
| **E9** | Script execution for disconnecting runs on_disconnect script | ❌ | Not covered |
| **E10** | Handle script execution error gracefully | ❌ | Not covered |
| **F1** | Successfully update a runner | ❌ | Not covered |
| **F2** | Update non-existent runner returns 404 | ✅ | Covered in first file |
| **G1** | Successfully stop a runner in ready state | ❌ | Not covered |
| **G2** | Successfully stop a runner in awaiting_client state | ❌ | Not covered |
| **G3** | Successfully stop a runner in active state | ❌ | Not covered |
| **G4** | Runner not found returns 404 | ✅ | Covered in first file |
| **G5** | Stopping runner in invalid state returns 400 | ❌ | Not covered |
| **G6** | Handle runner_management.stop_runner error | ❌ | Not covered |
| **H1** | Successfully start a runner in closed state | ❌ | Not covered |
| **H2** | Runner not found returns 404 | ✅ | Covered in first file |
| **H3** | Starting runner not in closed state returns 400 | ✅ | Covered in first file |
| **H4** | Handle runner_management.start_runner error | ❌ | Not covered |
| **I1** | Successfully terminate a runner | ❌ | Not covered |
| **I2** | Terminating non-existent runner returns success (idempotency) | ✅ | Covered in first file |
| **I3** | Successfully launch replacement runner when pool exists | ❌ | Not covered |
| **I4** | Handle script error during termination | ❌ | Not covered |
| **I5** | Handle error when launching replacement runner | ❌ | Not covered |
| **J1** | Successfully establish terminal connection | ❌ | Not covered |
| **J2** | Invalid terminal token returns error and closes connection | ❌ | Not covered |
| **J3** | Runner not found closes connection | ❌ | Not covered |
| **J4** | Runner in invalid state closes connection | ❌ | Not covered |
| **J5** | Successfully launch replacement runner for pool | ❌ | Not covered |
| **J6** | Handle error during terminal connection | ❌ | Not covered |
| **J7** | Handle error when launching replacement runner | ❌ | Not covered |

## 2. Runner Request API Endpoints Coverage

| Test Case ID | Description | Covered by Provided Karate Tests | Notes |
|--------------|-------------|-----------------------------------|-------|
| **A1** | Successfully retrieve a runner with existing runner for user | ✅ | Covered in third file (standard runner creation test) |
| **A2** | Successfully retrieve a runner from pool when available | ❌ | Not covered |
| **A3** | Successfully launch a new runner when no existing or pool runners | ❓ | Partially covered by standard runner creation test, but specific condition not verified |
| **A4** | Handle invalid session time exceeding maximum limit | ✅ | Covered in second file (excessive session time test) |
| **A5** | Handle negative or zero session time | ✅ | Covered in second file (zero and negative session time tests) |
| **A6** | Image not found returns 400 | ✅ | Covered in second file (invalid image ID test) |
| **A7** | User not found returns 400 | ✅ | Covered in second file (invalid user email test) |
| **A8** | Launch failure returns 500 | ❌ | Not covered |
| **A9** | Runner does not become ready in time returns 500 | ❌ | Not covered |
| **B1** | Successfully initialize asynchronous runner request | ❌ | Not covered |
| **B2** | Return lifecycle token immediately while processing continues | ❌ | Not covered |
| **B3** | Handle errors during initialization | ❌ | Not covered |
| **B4** | Verify background task successfully processes the runner request | ❌ | Not covered |
| **C1** | Successfully establish WebSocket connection with valid lifecycle token | ❌ | Not covered |
| **C2** | Invalid lifecycle token returns 403 and closes connection | ❌ | Not covered |
| **C3** | Receive real-time updates about runner provisioning | ❌ | Not covered |
| **C4** | Handle client heartbeat messages | ❌ | Not covered |
| **C5** | Handle client cancellation request | ❌ | Not covered |
| **C6** | Handle client disconnect | ❌ | Not covered |
| **C7** | Handle WebSocket errors properly | ❌ | Not covered |
| **D1** | Successfully process existing runner claim | ❌ | Not covered |
| **D2** | Successfully process pool runner claim | ❌ | Not covered |
| **D3** | Successfully launch and claim new runner | ❓ | Partially covered by standard runner creation test |
| **D4** | Successfully run awaiting_client hooks for new sessions | ❌ | Not covered |
| **D5** | Handle script execution errors during awaiting_client hook | ❌ | Not covered |
| **D6** | Properly shutdown runner when script execution fails | ❌ | Not covered |
| **D7** | Verify status emitter sends appropriate status updates | ❌ | Not covered |
| **D8** | Process user IP from headers correctly | ❌ | Not covered |
| **D9** | Replenish runner pool after taking runner from pool | ❌ | Not covered |