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
  
  # Store the runner details for later verification
  * def runnerId = response.runner_id
  * def runnerUrl = response.url
  * def expectedImageId = basePayload.image_id
  
  Given url runnerUrl
  When method GET
  Then status 200 || status 302 || status 307 
  
  # Allow some time for the runner to become active
  * karate.pause(1000)
  
  # 3. Verify that the state of the runner has been changed to "active"
  Given url runnersUrl + runnerId
  When method GET
  Then status 200
  And match response.state == 'active'
  
  # 5. Verify that ended_on is null
  * match response.ended_on == null
  
  # 6. Verify that the runner has been assigned correct user and image
  * match response.image_id == expectedImageId
  * def userId = response.user_id
  * assert userId != null
  
  # 7. Terminate the runner
  Given url runnersUrl + runnerId
  When method DELETE
  Then status 200