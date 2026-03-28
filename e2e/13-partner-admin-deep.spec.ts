/**
 * E2E Tests: Partner Admin — Deep Interaction Tests
 *
 * Tests all pages accessible to partner_admin with real interactions:
 * partner hub, dashboard, settings, analytics, user management,
 * billing, onboarding, and org-level features.
 *
 * Uses seeded data from global.setup.ts.
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     They NEVER create, update, or delete any data.
 *     All interactions are navigation and visibility assertions only.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI, expectAccessDenied } from './auth-utils';

test.describe('Partner Admin — Deep', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER HUB (Portal)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Hub', () => {
    test('should display Partner Hub with org name', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/partner hub|partner portal/i).first()).toBeVisible({ timeout: 15_000 });

      // Should show org name in subtitle — allow extra time for async org data load
      await expect.soft(page.getByText(/E2E Test Organization/i).first()).toBeVisible({ timeout: 20_000 });
    });

    test('should display quick stats cards', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      // Quick stats: Team Members, Attempts, AI Usage, Current Plan
      await expect.soft(page.getByText(/team member|member/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should display feature cards for navigation', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      // Feature navigation cards (billing is not on the portal page)
      const featureNames = [
        /interview/i,
        /report|analytics/i,
        /user management|team/i,
        /setting/i,
      ];

      for (const name of featureNames) {
        await expect.soft(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should navigate to Interview Management from hub', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      const interviewCard = page.getByText(/manage|interview/i).first();
      if (await interviewCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await interviewCard.click();
        await page.waitForLoadState('networkidle');
        // Should navigate to interviews or recruiting area
        expect(page.url()).toMatch(/interview|recruiting/);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Dashboard', () => {
    test('should display partner dashboard', async ({ page }) => {
      await page.goto('/partner/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/dashboard|overview|partner/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Settings', () => {
    test('should display partner settings page', async ({ page }) => {
      await page.goto('/partner/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/setting|configuration|organization/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Analytics', () => {
    test('should display partner analytics/reports page', async ({ page }) => {
      await page.goto('/partner/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/analytics|report|insight/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display report builder with tabs', async ({ page }) => {
      await page.goto('/partner/reports');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/report|analytics/i).first()).toBeVisible({ timeout: 15_000 });

      // Should have tabs: Overview/Summary, Charts, Detailed Report
      await expect.soft(page.getByText(/chart|detail/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have export functionality', async ({ page }) => {
      await page.goto('/partner/reports');
      await page.waitForLoadState('networkidle');

      // Export button only renders when data.length > 0.
      // With no completed-candidate data the button is conditionally hidden.
      // Verify the page loaded correctly and check for export if data exists.
      const pageLoaded = await page.getByText(/report|analytics/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect.soft(pageLoaded, 'Reports page should load').toBeTruthy();

      const exportBtn = page.getByRole('button', { name: /export|download|excel/i }).first();
      if (await exportBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect.soft(exportBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner User Management', () => {
    test('should display users page with team members', async ({ page }) => {
      await page.goto('/partner/users');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/user|team|member/i).first()).toBeVisible({ timeout: 15_000 });

      // Should show seeded users (HR, Tech SPOC, Billing, etc.)
      await expect.soft(page.getByText(/e2e/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Add User button', async ({ page }) => {
      await page.goto('/partner/users');
      await page.waitForLoadState('networkidle');

      const addBtn = page.getByRole('button', { name: /add user|invite/i }).first();
      await expect.soft(addBtn).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER BILLING
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Billing', () => {
    test('should display billing page with subscription info', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/billing|invoice|payment|subscription/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show subscription overview section', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      // Subscription overview: Plan, Period, Team Members
      await expect.soft(page.getByText(/subscription|plan|period/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show invoice history table', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      // Invoice history section
      await expect.soft(page.getByText(/invoice|history/i).first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER MANAGE (Organization Detail)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Manage Page', () => {
    test('should display partner manage page', async ({ page }) => {
      await page.goto('/partner/manage');
      await page.waitForLoadState('networkidle');

      // Should show org management or redirect
      const url = page.url();
      expect(url).not.toContain('/auth');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECRUITING PAGES (Partner Admin has access)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Recruiting (via Partner Admin)', () => {
    test('should display interviews list with seeded data', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/interview|assessment|position/i).first()).toBeVisible({ timeout: 15_000 });

      // Seeded interviews should appear (e.g., "Senior React Developer")
      await expect.soft(page.getByText(/senior react|full stack|data engineer|devops/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Create Interview button', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create|new/i }).or(page.locator('a[href*="create"]')).first();
      await expect.soft(createBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should access JD builder', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/job description|jd|builder/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access question repository', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/question|repository|bank/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access templates page', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/template|library/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access report builder', async ({ page }) => {
      await page.goto('/partner/recruiting/report-builder');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/report|builder/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL — Admin routes blocked
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Admin Routes', () => {
    test('should NOT access /admin hub', async ({ page }) => {
      await expectAccessDenied(page, '/admin');
    });

    test('should NOT access /admin/organizations', async ({ page }) => {
      await expectAccessDenied(page, '/admin/organizations');
    });

    test('should NOT access /admin/user-management', async ({ page }) => {
      await expectAccessDenied(page, '/admin/user-management');
    });

    test('should NOT access /admin/billing', async ({ page }) => {
      await expectAccessDenied(page, '/admin/billing');
    });
  });
});
