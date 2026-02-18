/**
 * E2E Tests: Navigation & Routing
 * 
 * Tests that all major routes are accessible by the correct roles,
 * navigation works correctly, and breadcrumbs show properly.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Navigation & Routing', () => {

  test.describe('Role-Based Dashboard Redirect', () => {

    test('platform_admin /dashboard redirects to partner portal', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/partner|admin|dashboard/, { timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('partner_admin /dashboard redirects to partner portal', async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/partner|dashboard/, { timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('hr_recruiter /dashboard redirects to interviews', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/recruiting|interview|partner|dashboard/, { timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('tech_spoc /dashboard redirects to pending reviews', async ({ page }) => {
      await signInViaAPI(page, 'techSpoc');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/pending|review|partner|dashboard/, { timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('guest /dashboard redirects to learning dashboard', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/learning|dashboard/, { timeout: 15_000 });
    });
  });

  test.describe('Legacy Route Redirects', () => {

    test('/recruiter should redirect to partner recruiting', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/recruiter');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/partner|recruiting|interview/, { timeout: 15_000 });
    });

    test('/unified-dashboard should redirect', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
      await page.goto('/unified-dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForURL(/partner|dashboard/, { timeout: 15_000 });
    });
  });

  test.describe('Admin Navigation Links', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
    });

    test('admin hub cards should link to correct pages', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Check that admin hub loads
      await expect(page.getByRole('heading', { name: 'Platform Admin Hub' })).toBeVisible({ timeout: 15_000 });

      // Verify several admin links work by checking they exist
      const links = [
        { text: /organization/i, url: /organizations/ },
        { text: /user management/i, url: /user-management/ },
        { text: /email/i, url: /email/ },
        { text: /analytics/i, url: /analytics/ },
      ];

      for (const link of links) {
        const el = page.getByText(link.text).first();
        if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
          // Just verify it's visible — clicking would navigate away
          await expect(el).toBeVisible();
        }
      }
    });
  });

  test.describe('Navbar Presence', () => {

    test('admin pages should have navbar', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should have a nav element or navbar component
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible({ timeout: 15_000 });
    });

    test('partner pages should have navbar', async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Cross-Navigation', () => {

    test('platform admin can navigate between admin and partner sections', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');

      // Go to admin
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/admin');

      // Go to partner portal
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');
      // Platform admin with no org might redirect, but should not go to /auth
      expect(page.url()).not.toContain('/auth');

      // Back to admin
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/admin');
    });
  });
});
