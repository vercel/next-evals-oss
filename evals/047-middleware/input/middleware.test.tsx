import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Middleware.ts file exists in root', () => {
  const middlewarePath = join(process.cwd(), 'middleware.ts');
  expect(existsSync(middlewarePath)).toBe(true);
});

test('Middleware imports NextResponse', () => {
  const middlewarePath = join(process.cwd(), 'middleware.ts');
  if (existsSync(middlewarePath)) {
    const content = readFileSync(middlewarePath, 'utf-8');
    
    // Should import NextResponse from next/server
    expect(content).toMatch(/import.*NextResponse.*from\s+['"]next\/server['"]/);
  }
});

test('Middleware function exists and handles request', () => {
  const middlewarePath = join(process.cwd(), 'middleware.ts');
  if (existsSync(middlewarePath)) {
    const content = readFileSync(middlewarePath, 'utf-8');
    
    // Should export middleware function
    expect(content).toMatch(/export\s+function\s+middleware/);
    
    // Should accept request parameter
    expect(content).toMatch(/request|NextRequest/);
    
    // Should log pathname
    expect(content).toMatch(/console\.log.*pathname/);
  }
});

test('Middleware adds custom header', () => {
  const middlewarePath = join(process.cwd(), 'middleware.ts');
  if (existsSync(middlewarePath)) {
    const content = readFileSync(middlewarePath, 'utf-8');
    
    // Should use NextResponse.next()
    expect(content).toMatch(/NextResponse\.next\(\)/);
    
    // Should set X-Custom-Header
    expect(content).toMatch(/headers\.set\(['"]X-Custom-Header['"]/);
    
    // Should set value to middleware-test
    expect(content).toMatch(/['"]middleware-test['"]/);
    
    // Should return response
    expect(content).toMatch(/return\s+response/);
  }
});
