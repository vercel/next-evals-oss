# 032 - AI SDK v4 Basic Text Generation

## Overview

This eval tests the ability to correctly implement a basic route handler using Vercel's AI SDK v4 to generate text responses with a hardcoded prompt.

## What it tests

The eval validates that the AI can properly:

1. Create a route handler at `api/chat/route.ts`
2. Use the correct imports from AI SDK v4
3. Configure OpenAI client
4. Use a hardcoded prompt "Why is the sky blue?"
5. Return streaming responses

## Expected Implementation

The route handler should:
- Be located at `api/chat/route.ts`
- Use the `generateText` function from AI SDK v4
- Use the `anthropic`  function to configure the Claude model
- Return JSON responses
- Include appropriate error handling

Example implementation:
```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function GET() {
  const prompt = 'Why is the sky blue?';

  const result = await generateText({
    model: anthropic('claude-3-haiku-20240307'),
    prompt,
  });

  return Response.json({
    prompt,
    result: result.text,
  });
}
```

## Test Validation

The eval includes tests that validate:
1. Proper route handler implementation
2. Correct AI SDK import and usage
3. Use of hardcoded prompt
4. Streaming response format

## Common Pitfalls

1. **Incorrect Setup**
   - Using wrong import paths
   - Missing OpenAI client configuration
   - Not setting stream: true
2. **Response Format**
   - Not using Response.json()
   - Incorrect response structure

3. **Model Configuration**
   - Incorrect model name
   - Missing required parameters

