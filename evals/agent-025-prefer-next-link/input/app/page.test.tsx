import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Navigation from './Navigation';

test('Navigation component has required links', () => {
  render(<Navigation />);

  // Check for blog link
  const blogLink = screen.getByRole('link', { name: /blog/i });
  expect(blogLink).toBeDefined();
  expect(blogLink.getAttribute('href')).toBe('/blog');

  // Check for products link
  const productsLink = screen.getByRole('link', { name: /products/i });
  expect(productsLink).toBeDefined();
  expect(productsLink.getAttribute('href')).toBe('/products');

  // Check for support link
  const supportLink = screen.getByRole('link', { name: /support/i });
  expect(supportLink).toBeDefined();
  expect(supportLink.getAttribute('href')).toBe('/support');
});

test('Navigation uses Next.js Link component', () => {
  const navContent = readFileSync(
    join(process.cwd(), 'app', 'Navigation.tsx'),
    'utf-8'
  );

  // Should import Link from next/link
  expect(navContent).toMatch(/import.*Link.*from ['"]next\/link['"]/);

  // Should use Link components, not anchor tags for navigation
  expect(navContent).toMatch(/<Link/);

  // Should not use anchor tags for internal navigation
  const anchorMatches = navContent.match(
    /<a [^>]*href=["']\/[^"']*["'][^>]*>/g
  );
  expect(anchorMatches).toBeNull();
});
