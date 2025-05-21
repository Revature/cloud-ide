Feature: Runner API Tests

Background:
  * def ensureTrailingSlash = function(urlStr) { return urlStr.endsWith('/') ? urlStr : urlStr + '/'; }
  * def baseUrl = ensureTrailingSlash('http://localhost:8020')
  * def apiPath = ensureTrailingSlash('/api/v1/runners')
  * header Content-Type = 'application/json'
  * def fullUrl = baseUrl + apiPath.substring(1)
  * configure connectTimeout = 240000
  * configure readTimeout = 240000
  * configure retry = { count: 2, interval: 3000 }
  * def nonExistentRunnerId = 99999999

# A1: Retrieve all runners successfully
Scenario: A1 - Retrieve all runners successfully
  Given url fullUrl
  When method GET
  Then status 200
  And match response == '#array'
  And match each response contains { id: '#number', state: '#string' }

# A2: Filter runners by status successfully (using 'terminated')
Scenario: A2 - Filter runners by status successfully
  Given url fullUrl
  And param status = 'terminated'
  When method GET
  Then status 200
  And match response == '#array'
  And match each response contains { state: 'terminated' }

# A3: Filter runners by alive_only successfully
Scenario: A3 - Filter runners by alive_only successfully
  Given url fullUrl
  And param alive_only = false
  When method GET
  Then status 200 or 204

# A5: Cannot use both status and alive_only parameters
Scenario: A5 - Cannot use both status and alive_only parameters
  Given url fullUrl
  And param status = 'terminated'
  And param alive_only = true
  When method GET
  Then status 400
  And match response.detail == "Cannot use both 'status' and 'alive_only' parameters simultaneously"

# B1: Retrieve a runner by ID successfully (assuming runner ID 1 exists and is terminated)
Scenario: B1 - Retrieve a runner by ID successfully
  Given url fullUrl + '1'
  When method GET
  Then status 200
  And match response contains { id: 1, state: 'terminated' }

# B2: Runner not found returns 404 (using very high ID)
Scenario: B2 - Runner not found returns 404
  Given url fullUrl + nonExistentRunnerId
  When method GET
  Then status 404
  And match response.detail == "Runner not found"

# C2: Extend session for non-existent runner returns 404
Scenario: C2 - Extend session for non-existent runner returns 404
  Given url fullUrl + nonExistentRunnerId + '/extend_session'
  And request { runner_id: #(nonExistentRunnerId), extra_time: 30 }
  When method PUT
  Then status 404
  And match response.detail == "Runner not found"

# D2: Missing port parameter causes validation error
Scenario: D2 - Missing port parameter causes validation error
  Given url fullUrl + '1/devserver'
  When method GET
  Then status 422
  And match response.detail[0].type == 'missing'
  And match response.detail[0].loc contains 'port'

# E5: Updating state for non-existent runner returns 404
Scenario: E5 - Updating state for non-existent runner returns 404
  Given url fullUrl + nonExistentRunnerId + '/state'
  And request { runner_id: #(nonExistentRunnerId), state: 'ready' }
  When method PUT
  Then status 404
  And match response.detail == "Runner not found"

# E6: Invalid state returns 400
Scenario: E6 - Invalid state returns 400
  Given url fullUrl + '1/state'
  And request { runner_id: 1, state: 'invalid_state' }
  When method PUT
  Then status 400
  And match response.detail contains "Invalid state: invalid_state"

# F2: Update non-existent runner returns 404
Scenario: F2 - Update non-existent runner returns 404
  Given url fullUrl + nonExistentRunnerId
  And request { id: #(nonExistentRunnerId), state: 'ready', image_id: 1 }
  When method PUT
  Then status 404
  And match response.detail == "Runner not found"

# G4: Stop runner - Runner not found returns 404
Scenario: G4 - Stop runner - Runner not found returns 404
  Given url fullUrl + nonExistentRunnerId + '/stop'
  When method PATCH
  Then status 404
  And match response.detail == "Runner not found"

# H2: Start runner - Runner not found returns 404
Scenario: H2 - Start runner - Runner not found returns 404
  Given url fullUrl + nonExistentRunnerId + '/start'
  When method PATCH
  Then status 404
  And match response.detail == "Runner not found"

# H3: Starting runner not in closed state returns 400 (using runner 1 which should be terminated)
Scenario: H3 - Starting runner not in closed state returns 400
  Given url fullUrl + '1/start'
  When method PATCH
  Then status 400
  And match response.detail contains "Cannot start a runner in terminated state"

# I2: Terminating non-existent runner returns success (idempotency)
Scenario: I2 - Terminating non-existent runner returns success
  Given url fullUrl + nonExistentRunnerId
  When method DELETE
  Then status 200