# 037 - AI SDK Text Embedding Implementation

This example demonstrates how to implement text embedding functionality in a Next.js application using the AI SDK. The task involves creating an API endpoint that converts text into numerical vector representations using OpenAI's embedding models.

## Objective

Given a basic Next.js application, add text embedding support that includes:
- An API route at `/api/embed` that uses the `embed` function from AI SDK
- OpenAI's `text-embedding-3-small` model for generating embeddings
- Sample text processing ("sunny day at the beach")
- Return both embedding vectors and usage information as JSON

## Starting Point

The input project includes:
- A basic Next.js application setup
- TypeScript configuration
- ESLint and Vitest testing setup
- Test suite to validate the implementation

## Expected Implementation

The goal is to create an embedding API endpoint using the AI SDK:

```typescript
// Expected embedding implementation
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

export async function GET() {
  const { embedding, usage } = await embed({
    model: openai.textEmbeddingModel('text-embedding-3-small'),
    value: 'sunny day at the beach',
  });

  return Response.json({
    embedding,
    usage,
  });
}
```

## Test Coverage

The test suite validates:
- Presence of `/api/embed/route.ts` file in correct location
- GET function export from the route handler
- Import of `embed` function from AI SDK
- Use of OpenAI text embedding model
- Specific model (`text-embedding-3-small`) configuration
- Return of both embedding vector and usage data
- Proper JSON response format

## Usage

The endpoint can be called to generate embeddings:
- GET request to `/api/embed`
- Returns a JSON response with embedding vector and usage statistics
- Embedding vector represents the semantic meaning of "sunny day at the beach"

## Applications

Text embeddings enable various AI applications:
- **Semantic Search**: Find similar documents based on meaning rather than keywords
- **Document Similarity**: Compare texts for content similarity
- **Content Recommendation**: Suggest related content based on semantic similarity
- **RAG Systems**: Retrieve relevant documents for question answering

## Evaluation Criteria

Success is measured by:
1. Proper embedding API implementation using AI SDK
2. Correct use of OpenAI's text-embedding-3-small model
3. Return of both embedding vector and usage information
4. Proper JSON response structure
5. All tests passing
