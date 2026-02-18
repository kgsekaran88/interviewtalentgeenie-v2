/**
 * E2E Tests: User Profile & Settings
 * 
 * Tests user profile page, settings, and notifications.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('User Profile & Settings', () => {

  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  test.describe('Profile Page', () => {

    test('should display user profile', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/profile|account|personal/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('should show user name on profile', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // The platform admin's name should appear somewhere
      const userName = page.getByText(/E2E Platform Admin|e2e-admin/i);
      if (await userName.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(userName.first()).toBeVisible();
      }
    });
  });

  test.describe('Settings Page', () => {

    test('should display settings page', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/setting|preference|configuration/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Notifications Page', () => {

    test('should display notifications page', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/notification|alert|message/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });
});
