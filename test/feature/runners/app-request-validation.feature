Feature: Runner API Tests

Background:
  * call read('../../util/setup.feature')
  * configure connectTimeout = timeoutConfig.connectTimeout
  * configure readTimeout = timeoutConfig.readTimeout
  * configure retry = timeoutConfig.retry
  * headers defaultHeaders

Scenario: Test with empty request body
  Given url appRequestsUrl
  And request {}
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with malformed JSON
  Given url appRequestsUrl
  And header Content-Type = 'application/json'
  And request '{"this_is_bad_json:'
  When method POST
  Then status 422

Scenario: Test with non-integer image_id
  * def payload = clone(basePayload)
  * set payload.image_id = "not-a-number"
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 422

Scenario: Test with missing image_id field
  * def payload = clone(basePayload)
  * remove payload $.image_id
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with missing user_email field
  * def payload = clone(basePayload)
  * remove payload $.user_email
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with missing session_time field
  * def payload = clone(basePayload)
  * remove payload $.session_time
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 422
  And match response.detail[0].type == 'missing'

Scenario: Test with zero session_time
  * def payload = clone(basePayload)
  * set payload.session_time = 0
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 400

Scenario: Test with negative session_time
  * def payload = clone(basePayload)
  * set payload.session_time = -10
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 400
  
Scenario: Test invalid image ID error handling
  * def payload = clone(basePayload)
  * set payload.image_id = 999
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'Image not found'

Scenario: Test invalid user email error handling
  * def payload = clone(basePayload)
  * set payload.user_email = 'nonexistent-user@example.com'
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'User not found'

Scenario: Test excessive session time error handling
  * def payload = clone(basePayload)
  * set payload.session_time = 999999
  Given url appRequestsUrl
  And request payload
  When method POST
  Then status 400
  And match response.detail contains 'exceeds maximum'