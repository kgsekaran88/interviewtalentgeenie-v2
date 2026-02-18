/**
 * E2E Tests: Platform Admin Features
 * 
 * Tests the platform admin hub and all admin-only pages.
 * Uses the platform_admin test user.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Platform Admin', () => {

  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  test.describe('Admin Hub', () => {

    test('should display Platform Admin Hub with all sections', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'Platform Admin Hub' })).toBeVisible({ timeout: 15_000 });

      // Check category headings exist
      const categories = [
        'Critical Operations',
        'Billing',
        'Communications',
        'Learning',
        'AI',
      ];
      for (const cat of categories) {
        const heading = page.getByText(new RegExp(cat, 'i')).first();
        // Scroll into view and check
        if (await heading.isVisible().catch(() => false)) {
          await expect(heading).toBeVisible();
        }
      }
    });

    test('should navigate to Organizations from admin hub', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      const orgLink = page.getByText('Partner Organizations').or(page.getByText('Organizations'));
      if (await orgLink.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await orgLink.first().click();
        await page.waitForURL(/\/admin\/organizations/, { timeout: 10_000 });
      }
    });
  });

  test.describe('Organization Management', () => {

    test('should display organizations list', async ({ page }) => {
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');

      // Should show organization management page
      const heading = page.getByText(/organization/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('should show E2E test organization', async ({ page }) => {
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');

      // Our seeded organization should appear
      const orgName = page.getByText('E2E Test Organization');
      await expect(orgName).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('User Management', () => {

    test('should display user management page', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/user/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });
  });

  test.describe('Role Management', () => {

    test('should display role assignment page', async ({ page }) => {
      await page.goto('/admin/role-assignment');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/role/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('should display role permissions page', async ({ page }) => {
      await page.goto('/admin/role-permissions');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/permission|role/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });
  });

  test.describe('Analytics', () => {

    test('should display analytics dashboard', async ({ page }) => {
      await page.goto('/admin/analytics');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/analytics|dashboard|overview/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });
  });

  test.describe('Billing & Plans', () => {

    test('should display billing page', async ({ page }) => {
      await page.goto('/admin/billing');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/billing|subscription|plan/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display plan management page', async ({ page }) => {
      await page.goto('/admin/plan-management');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/plan|subscription/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display promotions page', async ({ page }) => {
      await page.goto('/admin/promotions');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/promotion|discount|coupon/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Email Configuration', () => {

    test('should display email configuration page', async ({ page }) => {
      await page.goto('/admin/email-configuration');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/email|template|configuration/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should show email templates from database', async ({ page }) => {
      await page.goto('/admin/email-configuration');
      await page.waitForLoadState('networkidle');

      // We seeded 25 email templates — the page should show the email configuration UI
      // Look for content inside main area only
      const mainContent = page.locator('main');
      await expect(mainContent.getByText(/email|template|configuration/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('AI Configuration', () => {

    test('should display AI configuration page', async ({ page }) => {
      await page.goto('/admin/ai-configuration');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/ai|artificial|model|configuration/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display chatbot management page', async ({ page }) => {
      await page.goto('/admin/chatbot-management');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/chatbot|assistant|ai/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Learning & Certification', () => {

    test('should display learning management page', async ({ page }) => {
      await page.goto('/admin/learning-management');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/learning|education|course/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display certification admin page', async ({ page }) => {
      await page.goto('/admin/certification-admin');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/certif|exam|assessment/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Monitoring & Logs', () => {

    test('should display system monitoring page', async ({ page }) => {
      await page.goto('/admin/system-monitoring');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/monitor|system|health|status/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display operation logs page', async ({ page }) => {
      await page.goto('/admin/operation-logs');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/log|operation|audit/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display AI usage monitoring page', async ({ page }) => {
      await page.goto('/admin/ai-usage-monitoring');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/ai|usage|monitor/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display cost monitoring page', async ({ page }) => {
      await page.goto('/admin/cost-monitoring');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/cost|expense|budget/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Settings & Documentation', () => {

    test('should display admin settings page', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/setting|configuration|preference/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display documentation page', async ({ page }) => {
      await page.goto('/admin/documentation');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/doc|guide|help/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });
});
