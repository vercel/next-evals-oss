import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page, { metadata } from './page';

test('Page renders Page Content', () => {
  render(<Page />);
  expect(screen.getByText('Page Content')).toBeDefined();
});

test('Metadata export has correct title and description', () => {
  expect(metadata.title).toBe('My Page');
  expect(metadata.description).toBe('Test');
});
