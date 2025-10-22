Migrate this Next.js project from AI SDK v4 to v5. The AI SDK package has already been upgraded but the code hasn't. Key migration requirements:
- Client: Update useChat from v4 pattern ({messages, input, setInput, append}) to v5 pattern ({messages, sendMessage})
- Server: Migrate to v5 APIs including convertToModelMessages, UIMessage types, and toUIMessageStreamResponse()
- Update message handling from simple text objects to parts-based structure
- Ensure proper AI SDK v5 APIs are used by replacing any deprecated patterns from the previous version
- Include proper types and maintain the same functionality