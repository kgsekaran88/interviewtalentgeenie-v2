import { test, expect } from '@playwright/test';
import { signInViaUI } from './auth-utils';

test('check localStorage key after UI login', async ({ page }) => {
  await signInViaUI(page, 'platformAdmin');
  
  const keys = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith('sb-')) {
        result[key] = localStorage.getItem(key)!.substring(0, 100) + '...';
      }
    }
    return result;
  });
  
  console.log('localStorage keys:', JSON.stringify(keys, null, 2));
  expect(Object.keys(keys).length).toBeGreaterThan(0);
});
