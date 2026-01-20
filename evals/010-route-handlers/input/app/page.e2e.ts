import { test, expect } from '@playwright/test';

test('POST to /api/process returns data with processed: true', async ({ request }) => {
  const response = await request.post('/api/process', {
    data: { name: 'test', value: 123 }
  });

  expect(response.ok()).toBe(true);

  const json = await response.json();
  expect(json.name).toBe('test');
  expect(json.value).toBe(123);
  expect(json.processed).toBe(true);
});

test('POST to /api/process preserves all original fields', async ({ request }) => {
  const testData = {
    id: 1,
    user: 'alice',
    items: ['a', 'b'],
    nested: { key: 'value' }
  };

  const response = await request.post('/api/process', {
    data: testData
  });

  expect(response.ok()).toBe(true);

  const json = await response.json();
  expect(json.id).toBe(1);
  expect(json.user).toBe('alice');
  expect(json.items).toEqual(['a', 'b']);
  expect(json.nested).toEqual({ key: 'value' });
  expect(json.processed).toBe(true);
});

test('POST to /api/process with empty object adds processed field', async ({ request }) => {
  const response = await request.post('/api/process', {
    data: {}
  });

  expect(response.ok()).toBe(true);

  const json = await response.json();
  expect(json.processed).toBe(true);
});
