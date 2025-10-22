import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Page from './page';

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [
      {
        id: '1',
        parts: [{ type: 'text', text: 'Test message' }],
      },
    ],
    sendMessage: vi.fn(),
  }),
}));

afterEach(()=>{
  cleanup()
})

test('AI SDK Chat Route handler exists in correct location', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);

  expect(apiRouteExists).toBe(true);
});

test('AI SDK Chat Route handler uses correct imports and exports', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should import required functions from AI SDK
  expect(routeContent).toMatch(/import.*convertToModelMessages.*from\s+['"]ai['"]/);
  expect(routeContent).toMatch(/import.*streamText.*from\s+['"]ai['"]/);
  expect(routeContent).toMatch(/import.*type\s+UIMessage.*from\s+['"]ai['"]/);

  // Should export POST function
  expect(routeContent).toMatch(/export\s+(async\s+)?function\s+POST/);
});

test('AI SDK Chat Route handler uses correct configuration', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should use streamText with correct configuration
  expect(routeContent).toMatch(/streamText\s*\(\s*\{/);
  expect(routeContent).toMatch(/model:\s*['"]openai\/gpt-4o['"]/);
  expect(routeContent).toMatch(/system:\s*['"]You are a helpful assistant\./);
  expect(routeContent).toMatch(/messages:\s*convertToModelMessages\s*\(\s*messages\s*\)/);
  expect(routeContent).toMatch(/result\.toUIMessageStreamResponse\s*\(\s*\)/);
});

test('AI SDK Chat Route handler does not await streamText', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');

  if (!existsSync(apiRoutePath)) {
    throw new Error('Route handler file does not exist');
  }

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should not have await before streamText
  expect(routeContent).not.toMatch(/await\s+streamText/);
  // Double check the streamText is actually called
  expect(routeContent).toMatch(/const\s+result\s*=\s*streamText/);
});

test('Chat component renders input and messages', () => {
  render(<Page />);
  
  // Check if input exists
  const input = screen.getByRole('textbox');
  expect(input).toBeDefined();

  // Check if test message is rendered
  const message = screen.getByText('Test message');
  expect(message).toBeDefined();
});

test('useChat hook is used with messages and sendMessage', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Check if useChat is imported
  expect(pageContent).toMatch(/import\s*{\s*useChat\s*}\s*from\s*['"]@ai-sdk\/react['"]/);
});

test('useChat hook uses correct destructuring pattern', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should not use the old destructuring pattern
  expect(pageContent).not.toMatch(/const\s*{\s*messages,\s*input,\s*setInput,\s*append\s*}\s*=\s*useChat\s*\(\s*\)/);
  
  // Should use the new destructuring pattern with configuration object
  expect(pageContent).toMatch(/const\s*{\s*messages,\s*sendMessage\s*}\s*=\s*useChat\s*\(\s*{/);
});

test('Chat component handles input changes', () => {
  render(<Page />);
  
  const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
  const input = inputs[0];
  fireEvent.change(input, { target: { value: 'Hello' } });
  
  expect(input.value).toBe('Hello'); 
});