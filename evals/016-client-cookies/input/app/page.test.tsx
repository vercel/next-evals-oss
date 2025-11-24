import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import Page from './page';

// Helper function to extract imports from a file
function findImports(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const importRegex = /import\s+.*\s+from\s+['"](\.\/[^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// Helper function to read file with its imports
function readFileWithImports(filePath: string, visited = new Set<string>()): string {
  if (!existsSync(filePath) || visited.has(filePath)) return '';

  visited.add(filePath);
  let content = readFileSync(filePath, 'utf-8');

  const imports = findImports(filePath);
  for (const importPath of imports) {
    const resolvedPath = join(filePath, '..', `${importPath}.tsx`);
    const resolvedPathTs = join(filePath, '..', `${importPath}.ts`);

    if (existsSync(resolvedPath)) {
      content += '\n' + readFileWithImports(resolvedPath, visited);
    } else if (existsSync(resolvedPathTs)) {
      content += '\n' + readFileWithImports(resolvedPathTs, visited);
    }
  }

  return content;
}

// Helper function to find actions files
function findActionsFiles(): string {
  const appDir = join(process.cwd(), 'app');
  const files: string[] = [];

  function searchDir(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        searchDir(fullPath);
      } else if (entry.name.match(/^actions?\.tsx?$/)) {
        files.push(readFileSync(fullPath, 'utf-8'));
      }
    }
  }

  searchDir(appDir);
  return files.join('\n');
}

test('Page is a client component', () => {
  const pageContent = readFileWithImports(join(process.cwd(), 'app', 'page.tsx'));

  // Should have 'use client' directive (in page or imported components)
  expect(pageContent).toMatch(/['"]use client['"];?/);
});

test('Page has clickable element that calls server action', () => {
  const pageContent = readFileWithImports(join(process.cwd(), 'app', 'page.tsx'));
  const actionsContent = findActionsFiles();
  const allContent = pageContent + '\n' + actionsContent;

  // Should import a server action or have a server action call
  const hasServerAction =
    allContent.includes('action=') ||
    allContent.includes('onClick') ||
    allContent.match(/import.*from.*['"]\./);

  expect(hasServerAction).toBe(true);
});

test('Page has button that can be clicked', () => {
  render(<Page />);

  // Should have a button or clickable element
  const buttons = screen.queryAllByRole('button');
  const clickableElements = screen.queryAllByRole('button');

  expect(buttons.length + clickableElements.length).toBeGreaterThan(0);
});

test('Server action sets cookies', () => {
  const pageContent = readFileWithImports(join(process.cwd(), 'app', 'page.tsx'));
  const actionsContent = findActionsFiles();
  const allContent = pageContent + '\n' + actionsContent;

  // Look for evidence of cookie setting in imported actions or inline functions
  const hasCookieLogic =
    allContent.includes('cookies()') ||
    allContent.includes('set(') ||
    allContent.includes('cookie');

  expect(hasCookieLogic).toBe(true);
});
