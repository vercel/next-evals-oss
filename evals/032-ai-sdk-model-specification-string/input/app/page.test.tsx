import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';


test('AI SDK Generate Route handler exists in correct location', () => {
  // Check for route.ts in api directory
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);

  expect(apiRouteExists).toBe(true);
});

test('AI SDK Generate Route handler exports GET function', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should export a GET function
  expect(routeContent).toMatch(/export\s+(async\s+)?function\s+GET/);

  // Should return JSON response
  expect(routeContent).toMatch(/Response\.json/);
});

test('AI SDK Generate Route handler uses valid AI SDK configuration', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should use `generateText` from AI SDK package
  expect(routeContent).toMatch(/import.*generateText.*from\s+['"]ai['"]/);

  // Should use the creator/model syntax as a string to specify the model
  expect(routeContent).toMatch(/model:\s*['"][a-z0-9-_]+\/[a-z0-9-.:]+['"]/i)

  // Should return Response.json
  expect(routeContent).toMatch(/Response\.json/);
});