import { expect, test, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

vi.mock('@ai-sdk/react', () => ({
  useCompletion: () => ({
    complete: vi.fn(),
    completion: 'Test message',
  }),
}));

test('Chat API implements MCP client functionality', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'completion', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);
  expect(apiRouteExists).toBe(true);

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should use createMCPClient from AI SDK
  expect(routeContent).toMatch(/createMCPClient/);
  
  // Should use StreamableHTTPClientTransport for MCP connections
  expect(routeContent).toMatch(/StreamableHTTPClientTransport/);
  
  // Should connect to MCP server
  expect(routeContent).toMatch(/http:\/\/localhost:3000\/mcp/);
  
  // Should get tools from MCP client (flexible about variable name)
  expect(routeContent).toMatch(/\.tools\(\)/);
  
  // Should use streamText with MCP tools
  expect(routeContent).toMatch(/streamText/);
  
  // Should handle client cleanup onFinish and onError
  expect(routeContent).toMatch(/onFinish/);
  expect(routeContent).toMatch(/onError/);
  expect(routeContent).toMatch(/\.close\(\)/);
});

test('useCompletion hook is used with complete and completion', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  expect(pageContent).toMatch(/import\s*{\s*useCompletion\s*}\s*from\s*['"]@ai-sdk\/react['"]/);
});
