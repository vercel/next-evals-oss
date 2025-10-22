I want to build a chat API that can connect to MCP (Model Context Protocol) servers to dynamically access tools and resources. Here's what I need:

Create a chat API route that uses the AI SDK's experimental MCP client functionality to connect to external MCP servers and use their tools.

The API should:
- Use `createMCPClient` from the AI SDK to create an MCP client. The function may be exported as `experimental_createMCPClient`, so you’ll need to alias it on import.
- Connect to an MCP server running on `http://localhost:3000/mcp` using `StreamableHTTPClientTransport`
- Dynamically fetch available tools from the MCP server using `.tools()`
- Use those tools in `streamText` for the AI response
- Properly handle client cleanup with `onFinish` and `onError` callbacks to close the MCP connection

MCP allows AI applications to securely connect to external data sources and tools, making the AI much more powerful by giving it access to live data and services.

Can you help me implement this MCP-enabled chat API?