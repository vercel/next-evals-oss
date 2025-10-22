# 036 - AI SDK Multi-Step Tool Call Implementation

This example demonstrates how to implement multi-step tool calling functionality in a Next.js chat application using the AI SDK. The task involves creating a chat interface that can call multiple tools in sequence during the same generation step to get weather information.

## Objective

Given a basic Next.js chat application, add multi-step tool calling support that includes:
- A `getLocation` tool that determines the user's current location
- A `getWeather` tool that takes a location and returns weather data
- Sequential tool execution where the AI first gets location, then weather
- Configuration to allow multiple tool calls using `stopWhen: stepCountIs(5)`

## Starting Point

The input project includes:
- A working Next.js chat application with basic AI SDK integration
- Client-side chat interface using `useChat` hook
- Server-side API route at `/api/chat` with basic `streamText` implementation
- Test suite to validate the implementation

## Expected Implementation

The goal is to extend the existing chat API to support multi-step tool calling with location and weather tools:

```typescript
// Expected multi-step tool structure
tools: {
  getLocation: {
    description: 'Get the user\'s current location',
    parameters: z.object({}), // No parameters needed
    execute: async () => {
      // Return mock location data
      return 'San Francisco, CA';
    },
  },
  getWeather: {
    description: 'Get the weather for a specific location',
    parameters: z.object({
      location: z.string().describe('The location to get the weather for'),
    }),
    execute: async ({ location }) => {
      // Return mock weather data
      return `It's 24°C and sunny in ${location}`;
    },
  },
},
stopWhen: stepCountIs(5), // Allow multiple consecutive tool calls
```

## Test Coverage

The test suite validates:
- Presence of both `getLocation` and `getWeather` tool implementations
- Multi-step tool calling configuration with `stopWhen: stepCountIs(5)`
- Zod schema validation for tool parameters
- Use of `streamText` for response generation
- Existing client-side functionality remains intact

## Usage

Users should be able to ask questions like:
- "What's the weather like?"
- "How's the weather today?"
- "Tell me about the current weather conditions"

The AI will automatically:
1. First call `getLocation` to determine where the user is
2. Then call `getWeather` with that location to get weather data
3. Provide a complete response with the weather information

## Evaluation Criteria

Success is measured by:
1. Proper multi-step tool calling implementation using AI SDK
2. Sequential tool execution (getLocation → getWeather)
3. Correct use of `stopWhen: stepCountIs(5)` for multi-step support
4. Zod schema validation for tool parameters
5. All tests passing
6. Existing chat functionality preserved
