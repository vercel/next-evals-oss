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

test('Chat API implements multi-step tool calling with getLocation and getWeather', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);
  expect(apiRouteExists).toBe(true);

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should have both getLocation and getWeather tools
  expect(routeContent).toMatch(/getLocation/);
  expect(routeContent).toMatch(/getWeather/);
  
  // Should use zod for parameter schemas
  expect(routeContent).toMatch(/zod|z\./);
  
  // Should have stopWhen with stepCountIs(5) for multi-step tool calling
  expect(routeContent).toMatch(/stopWhen/);
  expect(routeContent).toMatch(/stepCountIs\(5\)/);
  
  // Should use streamText for the response
  expect(routeContent).toMatch(/streamText/);
});

// Keep existing client-side tests since they're already there
test('Chat component renders input and messages', () => {
  render(<Page />);
  
  const input = screen.getByRole('textbox');
  expect(input).toBeDefined();

  const message = screen.getByText('Test message');
  expect(message).toBeDefined();
});

test('useChat hook is used with messages and sendMessage', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  expect(pageContent).toMatch(/import\s*{\s*useChat\s*}\s*from\s*['"]@ai-sdk\/react['"]/);
});

test('Chat component handles input changes', () => {
  render(<Page />);
  
  const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
  const input = inputs[0];
  fireEvent.change(input, { target: { value: 'Hello' } });
  
  expect(input.value).toBe('Hello'); 
});