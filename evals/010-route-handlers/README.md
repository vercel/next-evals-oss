# Route Handlers Eval

## What this eval tests
This evaluation tests the ability to create a proper Route Handler in the Next.js App Router that accepts POST requests with JSON data and returns modified JSON responses.

## Why it's important
LLMs often struggle with:
- Creating Route Handlers in the correct file location (`app/api/[route]/route.ts`)
- Using the correct Next.js Request/Response API instead of Node.js or Express patterns
- Properly handling JSON parsing and response formatting
- Understanding the App Router's file-based routing for API endpoints
- Implementing the correct HTTP method handlers (GET, POST, etc.)

## How it works
The test validates that:
1. A Route Handler file exists at the correct location (`app/api/*/route.ts`)
2. The handler exports a `POST` function
3. The function properly parses incoming JSON data
4. The function returns the data with an added `processed: true` field
5. The response uses proper Next.js Response API

## Expected result
The implementation should create a file like `app/api/process/route.ts`:

```typescript
export async function POST(request: Request) {
  const data = await request.json();
  
  return Response.json({
    ...data,
    processed: true
  });
}
```

## Success criteria
- Route Handler file created in correct `app/api/` directory structure
- Exports a `POST` function that accepts a `Request` parameter
- Properly parses JSON from the request body
- Returns a Response with the original data plus `processed: true`
- Uses Next.js App Router Response API patterns