import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

// Helper function to check if useSearchParams exists in file or its imports
function hasUseSearchParamsInFileOrImports(
  filePath: string
): { found: boolean; inMainFile: boolean; inImportedFile: boolean; clientDirectiveFound: boolean } {
  const fileContent = readFileSync(filePath, 'utf-8');
  const appDir = join(process.cwd(), 'app');

  // Check main file
  const hasUseSearchParamsInMain = /useSearchParams\s*\(\s*\)/.test(fileContent);
  const hasClientDirectiveInMain = /['"]use client['"];?/.test(fileContent);
  const importsUseSearchParamsInMain = /import.*useSearchParams.*from.*['"]next\/navigation['"]/.test(fileContent);

  if (hasUseSearchParamsInMain || importsUseSearchParamsInMain) {
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
        const hasUseSearchParams = /useSearchParams\s*\(\s*\)/.test(importedContent) ||
                                   /import.*useSearchParams.*from.*['"]next\/navigation['"]/.test(importedContent);
        const hasClientDirective = /['"]use client['"];?/.test(importedContent);

        if (hasUseSearchParams) {
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

// Helper function to check if Suspense wraps the component using useSearchParams
function hasSuspenseWrapper(filePath: string): boolean {
  const fileContent = readFileSync(filePath, 'utf-8');
  const appDir = join(process.cwd(), 'app');

  // Check if Suspense is imported
  const importsSuspense = /import.*Suspense.*from.*['"]react['"]/.test(fileContent);
  if (!importsSuspense) {
    return false;
  }

  // Check if Suspense is used with fallback
  const hasSuspenseWithFallback = /fallback.*=/.test(fileContent);
  if (!hasSuspenseWithFallback) {
    return false;
  }

  // Check if page.tsx has both Suspense and useSearchParams
  if (fileContent.includes('<Suspense') && /useSearchParams/.test(fileContent)) {
    return true;
  }

  // Check if page.tsx has Suspense wrapping an imported component that uses useSearchParams
  if (fileContent.includes('<Suspense')) {
    const imports = getImportedComponents(fileContent);
    for (const importPath of imports) {
      const possiblePaths = [
        join(appDir, `${importPath}.tsx`),
        join(appDir, `${importPath}.ts`),
      ];

      for (const possiblePath of possiblePaths) {
        if (existsSync(possiblePath)) {
          const importedContent = readFileSync(possiblePath, 'utf-8');
          if (/useSearchParams/.test(importedContent)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

test('useSearchParams is used in page.tsx or extracted component', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const result = hasUseSearchParamsInFileOrImports(pagePath);

  expect(result.found).toBe(true);
});

test('Component using useSearchParams has client directive', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const result = hasUseSearchParamsInFileOrImports(pagePath);

  // The component that uses useSearchParams must have 'use client'
  expect(result.clientDirectiveFound).toBe(true);
});

test('Component using useSearchParams is wrapped with Suspense', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const hasSuspense = hasSuspenseWrapper(pagePath);

  expect(hasSuspense).toBe(true);
});
