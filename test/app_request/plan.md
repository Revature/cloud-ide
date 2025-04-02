1. A valid app_requests (with 0 runners in the pool) responds with 200 OK. The runner state should then be awaiting_client.
2. A valid app_requests should produce a valid dest_url that produces a 200 OK. The runner state should then be active.
3. A valid app_requests should create a runner should for which a DELETE request should produce a 200 OK. The runner state should then be terminated.
4. An app_requests with an invalid image responds with 400 client Error.
5. An app_requests with an image with a fault on_connect script responds with 400 client error. The runner state should then be terminated.
6. An app_requests with an invalid user responds with 401 unauthorized.
7. An app_requests with an invalid session time responds with 400 client error.
7. An app_requests with an invalid runner_type time responds with 400 client error.