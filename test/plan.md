# Test Coverage Analysis: Karate Tests vs. BDD Test Plan

## 1. Runner API Endpoints Coverage

| Test Case ID | Description | Covered by Karate Tests |
|--------------|-------------|-----------------------------------|
| **A1** | Retrieve all runners successfully | ✅ |
| **A2** | Filter runners by status successfully | ✅ |
| **A3** | Filter runners by alive_only successfully | ✅ |
| **A4** | No runners found returns OK | ✅ |
| **A5** | Cannot use both status and alive_only parameters | ✅ |
| **B1** | Retrieve a runner by ID successfully | ✅ |
| **B2** | Runner not found returns 404 | ✅ |
| **C1** | Successfully extend a runner session | ❌ |
| **C2** | Extend session for non-existent runner returns 404 | ✅ |
| **C3** | Extension exceeding 3-hour limit returns 400 | ❌ |
| **C4** | Verify history record creation after extension | ❌ |
| **D1** | Successfully get a devserver URL | ❌ |
| **D2** | Missing port parameter causes validation error | ✅ |
| **E1** | Successfully update runner to app_starting state | ❌ |
| **E2** | Successfully update runner to ready state | ❌ |
| **E3** | Successfully update runner to active state | ❌ |
| **E4** | Successfully update runner to disconnecting state | ❌ |
| **E5** | Runner not found returns 404 | ✅ |
| **E6** | Invalid state returns 400 | ✅ |
| **E7** | Script execution for app_starting runs on_create script | ❌ |
| **E8** | Script execution for active runs on_connect script | ❌ |
| **E9** | Script execution for disconnecting runs on_disconnect script | ❌ |
| **E10** | Handle script execution error gracefully | ❌ |
| **F1** | Successfully update a runner | ❌ |
| **F2** | Update non-existent runner returns 404 | ✅ |
| **G1** | Successfully stop a runner in ready state | ❌ |
| **G2** | Successfully stop a runner in awaiting_client state | ❌ |
| **G3** | Successfully stop a runner in active state | ❌ |
| **G4** | Runner not found returns 404 | ✅ |
| **G5** | Stopping runner in invalid state returns 400 | ❌ |
| **G6** | Handle runner_management.stop_runner error | ❌ |
| **H1** | Successfully start a runner in closed state | ❌ |
| **H2** | Runner not found returns 404 | ✅ |
| **H3** | Starting runner not in closed state returns 400 | ✅ |
| **H4** | Handle runner_management.start_runner error | ❌ |
| **I1** | Successfully terminate a runner | ❌ |
| **I2** | Terminating non-existent runner returns success (idempotency) | ✅ |
| **I3** | Successfully launch replacement runner when pool exists | ❌ |
| **I4** | Handle script error during termination | ❌ |
| **J1** | Successfully establish terminal connection | ❌ |
| **J2** | Invalid terminal token returns error and closes connection | ❌ |
| **J3** | Runner not found closes connection | ❌ |
| **J4** | Runner in invalid state closes connection | ❌ |
| **J5** | Successfully launch replacement runner for pool | ❌ |
| **J6** | Handle error during terminal connection | ❌ |

## 2. App Request API Endpoints Coverage

| Test Case ID | Description | Covered by Provided Karate Tests |
|--------------|-------------|-----------------------------------|
| **A1** | Successfully retrieve a runner with existing runner for user | ✅ |
| **A2** | Successfully retrieve a runner from pool when available | ❌ |
| **A3** | Successfully launch a new runner when no existing or pool runners | ✅ |
| **A4** | Handle invalid session time exceeding maximum limit | ✅ |
| **A5** | Handle negative or zero session time | ✅ |
| **A6** | Image not found returns 400 | ✅ |
| **A7** | User not found returns 400 | ✅ |
| **A8** | Launch failure returns 500 | ❌ |
| **A9** | Runner does not become ready in time returns 500 | ❌ |
| **B1** | Successfully initialize asynchronous runner request | ❌ |
| **B2** | Return lifecycle token immediately while processing continues | ❌ |
| **B3** | Handle errors during initialization | ❌ |
| **B4** | Verify background task successfully processes the runner request | ❌ |
| **C1** | Successfully establish WebSocket connection with valid lifecycle token | ❌ |
| **C2** | Invalid lifecycle token returns 403 and closes connection | ❌ |
| **C3** | Receive real-time updates about runner provisioning | ❌ |
| **C4** | Handle client heartbeat messages | ❌ |
| **C5** | Handle client cancellation request | ❌ |
| **C6** | Handle client disconnect | ❌ |
| **C7** | Handle WebSocket errors properly | ❌ |
| **D1** | Successfully process existing runner claim | ❌ |
| **D2** | Successfully process pool runner claim | ❌ |
| **D3** | Successfully launch and claim new runner | ✅ |
| **D4** | Successfully run awaiting_client hooks for new sessions | ❌ |
| **D5** | Handle script execution errors during awaiting_client hook | ❌ |
| **D6** | Properly shutdown runner when script execution fails | ❌ |
| **D7** | Verify status emitter sends appropriate status updates | ❌ |
| **D8** | Process user IP from headers correctly | ❌ |
| **D9** | Replenish runner pool after taking runner from pool | ❌ |