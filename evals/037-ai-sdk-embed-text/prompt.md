I want to build an API endpoint that can convert text into embeddings using the AI SDK. Here's what I need:

Create an API route at /api/embed that uses the `embed` function from the AI SDK to generate text embeddings. 

The endpoint should:
- Use OpenAI's 'text-embedding-3-small' model 
- Take some sample text like "sunny day at the beach" and convert it to embeddings
- Return both the embedding vector and usage information as JSON

Text embeddings are super useful for semantic search, document similarity, and other AI applications since they capture the meaning of text as numerical vectors.

Can you help me implement this embedding endpoint?