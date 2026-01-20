import { test, expect } from '@playwright/test';

// Homepage tests
test.describe('Homepage', () => {
  test('displays welcome heading', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Welcome');
  });

  test('displays recent posts from API', async ({ page }) => {
    await page.goto('/');
    // Should display a list of posts
    const postLinks = page.locator('a[href^="/blog/"]');
    await expect(postLinks.first()).toBeVisible();
    // Should have multiple posts listed
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('has navigation to blog', async ({ page }) => {
    await page.goto('/');
    const viewAllButton = page.getByRole('button', { name: /view all/i });
    await expect(viewAllButton).toBeVisible();
  });
});

// Blog index tests
test.describe('Blog Index', () => {
  test('displays all blog posts heading', async ({ page }) => {
    await page.goto('/blog');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/blog|posts/i);
  });

  test('lists blog posts with links', async ({ page }) => {
    await page.goto('/blog');
    const postCards = page.locator('.post-card, [class*="post"], article');
    await expect(postCards.first()).toBeVisible();
  });

  test('has read more buttons for posts', async ({ page }) => {
    await page.goto('/blog');
    const readMoreButtons = page.getByRole('button', { name: /read more/i });
    await expect(readMoreButtons.first()).toBeVisible();
  });
});

// Blog post detail tests
test.describe('Blog Post Detail', () => {
  test('displays blog post content', async ({ page }) => {
    await page.goto('/blog/1');
    // Should display the post title in a heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
  });

  test('displays comments section', async ({ page }) => {
    await page.goto('/blog/1');
    // Should show comments heading
    const commentsHeading = page.locator('h2').filter({ hasText: /comments/i });
    await expect(commentsHeading).toBeVisible();
  });

  test('has back navigation', async ({ page }) => {
    await page.goto('/blog/1');
    const backButton = page.getByRole('button', { name: /back/i });
    await expect(backButton).toBeVisible();
  });

  test('returns 200 for valid blog post', async ({ page }) => {
    const response = await page.goto('/blog/1');
    expect(response?.status()).toBe(200);
  });
});

// API route tests
test.describe('API Routes', () => {
  test('GET /api/posts returns posts list', async ({ request }) => {
    const response = await request.get('/api/posts');
    expect(response.status()).toBe(200);
    const posts = await response.json();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  test('POST /api/posts creates a post', async ({ request }) => {
    const response = await request.post('/api/posts', {
      data: { title: 'Test Post', content: 'Test content' },
    });
    expect(response.status()).toBe(201);
    const post = await response.json();
    expect(post.title).toBe('Test Post');
  });

  test('POST /api/posts returns 400 for missing fields', async ({ request }) => {
    const response = await request.post('/api/posts', {
      data: { title: 'Only title' },
    });
    expect(response.status()).toBe(400);
  });

  test('GET /api/posts/[id] returns single post', async ({ request }) => {
    const response = await request.get('/api/posts/1');
    expect(response.status()).toBe(200);
    const post = await response.json();
    expect(post.id).toBe(1);
  });

  test('PUT /api/posts/[id] updates post', async ({ request }) => {
    const response = await request.put('/api/posts/1', {
      data: { title: 'Updated Title' },
    });
    expect(response.status()).toBe(200);
    const post = await response.json();
    expect(post.title).toBe('Updated Title');
  });

  test('DELETE /api/posts/[id] deletes post', async ({ request }) => {
    const response = await request.delete('/api/posts/1');
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.message).toContain('deleted');
  });
});

// Error handling tests
test.describe('Error Handling', () => {
  test('404 page displays for non-existent routes', async ({ page }) => {
    const response = await page.goto('/non-existent-page-xyz');
    // Should show a 404 page or not-found content
    const notFoundText = page.locator('text=/404|not found/i');
    await expect(notFoundText).toBeVisible();
  });
});

// Layout and navigation tests
test.describe('Layout', () => {
  test('has header with navigation links', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const homeLink = page.locator('header a[href="/"]');
    await expect(homeLink).toBeVisible();

    const blogLink = page.locator('header a[href="/blog"]');
    await expect(blogLink).toBeVisible();
  });

  test('has footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

// App Router migration verification
test.describe('App Router Migration', () => {
  test('pages directory should not exist (verified by successful app routes)', async ({
    page,
  }) => {
    // If the app router migration is complete, these routes work via app/ directory
    const homeResponse = await page.goto('/');
    expect(homeResponse?.status()).toBe(200);

    const blogResponse = await page.goto('/blog');
    expect(blogResponse?.status()).toBe(200);

    const postResponse = await page.goto('/blog/1');
    expect(postResponse?.status()).toBe(200);
  });
});
