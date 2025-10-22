import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Parallel route folders exist', () => {
  const analyticsPath = join(process.cwd(), 'app', '@analytics');
  const teamPath = join(process.cwd(), 'app', '@team');
  
  expect(existsSync(analyticsPath)).toBe(true);
  expect(existsSync(teamPath)).toBe(true);
});

test('Parallel route pages exist', () => {
  const analyticsPagePath = join(process.cwd(), 'app', '@analytics', 'page.tsx');
  const teamPagePath = join(process.cwd(), 'app', '@team', 'page.tsx');
  
  expect(existsSync(analyticsPagePath)).toBe(true);
  expect(existsSync(teamPagePath)).toBe(true);
});

test('Analytics page has correct content', () => {
  const analyticsPagePath = join(process.cwd(), 'app', '@analytics', 'page.tsx');
  if (existsSync(analyticsPagePath)) {
    const content = readFileSync(analyticsPagePath, 'utf-8');
    
    // Should have analytics className
    expect(content).toMatch(/className=["']analytics["']/);
    
    // Should have Analytics Dashboard text
    expect(content).toMatch(/Analytics Dashboard/);
  }
});

test('Team page has correct content', () => {
  const teamPagePath = join(process.cwd(), 'app', '@team', 'page.tsx');
  if (existsSync(teamPagePath)) {
    const content = readFileSync(teamPagePath, 'utf-8');
    
    // Should have team className
    expect(content).toMatch(/className=["']team["']/);
    
    // Should have Team Overview text
    expect(content).toMatch(/Team Overview/);
  }
});

test('Layout receives and renders parallel route slots', () => {
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
  const layoutContent = readFileSync(layoutPath, 'utf-8');
  
  // Should receive analytics slot
  expect(layoutContent).toMatch(/analytics\s*[,:]|{\s*analytics\s*}/);
  
  // Should receive team slot
  expect(layoutContent).toMatch(/team\s*[,:]|{\s*team\s*}/);
  
  // Should render both slots
  expect(layoutContent).toMatch(/\{analytics\}/);
  expect(layoutContent).toMatch(/\{team\}/);
});
