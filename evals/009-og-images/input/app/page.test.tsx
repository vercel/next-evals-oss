import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

test('OG image file exists and contains "hello"', () => {
  const ogImagePath = join(process.cwd(), 'app', 'opengraph-image.tsx');
  const ogImageJsPath = join(process.cwd(), 'app', 'opengraph-image.js');

  const ogFileExists = existsSync(ogImagePath) || existsSync(ogImageJsPath);
  expect(ogFileExists).toBe(true);

  // Check that the OG image contains "hello" text
  if (existsSync(ogImagePath)) {
    const content = readFileSync(ogImagePath, 'utf-8');
    expect(content).toMatch(/hello/i);
    expect(content).toMatch(/ImageResponse/);
  } else if (existsSync(ogImageJsPath)) {
    const content = readFileSync(ogImageJsPath, 'utf-8');
    expect(content).toMatch(/hello/i);
    expect(content).toMatch(/ImageResponse/);
  }
});

test('Page has OG metadata export', async () => {
  // Check if the page exports generateMetadata with OG image
  const pageModule = await import('./page');

  if (pageModule.generateMetadata) {
    const metadata = await pageModule.generateMetadata();
    expect(metadata.openGraph).toBeDefined();
  } else if (pageModule.metadata) {
    expect(pageModule.metadata.openGraph).toBeDefined();
  } else {
    // If using opengraph-image.tsx file, that's also valid
    const ogImagePath = join(process.cwd(), 'app', 'opengraph-image.tsx');
    const ogImageJsPath = join(process.cwd(), 'app', 'opengraph-image.js');
    expect(existsSync(ogImagePath) || existsSync(ogImageJsPath)).toBe(true);
  }
});
