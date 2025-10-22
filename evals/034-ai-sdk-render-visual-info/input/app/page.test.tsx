import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Page from './page';

// Mock the AI SDK React hooks
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'What is the weather in San Francisco?',
      },
      {
        id: '2',
        role: 'assistant', 
        content: 'I\'ll get the weather information for you.',
        toolInvocations: [
          {
            toolName: 'getWeatherInformation',
            toolCallId: 'call_123',
            args: { city: 'San Francisco' },
            result: {
              value: 24,
              unit: 'celsius',
              weeklyForecast: [
                { day: 'Monday', value: 24 },
                { day: 'Tuesday', value: 25 },
                { day: 'Wednesday', value: 26 },
                { day: 'Thursday', value: 27 },
                { day: 'Friday', value: 28 },
                { day: 'Saturday', value: 29 },
                { day: 'Sunday', value: 30 },
              ],
            },
          },
        ],
      },
    ],
    input: '',
    setInput: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
  }),
}));

afterEach(()=>{
  cleanup()
})

test('API route exists and uses AI SDK 5 patterns', () => {
  const apiRoutePath = join(process.cwd(), 'app', 'api', 'chat', 'route.ts');
  const apiRouteExists = existsSync(apiRoutePath);
  expect(apiRouteExists).toBe(true);

  const routeContent = readFileSync(apiRoutePath, 'utf-8');
  
  // Should use AI SDK 5 imports
  expect(routeContent).toMatch(/import.*streamText.*from\s+['"]ai['"]/);
  expect(routeContent).toMatch(/import.*tool.*from\s+['"]ai['"]/);
  expect(routeContent).toMatch(/toUIMessageStreamResponse/);
  
  // Should have getWeatherInformation tool
  expect(routeContent).toMatch(/getWeatherInformation.*tool\s*\(/);
});

test('Page uses useChat hook with proper configuration', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should import useChat from @ai-sdk/react
  expect(pageContent).toMatch(/import\s*{[^}]*useChat[^}]*}\s*from\s*['"]@ai-sdk\/react['"]/);
  
  // Should call useChat with configuration
  expect(pageContent).toMatch(/useChat\s*\(\s*{/);
});

test('Chat interface renders message input and send functionality', () => {
  render(<Page />);
  
  // Should have a text input for messages
  const input = screen.getByRole('textbox');
  expect(input).toBeDefined();
  
  // Should have a way to send messages (button or form)
  const sendButton = screen.queryByRole('button') || screen.queryByText(/send/i);
  expect(sendButton).toBeDefined();
});

test('Chat displays message history correctly', () => {
  render(<Page />);
  
  // Should display user message
  expect(screen.getByText('What is the weather in San Francisco?')).toBeDefined();
  
  // Should display assistant message
  expect(screen.getByText(/I'll get the weather information/)).toBeDefined();
});

test('Weather component renders visual data instead of text', () => {
  render(<Page />);
  
  // Should display current temperature (either format)
  const tempDisplay = screen.queryByText(/24.*celsius/i) || screen.queryByText(/24°/);
  expect(tempDisplay).toBeTruthy();
  
  // Should display weekly forecast
  expect(screen.getByText('Monday')).toBeTruthy();
  expect(screen.getByText('Tuesday')).toBeTruthy();
  expect(screen.getByText('Sunday')).toBeTruthy();
  
  // Should show forecast temperatures
  expect(screen.getByText(/30/)).toBeTruthy();
});

test('Weather component has modern UI styling', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should have some form of styling (className, style, or CSS-in-JS)
  expect(pageContent).toMatch(/className|style|styled|css/);
});

test('Tool calls render components instead of raw text', () => {
  render(<Page />);
  
  // Should not display raw tool result data as text
  expect(screen.queryByText('{"value":24')).toBeNull();
  expect(screen.queryByText('weeklyForecast')).toBeNull();
  
  // Should render the data as visual components
  const tempElement = screen.queryByText(/24.*celsius/i) || screen.queryByText(/24°/);
  expect(tempElement).toBeTruthy();
});

test('Chat interface handles loading states', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should check for isLoading state
  expect(pageContent).toMatch(/isLoading/);
});

test('Input can be updated and submitted', () => {
  render(<Page />);
  
  const input = screen.getByRole('textbox') as HTMLInputElement;
  
  // Should be able to type in input
  fireEvent.change(input, { target: { value: 'Test message' } });
  expect(input.value).toBe('Test message');
  
  // Should have submit functionality
  const form = input.closest('form');
  const submitButton = screen.queryByRole('button');
  const hasSubmitMechanism = form || submitButton;
  expect(hasSubmitMechanism).toBeTruthy();
});