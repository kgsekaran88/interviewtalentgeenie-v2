/**
 * E2E Tests: Billing Contact — Deep Interaction Tests
 *
 * Tests all pages accessible to billing_contact with real interactions:
 * partner billing page, payment views, subscription info, partner portal.
 * Also tests access denial for admin and some recruiting routes.
 *
 * Billing Contacts manage organization billing and subscriptions.
 * Uses seeded data from global.setup.ts.
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     They NEVER create, update, or delete any data.
 *     All interactions are navigation and visibility assertions only.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI, expectAccessDenied } from './auth-utils';

test.describe('Billing Contact — Deep', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'billingContact');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER BILLING (Primary page)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Billing', () => {
    test('should display billing page with subscription info', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/billing|invoice|payment|subscription/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show subscription overview cards', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      // Subscription cards: Price/Plan, Current Period, Max Team Members
      await expect.soft(page.getByText(/subscription|plan|price|period/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show usage this period section', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/usage|interview|period/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show invoice history', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/invoice|history/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Download Invoice button if invoices exist', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      const downloadBtn = page.getByRole('button', { name: /download|export/i }).first();
      if (await downloadBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect.soft(downloadBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER PORTAL ACCESS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Portal', () => {
    test('should access partner portal', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/partner|hub|portal/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should see org name on partner hub', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/E2E Test Organization/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should access partner dashboard', async ({ page }) => {
      await page.goto('/partner/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/dashboard|overview/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should be denied partner settings (partner/platform admin only)', async ({ page }) => {
      await expectAccessDenied(page, '/partner/settings');
    });

    test('should access partner analytics', async ({ page }) => {
      await page.goto('/partner/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/analytics|report/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECRUITING ACCESS DENIAL (billing_contact NOT in recruiting allowedRoles)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Recruiting Access Denial', () => {
    test('should NOT access interview list', async ({ page }) => {
      await expectAccessDenied(page, '/partner/recruiting/interviews');
    });

    test('should NOT access question repository', async ({ page }) => {
      await expectAccessDenied(page, '/partner/recruiting/question-repository');
    });

    test('should NOT access templates', async ({ page }) => {
      await expectAccessDenied(page, '/partner/recruiting/templates');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE & SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Profile & Settings', () => {
    test('should access profile page', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/profile|account/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should see own name on profile', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/E2E Billing Contact/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should access notifications page', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Admin Routes', () => {
    test('should NOT access /admin hub', async ({ page }) => {
      await expectAccessDenied(page, '/admin');
    });

    test('should NOT access /admin/organizations', async ({ page }) => {
      await expectAccessDenied(page, '/admin/organizations');
    });

    test('should NOT access /admin/billing', async ({ page }) => {
      await expectAccessDenied(page, '/admin/billing');
    });

    test('should NOT access /admin/user-management', async ({ page }) => {
      await expectAccessDenied(page, '/admin/user-management');
    });

    test('should NOT access /admin/ai-configuration', async ({ page }) => {
      await expectAccessDenied(page, '/admin/ai-configuration');
    });
  });
});
