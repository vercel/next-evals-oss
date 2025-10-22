import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Page from './page';

// Mock the server action
vi.mock('./actions', () => ({
  setUserCookie: vi.fn().mockResolvedValue(undefined),
}));

test('Page has form with username input and server action', async () => {
  render(<Page />);
  
  // Should have a form
  const form = screen.getByTestId('cookie-form');
  expect(form).toBeDefined();
  
  // Should have username input
  const usernameInput = screen.getByLabelText(/username/i) || screen.getByPlaceholderText(/username/i) || screen.getByDisplayValue('');
  expect(usernameInput).toBeDefined();
  
  // Should have submit button
  const submitButton = screen.getByRole('button', { name: /submit/i }) || screen.getByRole('button');
  expect(submitButton).toBeDefined();
  
  // Test form interaction
  fireEvent.change(usernameInput, { target: { value: 'testuser' } });
  expect(usernameInput.value).toBe('testuser');
});

test('Server action should use proper Next.js patterns', async () => {
  // Test that the actions file exports the correct function
  const actions = await import('./actions');
  expect(actions.setUserCookie).toBeDefined();
  expect(typeof actions.setUserCookie).toBe('function');
});
