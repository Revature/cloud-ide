Feature: Runner API Tests

Background:
  * call read('../../util/setup.feature')
  * configure connectTimeout = timeoutConfig.connectTimeout
  * configure readTimeout = timeoutConfig.readTimeout
  * configure retry = timeoutConfig.retry
  * headers defaultHeaders
  * def expectedImageId = 4

Scenario: Test standard runner creation
  Given url appRequestsUrl
  And request basePayload
  When method POST
  Then status 200
  And match response contains { runner_id: '#notnull', url: '#notnull' }
  * def runnerId = response.runner_id

  # 2. Verify that the state of the runner has been changed to "awaiting client"
  Given url runnersUrl + runnerId
  When method GET
  Then status 200
  And match response.state == 'awaiting_client'

  # 3. Verify that ended_on is null
  * match response.ended_on == null
  
  # 4. Verify that the runner has been assigned correct user and image
  * match response.image_id == expectedImageId
  * def userId = response.user_id
  * assert userId != null
  
  # 5. Terminate the runner
  Given url runnersUrl + runnerId
  When method DELETE
  Then status 200

  * sleep(60000)

  # Verify the runner has been terminated
  Given url runnersUrl + runnerId
  When method GET
  Then status 200
  And match ["terminated", "terminated"] contains response.state
  And match response.ended_on != null