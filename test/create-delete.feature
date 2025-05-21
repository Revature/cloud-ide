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

Scenario: Test standard runner creation
  Given url fullUrl
  And request basePayload
  When method POST
  Then status 200
  And match response contains { runner_id: '#notnull', url: '#notnull' }

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

  * karate.pause(60000)

  # Verify the runner has been terminated
  Given url runnersUrl + runnerId
  When method GET
  Then status 200
  And match response.state == 'terminated'
  And match response.ended_on != null