import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('ClientComponent uses React use() API correctly', () => {
  const clientComponentContent = readFileSync(join(process.cwd(), 'app', 'ClientComponent.tsx'), 'utf-8');
  
  // Should be a client component
  expect(clientComponentContent).toMatch(/['"]use client['"];?/);
  
  // Should import use from react
  expect(clientComponentContent).toMatch(/import.*use.*from ['"]react['"];?/);
  
  // Should call use() with the data prop
  expect(clientComponentContent).toMatch(/use\s*\(\s*data\s*\)/);
  
  // Should render the result as JSON
  expect(clientComponentContent).toMatch(/JSON\.stringify/);
});

test('Page passes Promise to ClientComponent', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should import ClientComponent
  expect(pageContent).toMatch(/import.*ClientComponent/);
  
  // Should pass data as a promise (not awaited)
  expect(pageContent).toMatch(/data=\{data\}/);
  
  // Should have Suspense boundary for use() API
  expect(pageContent).toMatch(/Suspense/);
});
