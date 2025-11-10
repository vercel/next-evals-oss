import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Page from './page';

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

// Helper function to check if useActionState exists in file or its imports
function hasUseActionStateInFileOrImports(
  filePath: string
): { found: boolean; inMainFile: boolean; inImportedFile: boolean; clientDirectiveFound: boolean } {
  const fileContent = readFileSync(filePath, 'utf-8');
  const appDir = join(process.cwd(), 'app');

  // Check main file
  const hasUseActionStateInMain = /useActionState\s*\(/.test(fileContent);
  const hasClientDirectiveInMain = /['"]use client['"];?/.test(fileContent);
  const importsUseActionStateInMain = /import.*useActionState.*from ['"]react['"]/.test(fileContent);

  if (hasUseActionStateInMain || importsUseActionStateInMain) {
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
        const hasUseActionState = /useActionState\s*\(/.test(importedContent) ||
                                   /import.*useActionState.*from ['"]react['"]/.test(importedContent);
        const hasClientDirective = /['"]use client['"];?/.test(importedContent);

        if (hasUseActionState) {
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

test('useActionState is used in page.tsx or extracted component', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const result = hasUseActionStateInFileOrImports(pagePath);

  expect(result.found).toBe(true);
});

test('Component using useActionState has client directive', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const result = hasUseActionStateInFileOrImports(pagePath);

  // The component that uses useActionState must have 'use client'
  expect(result.clientDirectiveFound).toBe(true);
});

test('Page does not import or use useFormState', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );
  const appDir = join(process.cwd(), 'app');

  // Check page.tsx
  const hasUseFormStateInPage =
    /import.*useFormState.*from/.test(pageContent) ||
    /useFormState\s*\(/.test(pageContent);

  // Check imported components
  let hasUseFormStateInImports = false;
  const imports = getImportedComponents(pageContent);
  for (const importPath of imports) {
    const possiblePaths = [
      join(appDir, `${importPath}.tsx`),
      join(appDir, `${importPath}.ts`),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        const importedContent = readFileSync(possiblePath, 'utf-8');
        if (/import.*useFormState.*from/.test(importedContent) || /useFormState\s*\(/.test(importedContent)) {
          hasUseFormStateInImports = true;
          break;
        }
      }
    }
  }

  expect(hasUseFormStateInPage || hasUseFormStateInImports).toBe(false);
});

test('Implementation does not use useState', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );
  const appDir = join(process.cwd(), 'app');

  // Check page.tsx
  const hasUseStateInPage = /useState/.test(pageContent);

  // Check imported components
  let hasUseStateInImports = false;
  const imports = getImportedComponents(pageContent);
  for (const importPath of imports) {
    const possiblePaths = [
      join(appDir, `${importPath}.tsx`),
      join(appDir, `${importPath}.ts`),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        const importedContent = readFileSync(possiblePath, 'utf-8');
        if (/useState/.test(importedContent)) {
          hasUseStateInImports = true;
          break;
        }
      }
    }
  }

  // Should NOT use useState as per prompt requirement
  expect(hasUseStateInPage || hasUseStateInImports).toBe(false);
});

test('Page has form with server action', () => {
  render(<Page />);

  // Should have a form element
  const forms = screen.queryAllByRole('form');
  const formElements = screen.queryAllByText(/form/i);

  expect(forms.length > 0 || formElements.length > 0).toBe(true);
});

test('useActionState is properly integrated with server action', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );
  const appDir = join(process.cwd(), 'app');

  // Check page.tsx for integration
  let hasActionStateIntegration =
    pageContent.includes('formAction') ||
    (pageContent.includes('useActionState') && pageContent.includes('action='));

  // Check imported components
  if (!hasActionStateIntegration) {
    const imports = getImportedComponents(pageContent);
    for (const importPath of imports) {
      const possiblePaths = [
        join(appDir, `${importPath}.tsx`),
        join(appDir, `${importPath}.ts`),
      ];

      for (const possiblePath of possiblePaths) {
        if (existsSync(possiblePath)) {
          const importedContent = readFileSync(possiblePath, 'utf-8');
          if (
            importedContent.includes('formAction') ||
            (importedContent.includes('useActionState') && importedContent.includes('action='))
          ) {
            hasActionStateIntegration = true;
            break;
          }
        }
      }
    }
  }

  expect(hasActionStateIntegration).toBe(true);
});
