import { expect, test } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Page from './page';

test('Counter component increments when button is clicked', () => {
  render(<Page />);
  
  // Should have initial count of 0
  expect(screen.getByText('Count: 0')).toBeDefined();
  
  // Should have increment button
  const button = screen.getByRole('button', { name: /increment/i });
  expect(button).toBeDefined();
  
  // Click button and count should increment
  fireEvent.click(button);
  expect(screen.getByText('Count: 1')).toBeDefined();
  
  // Click again
  fireEvent.click(button);
  expect(screen.getByText('Count: 2')).toBeDefined();
});
