# 038 - AI SDK MCP (Model Context Protocol) Implementation

This example demonstrates how to implement MCP (Model Context Protocol) client functionality in a Next.js chat application using the AI SDK. The task involves connecting to external MCP servers to dynamically access tools and resources.

## Objective

Given a basic Next.js chat application, add MCP client support that includes:
- Connection to external MCP servers using `experimental_createMCPClient`
- Dynamic tool fetching from MCP servers
- Proper client lifecycle management with cleanup
- Integration with `streamText` for AI responses

## Starting Point

The input project includes:
- A working Next.js chat application with basic AI SDK integration
- Client-side chat interface using `useChat` hook
- Server-side API route at `/api/chat` ready for MCP integration
- Test suite to validate the implementation

## Expected Implementation

The goal is to extend the existing chat API to support MCP connectivity:

```typescript
// Expected MCP implementation
import { experimental_createMCPClient, streamText } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  try {
    // Connect to MCP server
    const httpTransport = new StreamableHTTPClientTransport(
      new URL('http://localhost:3000/mcp'),
    );
    const httpClient = await experimental_createMCPClient({
      transport: httpTransport,
    });

    const tools = await httpClient.tools();

    const response = streamText({
      model: 'openai/gpt-4o',
      tools,
      prompt,
      onFinish: async () => {
        await httpClient.close();
      },
      onError: async error => {
        await httpClient.close();
      },
    });

    return response.toTextStreamResponse();
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

## Test Coverage

The test suite validates:
- Use of `experimental_createMCPClient` from AI SDK
- `StreamableHTTPClientTransport` for HTTP MCP connections
- Connection to MCP server at `http://localhost:3000/mcp`
- Dynamic tool fetching with `httpClient.tools()`
- Integration with `streamText` function
- Proper client cleanup in `onFinish` and `onError` handlers
- Existing client-side functionality remains intact

## Usage

The MCP-enabled chat can:
- Connect to external MCP servers dynamically
- Access tools and resources provided by MCP servers
- Use those tools to answer user questions with live data
- Automatically manage connection lifecycle

## MCP Benefits

Model Context Protocol enables:
- **Dynamic Tool Access**: Connect to external services without hardcoding tools
- **Live Data Integration**: Access real-time information from various sources
- **Secure Connections**: Controlled access to external resources
- **Extensibility**: Easy addition of new capabilities via MCP servers

## Evaluation Criteria

Success is measured by:
1. Proper MCP client implementation using AI SDK experimental features
2. Correct use of `StreamableHTTPClientTransport` for HTTP connections
3. Dynamic tool fetching from MCP servers
4. Proper integration with `streamText`
5. Correct client lifecycle management (cleanup on finish/error)
6. All tests passing
7. Existing chat functionality preserved
