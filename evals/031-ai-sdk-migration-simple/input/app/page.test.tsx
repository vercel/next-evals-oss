import { afterEach, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Page from './page';

// Mock the AI SDK hook to test component behavior
const mockSendMessage = vi.fn();

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [
      {
        id: '1',
        parts: [{ type: 'text', text: 'Test message' }],
      },
      {
        id: '2',
        parts: [{ type: 'text', text: 'Another message' }],
      },
    ],
    sendMessage: mockSendMessage,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('Chat component renders messages with parts-based structure', () => {
  render(<Page />);

  // Should render messages from the v5 parts-based structure
  expect(screen.getByText('Test message')).toBeDefined();
  expect(screen.getByText('Another message')).toBeDefined();
});

test('Chat component has input field', () => {
  render(<Page />);

  // Should have an input field for user to type messages
  const input = screen.getByRole('textbox');
  expect(input).toBeDefined();
});

test('Chat component handles input changes', () => {
  render(<Page />);

  const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
  const input = inputs[0];

  // Should be able to type in the input
  fireEvent.change(input, { target: { value: 'Hello AI' } });
  expect(input.value).toBe('Hello AI');
});

test('Chat component can send messages', () => {
  render(<Page />);

  const input = screen.getAllByRole('textbox')[0] as HTMLInputElement;
  const submitButton = screen.getByRole('button');

  // Type a message
  fireEvent.change(input, { target: { value: 'Hello' } });

  // Submit the form
  fireEvent.click(submitButton);

  // Should call sendMessage from useChat hook
  expect(mockSendMessage).toHaveBeenCalled();
});

test('Chat component clears input after sending', () => {
  render(<Page />);

  const input = screen.getAllByRole('textbox')[0] as HTMLInputElement;
  const submitButton = screen.getByRole('button');

  // Type and send a message
  fireEvent.change(input, { target: { value: 'Test message' } });
  fireEvent.click(submitButton);

  // Input should be cleared after sending
  expect(input.value).toBe('');
});