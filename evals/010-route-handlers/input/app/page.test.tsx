import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Route handler exists in correct location', () => {
  // Check for route.ts in api directory
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'process', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);

  expect(apiRouteExists).toBe(true);
});

test('Route handler exports POST function', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'process', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should export a POST function
  expect(routeContent).toMatch(/export\s+(async\s+)?function\s+POST/);

  // Should handle JSON data
  expect(routeContent).toMatch(/request\.json\(\)|await.*json\(\)/);

  // Should return JSON response
  expect(routeContent).toMatch(/Response\.json|NextResponse\.json/);
});

test('Route handler adds processed field', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'process', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should add processed: true field
  expect(routeContent).toMatch(/processed.*true|processed.*:.*true/);

  // Should spread or include original data
  expect(routeContent).toMatch(/\.\.\.|Object\.assign|spread/);
});
