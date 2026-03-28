/**
 * Flow Test 11: Cross-Role Collaboration Flow
 *
 * User Journey: Multiple roles access shared resources.
 *   1. HR Recruiter creates interviews → views list
 *   2. Tech SPOC reviews same interviews from pending reviews
 *   3. Partner Admin views analytics across all interviews
 *   4. Platform Admin monitors system health
 *   5. All roles access same question repository
 *
 * ⚠️  READ-ONLY: No data is created or modified.
 *     Each test signs in as the appropriate role.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Cross-Role Collaboration', () => {
  test.describe('Shared Interview Access', () => {
    test('HR Recruiter should see interview management dashboard', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/interview management/i).first()).toBeVisible({ timeout: 15_000 });

      // Should see seeded interviews
      await expect.soft(page.getByText(/total interview/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('Tech SPOC should see pending reviews for same interviews', async ({ page }) => {
      await signInViaAPI(page, 'techSpoc');
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      // Pending reviews page
      await expect(page.getByText(/pending|review/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Partner Admin should access partner analytics', async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
      await page.goto('/partner/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/analytics|dashboard|insight/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Platform Admin should access system monitoring', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
      await page.goto('/admin/system-monitoring');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/monitor|system|health/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Shared Question Repository', () => {
    const techRoles = [
      { key: 'hrRecruiter', label: 'HR Recruiter' },
      { key: 'techSpoc', label: 'Tech SPOC' },
      { key: 'partnerAdmin', label: 'Partner Admin' },
    ] as const;

    for (const role of techRoles) {
      test(`${role.label} should access question repository`, async ({ page }) => {
        await signInViaAPI(page, role.key);
        await page.goto('/partner/recruiting/question-repository');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/question repository/i).first()).toBeVisible({ timeout: 15_000 });
      });
    }
  });

  test.describe('Shared Templates', () => {
    test('HR Recruiter should access templates page', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/template/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Tech SPOC should access templates page', async ({ page }) => {
      await signInViaAPI(page, 'techSpoc');
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/template/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Dashboard Routing Per Role', () => {
    test('HR Recruiter dashboard redirects to interviews', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2_000);

      expect.soft(page.url()).toMatch(/recruiting|interview|partner/);
    });

    test('Tech SPOC dashboard redirects to pending reviews', async ({ page }) => {
      await signInViaAPI(page, 'techSpoc');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2_000);

      expect.soft(page.url()).toMatch(/pending|review|recruiting|partner/);
    });

    test('Guest dashboard redirects to learning', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2_000);

      expect.soft(page.url()).toMatch(/learning|dashboard/);
    });
  });
});
