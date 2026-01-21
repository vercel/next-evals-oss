import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page is an async server component with proper data fetching', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should be an async function
  expect(pageContent).toMatch(/async\s+function|export\s+default\s+async/);
  
  // Should NOT have 'use client' directive
  expect(pageContent).not.toMatch(/['"]use client['"];?/);
  
  // Should fetch data server-side
  expect(pageContent).toMatch(/await.*fetch|fetch.*await/);
});

test('UserDashboard component uses App Router patterns', () => {
  const userDashboardContent = readFileSync(join(process.cwd(), 'app', 'UserDashboard.tsx'), 'utf-8');
  
  // Should be an async function (App Router pattern)
  expect(userDashboardContent).toMatch(/async\s+function|export\s+default\s+async/);
  
  // Should NOT use getServerSideProps (Pages Router pattern)
  expect(userDashboardContent).not.toMatch(/getServerSideProps/);
  
  // Should NOT have 'use client' directive
  expect(userDashboardContent).not.toMatch(/['"]use client['"];?/);
});

test('UserDashboard fetches dynamic user preferences', () => {
  const userDashboardContent = readFileSync(join(process.cwd(), 'app', 'UserDashboard.tsx'), 'utf-8');
  
  // Should fetch from user preferences API
  expect(userDashboardContent).toMatch(/\/api\/user\/preferences/);
  
  // Should use server-side data fetching with cache: 'no-store' for dynamic data
  expect(userDashboardContent).toMatch(/cache.*no-store|no-store.*cache/);
});
