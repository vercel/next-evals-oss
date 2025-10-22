import {
  type InferUITools,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { z } from 'zod';

const tools: ToolSet = {
  getWeatherInformation: tool({
    description: 'show the weather in a given city to the user',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({}: { city: string }) => {
      return {
        value: 24,
        unit: 'celsius',
        weeklyForecast: [
          { day: 'Monday', value: 24 },
          { day: 'Tuesday', value: 25 },
          { day: 'Wednesday', value: 26 },
          { day: 'Thursday', value: 27 },
          { day: 'Friday', value: 28 },
          { day: 'Saturday', value: 29 },
          { day: 'Sunday', value: 30 },
        ],
      };
    },
  }),
  // client-side tool that starts user interaction:
  askForConfirmation: tool({
    description: 'Ask the user for confirmation.',
    inputSchema: z.object({
      message: z.string().describe('The message to ask for confirmation.'),
    }),
  }),
  // client-side tool that is automatically executed on the client:
  getLocation: tool({
    description:
      'Get the user location. Always ask for confirmation before using this tool.',
    inputSchema: z.object({}),
  }),
};

export type ChatTools = InferUITools<typeof tools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

export async function POST(request: Request) {
  const { messages }: { messages: ChatMessage[] } = await request.json();

  const result = streamText({
    model: 'openai/gpt-4o',
    messages: convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}