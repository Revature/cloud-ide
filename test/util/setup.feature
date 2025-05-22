@ignore
Feature: Common Test Setup

Scenario: Setup
  * def envVars = karate.readAsString('../.env')
  * def ensureTrailingSlash = function(urlStr) { return urlStr.endsWith('/') ? urlStr : urlStr + '/'; }
  * def clone = function(obj) { return JSON.parse(JSON.stringify(obj)); }
  * def sleep = function(millis){ java.lang.Thread.sleep(millis) }
  * def extractDomain = function(text) { var match = text.match(/domain=([^\n]+)/); return match ? match[1].trim() : 'http://localhost:8020'; }
  * def domain = extractDomain(envVars)
  * def baseUrl = ensureTrailingSlash(domain)
  * def runnersUrl = baseUrl + '/api/v1/runners/'
  * def appRequestsUrl = baseUrl + '/api/v1/app_requests/'
  * def basePayload = { "image_id": 4, "env_data": { "script_vars": {}, "env_vars": {} }, "user_email": "bdd@revature.com", "session_time": 60, "runner_type": "temporary" }
  * def defaultHeaders = { 'Content-Type': 'application/json' }
  * def timeoutConfig = { connectTimeout: 240000, readTimeout: 240000, retry: { count: 2, interval: 3000 } }