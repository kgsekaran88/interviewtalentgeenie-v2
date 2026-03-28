/**
 * Flow Test 08: Billing & Subscription Flow
 *
 * User Journey: Billing Contact views billing information.
 *   1. Navigate to Partner Billing page
 *   2. View subscription overview cards
 *   3. View usage this period
 *   4. View invoice history
 *   5. Verify different roles' access to billing
 *
 * ⚠️  READ-ONLY: No billing data is modified.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Billing & Subscription', () => {
  test.describe('Billing Contact Access', () => {
    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'billingContact');
    });

    test('should access billing page', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/billing|subscription/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show subscription overview cards', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Subscription overview section
      const subContent = page.getByText(/subscription|plan|period|no.*subscription/i).first();
      await expect.soft(subContent).toBeVisible({ timeout: 10_000 });
    });

    test('should show usage this period section', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Usage section with progress bars
      const usageContent = page.getByText(/usage|interview|token|no.*subscription/i).first();
      await expect.soft(usageContent).toBeVisible({ timeout: 10_000 });
    });

    test('should show invoice history section', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Invoice history
      const invoiceContent = page.getByText(/invoice|no invoice|no.*subscription/i).first();
      await expect.soft(invoiceContent).toBeVisible({ timeout: 10_000 });
    });

    test('should show support contact info', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      const contactContent = page.getByText(/help.*billing|support|contact/i).first();
      await expect.soft(contactContent).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Multi-Role Billing Access', () => {
    test('Partner Admin should access billing page', async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/billing|subscription/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Platform Admin should access billing page', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/billing|subscription/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('HR Recruiter should NOT access billing page', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      // Should show access denied or redirect
      const denied = page.getByText(/access denied|only.*admin|permission/i).first();
      await expect.soft(denied).toBeVisible({ timeout: 10_000 });
    });
  });
});
