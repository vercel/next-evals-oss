# 035 - AI SDK Tool Call Implementation

This example demonstrates how to implement tool calling functionality in a Next.js chat application using the AI SDK. The task involves adding a weather tool to an existing chat API that allows users to ask about weather information.

## Objective

Given a basic Next.js chat application, add tool calling support that includes:
- A weather tool that accepts city name and temperature unit (C or F) as parameters
- Mock weather data response
- Proper tool calling configuration using AI SDK

## Starting Point

The input project includes:
- A working Next.js chat application with basic AI SDK integration
- Client-side chat interface using `useChat` hook
- Server-side API route at `/api/chat` with basic `streamText` implementation
- Test suite to validate the implementation

## Expected Implementation

The goal is to extend the existing chat API to support tool calling with a weather tool:

```typescript
// Expected weather tool structure
tools: {
  getWeather: {
    description: 'Get the weather for a location',
    parameters: z.object({
      city: z.string().describe('The city to get the weather for'),
      unit: z.enum(['C', 'F']).describe('The unit to display the temperature in'),
    }),
    execute: async ({ city, unit }) => {
      // Return mock weather data
      return `It is currently 24°${unit} and Sunny in ${city}!`;
    },
  },
}
```

## Test Coverage

The test suite validates:
- Presence of a weather tool implementation
- Correct parameter handling (city and unit)
- Weather data response functionality
- Existing client-side functionality remains intact

## Usage

Users should be able to ask questions like:
- "What's the weather in San Francisco?"
- "Tell me the weather in Tokyo in Celsius"
- "How's the weather in London in Fahrenheit?"

The tool will respond with mock weather data in the specified format and unit.

## Evaluation Criteria

Success is measured by:
1. Proper tool calling implementation using AI SDK
2. Correct parameter validation and handling
3. Mock weather data returned in expected format
4. All tests passing
5. Existing chat functionality preserved
