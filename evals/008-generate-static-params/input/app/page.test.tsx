import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

test('Dynamic route exists with generateStaticParams', () => {
  const dynamicRoutePath = join(
    process.cwd(),
    'app',
    'blog',
    '[id]',
    'page.tsx'
  );
  expect(existsSync(dynamicRoutePath)).toBe(true);

  const content = readFileSync(dynamicRoutePath, 'utf-8');

  // Should have generateStaticParams function
  expect(content).toMatch(
    /export.*function.*generateStaticParams|generateStaticParams.*export/
  );

  // Should NOT use Pages Router getStaticPaths
  expect(content).not.toMatch(/getStaticPaths/);

  // Should NOT have 'use client' directive
  expect(content).not.toMatch(/['"]use client['"];?/);
});

test('generateStaticParams returns correct structure', async () => {
  const dynamicRoutePath = join(
    process.cwd(),
    'app',
    'blog',
    '[id]',
    'page.tsx'
  );

  if (existsSync(dynamicRoutePath)) {
    const content = readFileSync(dynamicRoutePath, 'utf-8');

    // Should return array with id: '1'
    expect(content).toMatch(/\[\s*\{\s*id\s*:\s*['"]1['"].*\}\s*\]/);

    // Try to dynamically import and test the function
    try {
      // This is a simplified check - in real usage, the function would be properly imported
      const hasCorrectReturn =
        content.includes("{ id: '1' }") || content.includes('{ id: "1" }');
      expect(hasCorrectReturn).toBe(true);
    } catch {
      // Fallback to content checking
      expect(content).toMatch(/id.*['"]1['\"]/);
    }
  }
});
