import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Page from './page';

vi.mock('next/navigation', () => {
  const actual = vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
    })),
    useSearchParams: vi.fn(() => ({
      get: vi.fn(),
    })),
    usePathname: vi.fn(),
  };
});

// Helper function to find imported components from a file
function getImportedComponents(fileContent: string): string[] {
  const importRegex = /import\s+(?:{[^}]*}|\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(fileContent)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// Helper function to check if useRouter exists in file or its imports
function hasUseRouterInFileOrImports(
  filePath: string
): { found: boolean; inMainFile: boolean; inImportedFile: boolean; clientDirectiveFound: boolean } {
  const fileContent = readFileSync(filePath, 'utf-8');
  const appDir = join(process.cwd(), 'app');

  // Check main file
  const hasUseRouterInMain = /useRouter\s*\(\s*\)/.test(fileContent);
  const hasClientDirectiveInMain = /['"]use client['"];?/.test(fileContent);
  const importsUseRouterInMain = /import.*useRouter.*from.*['"]next\/navigation['"]/.test(fileContent);

  if (hasUseRouterInMain || importsUseRouterInMain) {
    return {
      found: true,
      inMainFile: true,
      inImportedFile: false,
      clientDirectiveFound: hasClientDirectiveInMain
    };
  }

  // Check imported components
  const imports = getImportedComponents(fileContent);
  for (const importPath of imports) {
    // Try different extensions
    const possiblePaths = [
      join(appDir, `${importPath}.tsx`),
      join(appDir, `${importPath}.ts`),
      join(appDir, importPath, 'index.tsx'),
      join(appDir, importPath, 'index.ts'),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        const importedContent = readFileSync(possiblePath, 'utf-8');
        const hasUseRouter = /useRouter\s*\(\s*\)/.test(importedContent) ||
                             /import.*useRouter.*from.*['"]next\/navigation['"]/.test(importedContent);
        const hasClientDirective = /['"]use client['"];?/.test(importedContent);

        if (hasUseRouter) {
          return {
            found: true,
            inMainFile: false,
            inImportedFile: true,
            clientDirectiveFound: hasClientDirective
          };
        }
      }
    }
  }

  return { found: false, inMainFile: false, inImportedFile: false, clientDirectiveFound: false };
}

// Helper function to check if router methods are used in file or its imports
function hasRouterMethodsInFileOrImports(filePath: string): boolean {
  const fileContent = readFileSync(filePath, 'utf-8');
  const appDir = join(process.cwd(), 'app');

  // Check main file
  const usesRouterMethodsInMain =
    fileContent.includes('.push(') ||
    fileContent.includes('.replace(') ||
    fileContent.includes('.back(') ||
    fileContent.includes('.forward(') ||
    fileContent.includes('.refresh(');

  if (usesRouterMethodsInMain) {
    return true;
  }

  // Check imported components
  const imports = getImportedComponents(fileContent);
  for (const importPath of imports) {
    const possiblePaths = [
      join(appDir, `${importPath}.tsx`),
      join(appDir, `${importPath}.ts`),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        const importedContent = readFileSync(possiblePath, 'utf-8');
        if (
          importedContent.includes('.push(') ||
          importedContent.includes('.replace(') ||
          importedContent.includes('.back(') ||
          importedContent.includes('.forward(') ||
          importedContent.includes('.refresh(')
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

// Helper function to check for Pages Router API usage
function usesPagesRouterAPI(filePath: string): boolean {
  const fileContent = readFileSync(filePath, 'utf-8');
  const appDir = join(process.cwd(), 'app');

  // Check main file
  const usesPagesRouterInMain =
    /from ['"]next\/router['"]/.test(fileContent) ||
    /router\.pathname|router\.query|router\.asPath/.test(fileContent);

  if (usesPagesRouterInMain) {
    return true;
  }

  // Check imported components
  const imports = getImportedComponents(fileContent);
  for (const importPath of imports) {
    const possiblePaths = [
      join(appDir, `${importPath}.tsx`),
      join(appDir, `${importPath}.ts`),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        const importedContent = readFileSync(possiblePath, 'utf-8');
        if (
          /from ['"]next\/router['"]/.test(importedContent) ||
          /router\.pathname|router\.query|router\.asPath/.test(importedContent)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

test('Page renders correctly', () => {
  render(<Page />);
  expect(screen.getByRole('button', { name: 'Navigate' })).toBeDefined();
});

test('useRouter is used in page.tsx or extracted component', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const result = hasUseRouterInFileOrImports(pagePath);

  expect(result.found).toBe(true);
});

test('Component using useRouter has client directive', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const result = hasUseRouterInFileOrImports(pagePath);

  // The component that uses useRouter must have 'use client'
  expect(result.clientDirectiveFound).toBe(true);
});

test('Implementation uses router functionality', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const usesRouterMethods = hasRouterMethodsInFileOrImports(pagePath);

  // Should use router methods like push, replace, back, forward, refresh
  expect(usesRouterMethods).toBe(true);
});

test('Implementation does not use Pages Router API', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const usesPagesRouter = usesPagesRouterAPI(pagePath);

  // Should NOT import from next/router (Pages Router)
  // Should NOT use Pages Router patterns
  expect(usesPagesRouter).toBe(false);
});
