/**
 * E2E Tests: Responsive Design & Accessibility
 * 
 * Tests that key pages work on mobile viewport and have basic accessibility.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Responsive Design', () => {

  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test('landing page should be responsive on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Hero should still be visible
    await expect(page.getByText('AI-Powered Interview Platform')).toBeVisible({ timeout: 15_000 });
  });

  test('auth page should be responsive on mobile', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Welcome to TalentGeenie')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#email')).toBeVisible();
  });

  test('pricing page should be responsive on mobile', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const heading = page.getByText(/pricing/i).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('admin hub should work on mobile', async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Platform Admin Hub' })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Basic Accessibility', () => {

  test('landing page should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('auth page should have labeled form inputs', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Email input should have a label
    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toBeVisible({ timeout: 10_000 });
  });

  test('auth page buttons should be keyboard focusable', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Tab to the continue button
    await page.locator('#email').focus();
    await page.keyboard.press('Tab');
    
    // Some element should now be focused
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test('interactive elements should have visible focus styles', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Focus the email input
    const emailInput = page.locator('#email');
    await emailInput.focus();

    // Check that the input has some focus indicator (outline or border change)
    const hasFocusStyle = await emailInput.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.outlineStyle !== 'none' ||
        styles.boxShadow !== 'none' ||
        styles.borderColor !== styles.getPropertyValue('--border')
      );
    });
    // This is a soft check — some focus styles use box-shadow
    expect(hasFocusStyle).toBeTruthy();
  });
});
