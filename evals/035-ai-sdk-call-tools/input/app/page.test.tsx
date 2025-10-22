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

test('Chat API implements a weather tool', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);
  expect(apiRouteExists).toBe(true);

  const routeContent = readFileSync(apiRoutePath, 'utf-8');

  // Should have a weather tool that takes city and unit
  expect(routeContent).toMatch(/getWeather/);
  expect(routeContent).toMatch(/city/);
  expect(routeContent).toMatch(/unit/);
  
  // Should return weather data
  expect(routeContent).toMatch(/weather/);
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