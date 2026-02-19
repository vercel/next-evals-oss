/**
 * Instant Navigations
 *
 * Verifies that the agent enables instant navigation on the products route.
 *
 * Structural checks: unstable_instant export and getProducts import must exist.
 * Behavioral check: `next build` passes (validates caching + unstable_instant
 * config), then `next start` + Puppeteer + the Next.js instant navigation
 * testing API verifies the static shell renders immediately and product data
 * streams in after unlock.
 */

import { expect, test, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';
import net from 'net';
import puppeteer, { type Browser } from 'puppeteer-core';

// ---------------------------------------------------------------------------
// Source-file helpers (for structural checks)
// ---------------------------------------------------------------------------

type SourceFile = { path: string; content: string };

const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

const IGNORE_FILES = new Set(['EVAL.ts', 'PROMPT.md']);

function readSourceFiles(dir: string): SourceFile[] {
  if (!existsSync(dir)) return [];

  const files: SourceFile[] = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...readSourceFiles(fullPath));
      continue;
    }

    if (IGNORE_FILES.has(entry)) continue;

    if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push({
        path: fullPath,
        content: readFileSync(fullPath, 'utf-8'),
      });
    }
  }

  return files;
}

const sourceFiles = readSourceFiles(process.cwd());
const source = sourceFiles.map((file) => file.content).join('\n');

// ---------------------------------------------------------------------------
// E2e infrastructure
// ---------------------------------------------------------------------------

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get port'));
      }
    });
    server.on('error', reject);
  });
}

async function waitForServer(
  url: string,
  timeoutMs = 30_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function instant(page: any, fn: () => Promise<void>) {
  await page.evaluate(() => (window as any).__EXPERIMENTAL_NEXT_TESTING__.navigation.lock());
  try {
    return await fn();
  } finally {
    await page.evaluate(() => (window as any).__EXPERIMENTAL_NEXT_TESTING__.navigation.unlock());
  }
}

let serverProcess: ChildProcess | undefined;
let port: number;
let browser: Browser;

beforeAll(async () => {
  // Build (skip if .next already exists from the scripts step)
  if (!existsSync(join(process.cwd(), '.next'))) {
    execSync('npx next build', { cwd: process.cwd(), stdio: 'pipe' });
  }

  // Start server on a random port
  port = await getAvailablePort();
  serverProcess = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  await waitForServer(`http://localhost:${port}`);

  // Ensure @sparticuz/chromium detects the serverless environment and extracts
  // its bundled system libraries (libnspr4, libnss3, etc.) to /tmp/al2023/lib.
  process.env['VERCEL'] = '1';
  const chromium = (await import('@sparticuz/chromium')).default;

  browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}, 120_000);

afterAll(async () => {
  if (browser) {
    await browser.close();
  }
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = undefined;
  }
});

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

test('unstable_instant exported with prefetch from the products route', () => {
  const productsPage = sourceFiles.find(
    (f) =>
      f.path.includes('products') &&
      /page\.(tsx?|jsx?)$/.test(f.path)
  );

  expect(productsPage!.content).toMatch(
    /export\s+(const|var|let)\s+unstable_instant\b/
  );
});

test('Uses getProducts from lib/data', () => {
  expect(source).toMatch(/import.*getProducts.*from\s+['"]@\/lib\/data['"]/);
  expect(source).toMatch(/getProducts\s*\(/);
});

// ---------------------------------------------------------------------------
// E2e behavioral test (instant navigation testing API)
// ---------------------------------------------------------------------------

test('Static shell renders instantly, dynamic data streams in after unlock', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0' });

    await instant(page, async () => {
      await page.click('a[href="/products"]');

      // The static shell should render immediately while the lock is held
      await page.waitForFunction(
        () => document.querySelector('h1')?.textContent === 'Product Catalog',
        { timeout: 10_000 }
      );
    });

    // After unlock, dynamic data streams in
    await page.waitForFunction(
      () => document.body?.textContent?.includes('Laptop'),
      { timeout: 10_000 }
    );

    const text = await page.evaluate(() => document.body?.textContent ?? '');
    expect(text).toContain('Laptop');
    expect(text).toContain('Phone');
  } finally {
    await page.close();
  }
}, 30_000);
