I want to add middleware to my Next.js app that adds a custom header to all responses.

The middleware should:
- Add a custom header "X-Custom-Header" with value "middleware-test" to all responses
- Be properly configured to run on all routes
