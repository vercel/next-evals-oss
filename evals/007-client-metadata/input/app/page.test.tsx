import { expect, test } from 'vitest';
import { render } from '@testing-library/react';
import Page from './page';

test('ClientMeta component sets title and meta description', () => {
  render(<Page />);
  
  // Check that title element exists with correct content
  const titleElement = document.querySelector('title');
  expect(titleElement?.textContent).toBe('My Page');
  
  // Check that meta description exists with correct content
  const metaElement = document.querySelector('meta[name="description"]');
  expect(metaElement?.getAttribute('content')).toBe('Test');
});
