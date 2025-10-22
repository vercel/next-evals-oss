# 031 - AI SDK v5 Route Handler Implementation

## Overview

This eval tests the ability to correctly implement a route handler using Vercel's AI SDK v5, specifically focusing on the `generateText` function with the Anthropic Claude model.

## What it tests

The eval validates that the AI can properly:

### 1. **Route Handler Implementation**
- Create a proper route handler at `api/chat/route.ts`
- Use the correct imports from the AI SDK v5
- Implement proper error handling
- Return appropriate Response objects

### 2. **AI SDK Usage**
- Correct usage of `generateText` function
- Proper model specification using `creator/model` string
- Response formatting

## Expected Implementation

The route handler should:
- Be located at `api/chat/route.ts`
- Use the `generateText` function from AI SDK v5
- Return JSON responses
- Include appropriate error handling

Example implementation:
```typescript
import { generateText } from 'ai';
 
export async function GET() {
  const result = await generateText({
    model: 'anthropic/claude-4-sonnet',
    prompt: 'Why is the sky blue?',
  });
  return Response.json(result);
}
```

## Test Validation

The eval includes tests that validate:
1. Proper route handler implementation
2. Correct AI SDK import and usage
3. Appropriate error handling
4. Response format validation
5. HTTP method handling

## Learning Objectives

This eval assesses understanding of:
- Route handler implementation in Next.js
- Vercel AI SDK v5 usage
- Error handling in API routes
- Response formatting
- TypeScript integration
- Prefer string-based model definition

## Common Pitfalls

1. **Incorrect Import**
   - Using wrong import path
   - Using outdated SDK versions

2. **Missing Error Handling**
   - Not catching potential API errors
   - Not handling invalid requests

3. **Response Format**
   - Not using Response.json()
   - Incorrect response structure

4. **Model Configuration**
   - Incorrect model name
   - Missing required parameters
