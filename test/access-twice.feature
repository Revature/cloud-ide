Feature: Runner Lifecycle Tests

Background:
  * def ensureTrailingSlash = function(urlStr) { return urlStr.endsWith('/') ? urlStr : urlStr + '/'; }
  * def envVars = karate.readAsString('../.env')
  * def extractDomain = function(text) { var match = text.match(/domain=([^\n]+)/); return match ? match[1].trim() : 'http://localhost:8020'; }
  * def domain = extractDomain(envVars)
  * def baseUrl = ensureTrailingSlash(domain)
  * def appRequestsPath = ensureTrailingSlash('/api/v1/app_requests')
  * def runnersPath = ensureTrailingSlash('/api/v1/runners')
  * header Content-Type = 'application/json'
  * def appRequestsUrl = baseUrl + appRequestsPath.substring(1)
  * def runnersUrl = baseUrl + runnersPath.substring(1)
  * configure connectTimeout = 240000
  * configure readTimeout = 240000
  * configure retry = { count: 2, interval: 3000 }
  * def basePayload = { "image_id": 4, "env_data": { "script_vars": {}, "env_vars": {} }, "user_email": "bdd@revature.com", "session_time": 60, "runner_type": "temporary" }
  * def clone = function(obj) { return JSON.parse(JSON.stringify(obj)); }

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