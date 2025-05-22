Feature: API Documentation Sanity Test

Background:
  * def ensureTrailingSlash = function(urlStr) { return urlStr.endsWith('/') ? urlStr : urlStr + '/'; }
  * def envVars = karate.readAsString('../../.env')
  * def extractDomain = function(text) { var match = text.match(/domain=([^\n]+)/); return match ? match[1].trim() : 'http://localhost:8020'; }
  * def domain = extractDomain(envVars)
  * def baseUrl = ensureTrailingSlash(domain)
  * def apiDocsUrl = baseUrl + '/api/docs'
  * configure connectTimeout = 30000
  * configure readTimeout = 30000
  * configure retry = { count: 2, interval: 3000 }

Scenario: Verify API Documentation is accessible
  # Check if the API docs endpoint is accessible
  Given url apiDocsUrl
  When method GET
  Then status 200
  
  # Verify that the response contains typical OpenAPI/Swagger content
  * match response contains '<html'
  
  # Check for swagger or openapi text
  * def responseText = response
  * def hasSwagger = responseText.indexOf('swagger') != -1
  * def hasOpenApi = responseText.indexOf('openapi') != -1
  * assert hasSwagger || hasOpenApi
  
  # Print a success message
  * print 'API Documentation is accessible at:', apiDocsUrl