Feature: Runner API Tests

Background:
  * def ensureTrailingSlash = function(urlStr) { return urlStr.endsWith('/') ? urlStr : urlStr + '/'; }
  * def envVars = karate.readAsString('../.env')
  * def extractDomain = function(text) { var match = text.match(/domain=([^\n]+)/); return match ? match[1].trim() : 'http://localhost:8020'; }
  * def domain = extractDomain(envVars)
  * def baseUrl = ensureTrailingSlash(domain)
  * def apiPath = ensureTrailingSlash('/api/v1/app_requests')
  * header Content-Type = 'application/json'
  * def fullUrl = baseUrl + apiPath.substring(1)
  * configure connectTimeout = 240000
  * configure readTimeout = 240000
  * configure retry = { count: 2, interval: 3000 }
  * def basePayload = { "image_id": 4, "env_data": { "script_vars": {}, "env_vars": {} }, "user_email": "bdd@revature.com", "session_time": 60, "runner_type": "temporary" }
  * def clone = function(obj) { return JSON.parse(JSON.stringify(obj)); }

Scenario: Test with empty request body
  Given url fullUrl
  And request {}
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with malformed JSON
  Given url fullUrl
  And header Content-Type = 'application/json'
  And request '{"this_is_bad_json:'
  When method POST
  Then status 422

Scenario: Test with non-integer image_id
  * def payload = clone(basePayload)
  * set payload.image_id = "not-a-number"
  Given url fullUrl
  And request payload
  When method POST
  Then status 422

Scenario: Test with missing image_id field
  * def payload = clone(basePayload)
  * remove payload $.image_id
  Given url fullUrl
  And request payload
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with missing user_email field
  * def payload = clone(basePayload)
  * remove payload $.user_email
  Given url fullUrl
  And request payload
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with missing session_time field
  * def payload = clone(basePayload)
  * remove payload $.session_time
  Given url fullUrl
  And request payload
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with zero session_time
  * def payload = clone(basePayload)
  * set payload.session_time = 0
  Given url fullUrl
  And request payload
  When method POST
  Then status 400

Scenario: Test with negative session_time
  * def payload = clone(basePayload)
  * set payload.session_time = -10
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  
Scenario: Test invalid image ID error handling
  * def payload = clone(basePayload)
  * set payload.image_id = 999
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'Image not found'

Scenario: Test invalid user email error handling
  * def payload = clone(basePayload)
  * set payload.user_email = 'nonexistent-user@example.com'
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'User not found'

Scenario: Test excessive session time error handling
  * def payload = clone(basePayload)
  * set payload.session_time = 999999
  Given url fullUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'exceeds maximum'