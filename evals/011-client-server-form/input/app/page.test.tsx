import { expect, test } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Helper function to recursively find imports in a file
 */
function findImports(filePath: string): string[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  const imports: string[] = [];

  // Match: import ... from './path' or import ... from '@/path'
  const importRegex = /import\s+.*?\s+from\s+['"](\.\/|@\/|\.\.\/)(.*?)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[2];
    imports.push(importPath);
  }

  return imports;
}

/**
 * Helper function to read file and all its imported components
 */
function readFileWithImports(
  filePath: string,
  visited = new Set<string>()
): string {
  if (!existsSync(filePath) || visited.has(filePath)) return "";

  visited.add(filePath);
  let allContent = readFileSync(filePath, "utf-8");

  const imports = findImports(filePath);
  const dir = join(process.cwd(), "app");

  for (const importPath of imports) {
    // Try different extensions
    const possiblePaths = [
      join(dir, `${importPath}.tsx`),
      join(dir, `${importPath}.ts`),
      join(dir, importPath, "index.tsx"),
      join(dir, importPath, "index.ts"),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        allContent += "\n" + readFileWithImports(possiblePath, visited);
        break;
      }
    }
  }

  return allContent;
}

/**
 * Helper function to find files in app directory
 */
function findFilesInApp(pattern: RegExp): string[] {
  const appDir = join(process.cwd(), "app");
  const files: string[] = [];

  function searchDir(dir: string) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (stat.isFile() && pattern.test(entry)) {
        files.push(fullPath);
      }
    }
  }

  searchDir(appDir);
  return files;
}

test("Page has server action implementation", () => {
  const pagePath = join(process.cwd(), "app", "page.tsx");
  const pageContent = readFileWithImports(pagePath);

  // Also check actions.ts files
  const actionsFiles = findFilesInApp(/actions?\.(ts|tsx)$/);
  let actionsContent = "";
  for (const file of actionsFiles) {
    actionsContent += readFileSync(file, "utf-8") + "\n";
  }

  const allContent = pageContent + "\n" + actionsContent;

  // Should have server action with 'use server' directive (inline or in actions file)
  expect(allContent).toMatch(/['"]use server['"];?/);

  // Should have an async function for server action
  expect(allContent).toMatch(/async\s+function/);

  // Should handle FormData
  expect(allContent).toMatch(/FormData|formData/);
});

test("Page has form component", () => {
  const pagePath = join(process.cwd(), "app", "page.tsx");
  const allContent = readFileWithImports(pagePath);

  // Should have a form element (in page.tsx or imported component)
  expect(allContent).toMatch(/<form/);

  // Should have form action
  expect(allContent).toMatch(/action.*=/);

  // Should have input elements
  expect(allContent).toMatch(/<input/);

  // Should have submit button
  expect(allContent).toMatch(/type.*=.*['"]submit['"]|<button.*type.*submit/);
});

test("Form uses server action properly", () => {
  const pagePath = join(process.cwd(), "app", "page.tsx");
  const allContent = readFileWithImports(pagePath);

  // Form action should reference the server action function
  expect(allContent).toMatch(/action.*=.*\{.*\}|action.*=.*[a-zA-Z]/);

  // Should not use onClick handlers for form submission (server actions preferred)
  expect(allContent).not.toMatch(/onClick.*submit|onClick.*preventDefault/);
});
