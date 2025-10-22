I want to build a chat app that can call multiple tools in sequence to get weather information. Here's what I need:

Create a React chat component using the useChat hook from @ai-sdk/react that connects to an /api/chat endpoint.

For the API route, I need it to use streamText with two tools:
1. getLocation - gets the user's current location 
2. getWeather - takes a location and returns weather data

The cool part is I want the AI to be able to call these tools in multiple steps during the same response. So if someone asks "What's the weather like?", it should first call getLocation to find where they are, then call getWeather with that location.

Use zod for the tool parameter schemas. And set up the stopWhen option with stepCountIs(5) so the model can make multiple tool calls in sequence.

Can you help me build this?