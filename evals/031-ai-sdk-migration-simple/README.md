# 033 - AI SDK v4 to v5 Migration

This example demonstrates how to migrate a simple chat application from AI SDK v4 to v5. The main changes involve updating the client-side hook usage and message handling patterns.

## Key Changes

### Client-Side Changes (`app/page.tsx`)

#### 1. useChat Hook Usage
**Before (v4):**
```tsx
const { messages, input, setInput, append } = useChat();
```

**After (v5):**
```tsx
const { messages, sendMessage } = useChat();
```

#### 2. Message Handling
**Before (v4):**
- Used `input` and `setInput` from useChat hook
- Used `append` to add messages
- Messages were simple objects with `content` and `role`

**After (v5):**
- Manage input state locally with useState
- Use `sendMessage` with structured message parts
- Messages now use a parts-based structure for richer content types

### Server-Side Changes (`app/api/chat/route.ts`)

The server-side implementation remains relatively similar, with some refinements in the API:

```typescript
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

## Testing Changes

The migration includes updated tests to verify:
- Correct hook usage pattern
- Proper message structure handling
- API endpoint implementation
- Component rendering and interaction

## Migration Steps

1. Update the useChat hook destructuring to use `messages` and `sendMessage`
2. Add local state management for input handling
3. Update message sending to use the new parts-based structure
4. Update message rendering to handle the parts-based message format
5. Update tests to verify new patterns and structures

## Benefits of v5

- More structured message handling with parts-based system
- Clearer separation of input state management
- More explicit transport configuration
- Better support for different types of message content

This example serves as a reference for migrating simple chat applications from AI SDK v4 to v5, focusing on the core changes in hook usage and message handling patterns.
