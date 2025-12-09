import { expect, test, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import Page from './page';

// Mock fetch to test server component behavior
const mockProducts = [
  { id: 1, name: 'First Product' },
  { id: 2, name: 'Second Product' },
  { id: 3, name: 'Third Product' },
];

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockProducts),
    })
  ) as any;
});

test('Page component is async (server component)', async () => {
  // Server components must be async functions
  expect(Page.constructor.name).toBe('AsyncFunction');
});

test('Page fetches data and renders first product', async () => {
  // Call the async server component
  const result = await Page();

  // Render the component to HTML
  const html = renderToString(result);

  // Should render the first product name in an h1
  expect(html).toContain('<h1');
  expect(html).toContain('First Product');

  // Should NOT render other products
  expect(html).not.toContain('Second Product');
  expect(html).not.toContain('Third Product');
});

test('Page calls fetch with correct API endpoint', async () => {
  await Page();

  // Verify fetch was called with the correct URL
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('api.vercel.app/products'),
    expect.anything()
  );
});

test('Page renders h1 element with product name', async () => {
  const result = await Page();
  const html = renderToString(result);

  // Check that h1 contains the product name
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
  expect(h1Match).toBeTruthy();
  expect(h1Match?.[1]).toContain('First Product');
});
