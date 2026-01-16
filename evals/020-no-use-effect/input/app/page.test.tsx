import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Page from './page';

beforeEach(() => {
  // Reset navigator mock before each test
  vi.resetAllMocks();
});

afterEach(()=>{
  cleanup()
})

test('Page has client directive', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  expect(pageContent).toMatch(/['"]use client['"];?/);
});

test('Page does not use useEffect', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  expect(pageContent).not.toMatch(/useEffect/);
});

test('Page uses proper SSR-safe patterns for navigator access', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should use SSR-safe patterns for accessing navigator
  // Valid patterns include:
  // - typeof navigator !== 'undefined' (check before access)
  // - typeof navigator === 'undefined' (early return pattern)
  // - typeof window !== 'undefined' / === 'undefined'
  // - navigator?.userAgent (optional chaining)
  const hasSSRSafePattern =
    /typeof\s+(navigator|window)\s*[!=]==\s*['"]undefined['"]/.test(pageContent) ||
    /navigator\?\.(userAgent|platform)/.test(pageContent);

  expect(hasSSRSafePattern).toBe(true);
});

test('Page contains Safari detection logic that excludes Chrome', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should have Safari detection - can use includes(), indexOf(), or regex
  // e.g., userAgent.includes('Safari'), /Safari/.test(userAgent), etc.
  const hasSafariDetection =
    /Safari/.test(pageContent) && /userAgent/.test(pageContent);
  expect(hasSafariDetection).toBe(true);

  // Should exclude Chrome from Safari detection
  // e.g., !userAgent.includes('Chrome'), !Chrome, etc.
  const hasChromExclusion = /Chrome/.test(pageContent);
  expect(hasChromExclusion).toBe(true);
});

test('Page contains Firefox detection logic', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should have Firefox detection - can use includes(), indexOf(), or regex
  // e.g., userAgent.includes('Firefox'), /Firefox/.test(userAgent), etc.
  const hasFirefoxDetection =
    /Firefox/.test(pageContent) && /userAgent/.test(pageContent);
  expect(hasFirefoxDetection).toBe(true);
});

test('Shows "Unsupported Browser" for Safari', () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'
    },
    writable: true
  });

  render(<Page />);
  expect(screen.getByText(/Unsupported Browser/i)).toBeDefined();
});

test('Shows "Unsupported Browser" for Firefox', () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0'
    },
    writable: true
  });

  render(<Page />);
  expect(screen.getByText(/Unsupported Browser/i)).toBeDefined();
});

test('Does not show "Unsupported Browser" for Chrome', () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    writable: true
  });

  render(<Page />);
  expect(screen.queryByText(/Unsupported Browser/i)).toBeNull();
});

test('Shows welcome message for supported browsers (Chrome)', () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    writable: true
  });

  render(<Page />);
  expect(screen.getByText(/welcome/i)).toBeDefined();
});

test('Shows welcome message for supported browsers (Edge)', () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    },
    writable: true
  });

  render(<Page />);
  expect(screen.getByText(/welcome/i)).toBeDefined();
});

test('Handles missing navigator gracefully without crashing', () => {
  // Test server-side rendering scenario where navigator is undefined
  const originalNavigator = global.navigator;
  Object.defineProperty(global, 'navigator', {
    value: undefined,
    writable: true
  });

  expect(() => render(<Page />)).not.toThrow();
  
  // Cleanup
  Object.defineProperty(global, 'navigator', {
    value: originalNavigator,
    writable: true
  });
});
