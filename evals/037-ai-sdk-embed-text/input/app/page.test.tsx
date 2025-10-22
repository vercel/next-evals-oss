import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';


test('AI SDK Embed Route handler exists in correct location', () => {
  // Check for route.ts in api/embed directory
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'embed', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);

  expect(apiRouteExists).toBe(true);
});

test('AI SDK Embed Route handler exports GET function', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'embed', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should export a GET function
  expect(routeContent).toMatch(/export\s+(async\s+)?function\s+GET/);

  // Should return JSON response
  expect(routeContent).toMatch(/Response\.json/);
});

test('AI SDK Embed Route handler uses valid embedding configuration', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'embed', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should use `embed` from AI SDK package
  expect(routeContent).toMatch(/import.*embed.*from\s+['"]ai['"]/);

  // Should use OpenAI text embedding model
  expect(routeContent).toMatch(/openai.*textEmbeddingModel/);
  
  // Should use text-embedding-3-small model
  expect(routeContent).toMatch(/text-embedding-3-small/);

  // Should return both embedding and usage
  expect(routeContent).toMatch(/embedding/);
  expect(routeContent).toMatch(/usage/);

  // Should return Response.json
  expect(routeContent).toMatch(/Response\.json/);
});