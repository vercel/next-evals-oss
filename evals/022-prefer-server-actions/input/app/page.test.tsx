import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

test('renders contact form with heading', () => {
  render(<Page />);
  expect(screen.getByText('Contact Us')).toBeDefined();
});

test('form has all required input fields', () => {
  render(<Page />);

  // Check for name input
  const nameInput = screen.getByLabelText(/name/i) || screen.getByPlaceholderText(/name/i);
  expect(nameInput).toBeDefined();
  expect(nameInput.getAttribute('name')).toBe('name');

  // Check for email input
  const emailInput = screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
  expect(emailInput).toBeDefined();
  expect(emailInput.getAttribute('name')).toBe('email');

  // Check for message input (textarea or input)
  const messageInput = screen.getByLabelText(/message/i) || screen.getByPlaceholderText(/message/i);
  expect(messageInput).toBeDefined();
  expect(messageInput.getAttribute('name')).toBe('message');
});

test('form has submit button', () => {
  render(<Page />);

  const submitButton = screen.getByRole('button', { name: /submit/i });
  expect(submitButton).toBeDefined();
  expect(submitButton.getAttribute('type')).toBe('submit');
});

test('form uses server action (has action attribute)', () => {
  render(<Page />);

  // Get the form element
  const form = screen.getByRole('form') || document.querySelector('form');
  expect(form).toBeDefined();

  // Server actions are passed as the action prop - should exist
  expect(form?.getAttribute('action')).toBeTruthy();
});

test('form does not use client-side event handlers', () => {
  render(<Page />);

  const form = screen.getByRole('form') || document.querySelector('form');

  // Server action forms should NOT have onSubmit handlers
  expect(form?.getAttribute('onsubmit')).toBeNull();
});
