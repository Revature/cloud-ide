Feature: Runner API Tests

Background:
  # Helper function to ensure URL has trailing slash
  * def ensureTrailingSlash = function(urlStr) { return urlStr.endsWith('/') ? urlStr : urlStr + '/'; }
  * def baseUrl = ensureTrailingSlash('http://localhost:8020')
  * def apiPath = ensureTrailingSlash('/api/v1/app_requests')
  * header Content-Type = 'application/json'
  * def fullUrl = baseUrl + apiPath.substring(1)
  * print 'Target URL:', fullUrl
  
  # Common configurations for all scenarios
  * configure connectTimeout = 240000
  * configure readTimeout = 240000
  * configure retry = { count: 2, interval: 3000 }
  
  # Base payload template to be modified in each scenario
  * def basePayload = 
  """
  {
    "image_id": 4,
    "env_data": {
      "script_vars": {},
      "env_vars": {}
    },
    "user_email": "bdd@revature.com",
    "session_time": 60,
    "runner_type": "temporary"
  }
  """

# 1.1 - Standard runner creation (baseline)
Scenario: Test standard runner creation
  Given url fullUrl
  And request basePayload
  When method POST
  Then status 200
  And match response contains { runner_id: '#notnull', url: '#notnull' }
  * print '✓ Test 1.1 passed - Runner created with ID:', response.runner_id

# 1.2 - Test invalid image ID
Scenario: Test invalid image ID error handling
  * def payload = basePayload
  * eval payload.image_id = 999
  
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'Image not found'
  * print '✓ Test 1.2 passed - Invalid image ID correctly rejected with 400 error'

# 1.3 - Test invalid user email
Scenario: Test invalid user email error handling
  * def payload = basePayload
  * eval payload.user_email = 'nonexistent-user@example.com'
  
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'User not found'
  * print '✓ Test 1.3 passed - Invalid user email correctly rejected with 400 error'

# 1.4 - Test session time exceeds maximum
Scenario: Test excessive session time error handling
  * def payload = basePayload
  * eval payload.session_time = 999999
  
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'exceeds maximum'
  * print '✓ Test 1.4 passed - Excessive session time correctly rejected with 400 error'