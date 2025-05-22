Feature: Runner Lifecycle Tests

Background:
  * call read('../../util/setup.feature')
  * configure connectTimeout = timeoutConfig.connectTimeout
  * configure readTimeout = timeoutConfig.readTimeout
  * configure retry = timeoutConfig.retry
  * headers defaultHeaders
Scenario: Complete Runner Lifecycle Test
  # 1. Start a runner with app_requests
  Given url appRequestsUrl
  And request basePayload
  When method POST
  Then status 200
  And match response contains { runner_id: '#string', url: '#string' }
  * def runnerId = response.runner_id
  
  Given url appRequestsUrl
  And request basePayload
  When method POST
  Then status 200
  And match response contains { runner_id: '#string', url: '#string' }
  And assert responseTime < 10000  // Assert response time is less than 10 seconds
  
  # 3. Verify that the state of the runner has been changed to "awaiting_client"
  Given url runnersUrl + runnerId
  When method GET
  Then status 200
  And match response.state == 'awaiting_client'
  
  # 7. Terminate the runner
  Given url runnersUrl + runnerId
  When method DELETE
  Then status 200