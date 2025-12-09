import { expect, test, vi, beforeEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { renderToString } from 'react-dom/server';

// Mock fetch for server components
beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve([
        { id: 1, title: 'Post 1', content: 'Content 1' },
        { id: 2, title: 'Post 2', content: 'Content 2' },
      ]),
    })
  ) as any;
});

test('Root layout exists and replaces _app/_document', async () => {
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
  expect(existsSync(layoutPath)).toBe(true);

  // Import and render the layout
  const RootLayout = (await import('./layout')).default;
  const html = renderToString(
    <RootLayout>
      <div>Test content</div>
    </RootLayout>
  );

  // Should render html and body tags
  expect(html).toContain('<html');
  expect(html).toContain('lang=');
  expect(html).toContain('<body');
  expect(html).toContain('Test content');
});

test('Home page migrated to Server Component with async data fetching', async () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  expect(existsSync(pagePath)).toBe(true);

  // Import and call the page component
  const Page = (await import('./page')).default;

  // Should be async (server component pattern)
  expect(Page.constructor.name).toBe('AsyncFunction');

  // Call the async component and verify it renders
  const result = await Page();
  const html = renderToString(result);

  // Should render content successfully
  expect(html.length).toBeGreaterThan(0);
});

test('Blog index migrated with ISR equivalent', async () => {
  const blogPath = join(process.cwd(), 'app', 'blog', 'page.tsx');
  expect(existsSync(blogPath)).toBe(true);

  // Import and verify the blog page
  const BlogPage = (await import('./blog/page')).default;

  // Should be async (server component)
  expect(BlogPage.constructor.name).toBe('AsyncFunction');

  // Call and render the component
  const result = await BlogPage();
  const html = renderToString(result);

  // Should render successfully
  expect(html.length).toBeGreaterThan(0);
});

test('Dynamic blog route migrated to generateStaticParams', async () => {
  const dynamicPath = join(process.cwd(), 'app', 'blog', '[id]', 'page.tsx');
  expect(existsSync(dynamicPath)).toBe(true);

  // Import the dynamic page
  const module = await import('./blog/[id]/page');
  const DynamicPage = module.default;

  // Should have generateStaticParams function exported
  expect(module.generateStaticParams).toBeDefined();
  expect(typeof module.generateStaticParams).toBe('function');

  // Should be async server component
  expect(DynamicPage.constructor.name).toBe('AsyncFunction');

  // Test with a params object
  const result = await DynamicPage({ params: { id: '1' } });
  const html = renderToString(result);

  // Should render successfully
  expect(html.length).toBeGreaterThan(0);
});

test('API routes migrated to Route Handlers', async () => {
  // Check posts index route
  const postsRoutePath = join(process.cwd(), 'app', 'api', 'posts', 'route.ts');
  expect(existsSync(postsRoutePath)).toBe(true);

  // Import and test the route handler
  const postsRoute = await import('./api/posts/route');

  // Should export GET or POST functions
  const hasGetOrPost = postsRoute.GET !== undefined || postsRoute.POST !== undefined;
  expect(hasGetOrPost).toBe(true);

  // Check dynamic API route
  const dynamicApiPath = join(
    process.cwd(),
    'app',
    'api',
    'posts',
    '[id]',
    'route.ts'
  );
  expect(existsSync(dynamicApiPath)).toBe(true);

  // Import and test dynamic route
  const dynamicRoute = await import('./api/posts/[id]/route');

  // Should export GET, PUT, or DELETE
  const hasMethods =
    dynamicRoute.GET !== undefined ||
    dynamicRoute.PUT !== undefined ||
    dynamicRoute.DELETE !== undefined;
  expect(hasMethods).toBe(true);
});

test('Metadata API used in pages', async () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  expect(existsSync(pagePath)).toBe(true);

  // Import and check for metadata export
  const pageModule = await import('./page');

  // Should have metadata export (object or function)
  expect(pageModule.metadata || pageModule.generateMetadata).toBeDefined();

  // Check blog page too
  const blogPath = join(process.cwd(), 'app', 'blog', 'page.tsx');
  if (existsSync(blogPath)) {
    const blogModule = await import('./blog/page');
    expect(blogModule.metadata || blogModule.generateMetadata).toBeDefined();
  }
});

test('Error handling migrated to error.tsx and not-found.tsx', async () => {
  // Check for error.tsx file
  const errorPath = join(process.cwd(), 'app', 'error.tsx');
  expect(existsSync(errorPath)).toBe(true);

  // Import and test error component
  const ErrorComponent = (await import('./error')).default;

  // Should render with error props
  const mockError = new Error('Test error');
  const mockReset = vi.fn();

  const html = renderToString(<ErrorComponent error={mockError} reset={mockReset} />);
  expect(html.length).toBeGreaterThan(0);

  // Check for not-found.tsx file
  const notFoundPath = join(process.cwd(), 'app', 'not-found.tsx');
  expect(existsSync(notFoundPath)).toBe(true);

  // Import and test not-found component
  const NotFoundComponent = (await import('./not-found')).default;
  const notFoundHtml = renderToString(<NotFoundComponent />);
  expect(notFoundHtml.length).toBeGreaterThan(0);
});

test('Pages directory is removed', () => {
  // The pages directory should be completely removed after migration
  const pagesPath = join(process.cwd(), 'pages');
  expect(existsSync(pagesPath)).toBe(false);
});
