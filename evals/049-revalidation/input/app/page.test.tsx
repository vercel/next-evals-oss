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

test('Page is async server component with revalidation', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should be async function
  expect(content).toMatch(/export\s+default\s+async\s+function|async\s+function.*Page/);
  
  // Should fetch from correct API
  expect(content).toMatch(/api\.vercel\.app\/products/);
  
  // Should have revalidate option
  expect(content).toMatch(/revalidate:\s*60/);
});

test('Page uses proper fetch options for caching', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');

  // Should use next cache options
  expect(content).toMatch(/next:\s*{/);

  // Should have cache tags
  expect(content).toMatch(/tags:\s*\[.*products.*\]/);

  // Should render first product name (support optional chaining)
  expect(content).toMatch(/products\[0\]\??\.name|\[0\]\??\.name/);
});

test('Server action for revalidation exists', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const pageContent = readFileWithImports(pagePath);
  const actionsContent = findActionsFiles();
  const allContent = pageContent + '\n' + actionsContent;

  // Should import revalidateTag
  expect(allContent).toMatch(/import.*revalidateTag.*from\s+['"]next\/cache['"]/);

  // Should have server action
  expect(allContent).toMatch(/['"]use server['"]/);

  // Should call revalidateTag
  expect(allContent).toMatch(/revalidateTag\(['"]products['"]\)/);
});

test('Page includes revalidation form', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have form with action
  expect(content).toMatch(/<form[^>]*action=/);
  
  // Should have submit button
  expect(content).toMatch(/<button[^>]*type=["']submit["']/);
});
