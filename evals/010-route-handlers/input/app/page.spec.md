# Evaluation Criteria

This implementation should create a Next.js App Router Route Handler that processes POST requests.

## Requirements

1. Creates a route handler file at `app/api/process/route.ts` (or `.js`)
2. Exports a `POST` function that handles POST requests
3. Parses JSON from the incoming request body using `request.json()`
4. Returns a JSON response containing all original data plus `processed: true`
5. Uses the standard Web Response API (e.g., `Response.json()` or `new Response()` with JSON)
6. Does not use Express-style `req.body` or `res.json()` patterns
