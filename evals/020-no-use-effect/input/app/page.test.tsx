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

test('Page uses proper navigator type guards', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should check typeof navigator !== 'undefined' for safe server-side rendering
  expect(pageContent).toMatch(/typeof\s+navigator\s*!==\s*['"]undefined['"]/);
});

test('Page contains Safari detection logic that excludes Chrome', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should have Safari detection pattern that excludes Chrome
  expect(pageContent).toMatch(/Safari.*userAgent/);
  expect(pageContent).toMatch(/!.*Chrome.*userAgent|Chrome.*userAgent.*!/);
});

test('Page contains Firefox detection logic', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should have Firefox detection pattern
  expect(pageContent).toMatch(/Firefox.*userAgent/);
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
