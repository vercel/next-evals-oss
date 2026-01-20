I need an API endpoint that processes JSON data.

When I POST JSON to `/api/process`, it should return the same data back with an additional field `processed: true` added to it.

For example, if I send `{"name": "test"}`, I should get back `{"name": "test", "processed": true}`.