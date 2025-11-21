import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Helper to recursively read file with imports
function readFileWithImports(filePath: string, visited = new Set<string>()): string {
  if (visited.has(filePath) || !existsSync(filePath)) {
    return '';
  }
  visited.add(filePath);

  const content = readFileSync(filePath, 'utf-8');
  let result = content;

  // Find local imports (./actions, ./components/foo, etc.)
  const importRegex = /from\s+['"](\.\/[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const dir = join(filePath, '..');

    // Try with and without extension
    const possiblePaths = [
      join(dir, importPath + '.ts'),
      join(dir, importPath + '.tsx'),
      join(dir, importPath),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        result += '\n' + readFileWithImports(possiblePath, visited);
        break;
      }
    }
  }

  return result;
}

// Helper to find actions files in app directory
function findActionsFiles(): string {
  const appDir = join(process.cwd(), 'app');
  const actionsFiles = ['actions.ts', 'action.ts', 'actions.tsx', 'action.tsx'];
  let result = '';

  for (const file of actionsFiles) {
    const filePath = join(appDir, file);
    if (existsSync(filePath)) {
      result += readFileSync(filePath, 'utf-8') + '\n';
    }
  }

  return result;
}

test('Server action function exists', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const pageContent = readFileWithImports(pagePath);
  const actionsContent = findActionsFiles();
  const allContent = pageContent + '\n' + actionsContent;

  // Should have submitForm function
  expect(allContent).toMatch(/function\s+submitForm|const\s+submitForm\s*=/);

  // Should be async
  expect(allContent).toMatch(/async\s+function\s+submitForm|async\s*\(/);

  // Should have 'use server' directive
  expect(allContent).toMatch(/['"]use server['"]/);
});

test('Server action handles FormData', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const pageContent = readFileWithImports(pagePath);
  const actionsContent = findActionsFiles();
  const allContent = pageContent + '\n' + actionsContent;

  // Should accept FormData parameter
  expect(allContent).toMatch(/formData|FormData/);

  // Should get 'name' field
  expect(allContent).toMatch(/formData\.get\(['"]name['"]\)/);

  // Should log the value
  expect(allContent).toMatch(/console\.log/);
});

test('Form uses server action', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have form element
  expect(content).toMatch(/<form/);
  
  // Should use action prop with submitForm
  expect(content).toMatch(/action=\{submitForm\}/);
  
  // Should NOT use onSubmit
  expect(content).not.toMatch(/onSubmit/);
});

test('Form has correct input and button', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have input with name="name"
  expect(content).toMatch(/<input[^>]*name=["']name["']/);
  
  // Should have placeholder
  expect(content).toMatch(/placeholder=["']Enter your name["']/);
  
  // Should have submit button
  expect(content).toMatch(/<button[^>]*>.*Submit.*<\/button>/);
});
