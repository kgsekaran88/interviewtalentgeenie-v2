/**
 * Flow Test 12: Profile & Settings Flow
 *
 * User Journey: All roles access profile and settings pages.
 *   1. View profile page — name, email, role badge
 *   2. Change Password section exists
 *   3. Settings page — Profile and Privacy tabs
 *   4. Multiple roles verify their own profile data
 *
 * ⚠️  READ-ONLY: No data is modified.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Profile & Settings', () => {
  test.describe('Profile Page', () => {
    test('Guest should see profile page with their info', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // Profile heading
      await expect(page.getByText(/profile|my profile|account/i).first()).toBeVisible({ timeout: 15_000 });

      // Full name input
      const nameInput = page.locator('input#fullName, input[name="fullName"], input[name="full_name"]').first();
      const hasName = await nameInput.isVisible().catch(() => false);
      if (hasName) {
        const value = await nameInput.inputValue().catch(() => '');
        expect.soft(value.length).toBeGreaterThan(0);
      }

      // Email field
      const emailField = page.locator('input[type="email"], input#email, input[name="email"]').first();
      const hasEmail = await emailField.isVisible().catch(() => false);
      if (hasEmail) {
        const value = await emailField.inputValue().catch(() => '');
        expect.soft(value).toContain('@');
      }
    });

    test('Partner Admin should see profile page', async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/profile|my profile|account/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Platform Admin should see profile page', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/profile|my profile|account/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Profile page should have change password section', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // Change/Update password section
      const pwdSection = page.getByText(/change password|update password|password/i).first();
      await expect.soft(pwdSection).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Settings Page', () => {
    test('Guest should see settings page with tabs', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15_000 });

      // Profile tab
      const profileTab = page.getByRole('tab', { name: /profile/i }).first();
      const hasProfileTab = await profileTab.isVisible().catch(() => false);
      expect.soft(hasProfileTab).toBeTruthy();

      // Privacy tab
      const privacyTab = page.getByRole('tab', { name: /privacy/i }).first();
      const hasPrivacyTab = await privacyTab.isVisible().catch(() => false);
      expect.soft(hasPrivacyTab).toBeTruthy();
    });

    test('Partner Admin should access settings', async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('Clicking Privacy tab should switch content', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2_000);

      // Wait for page to load first
      await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15_000 });

      const privacyTab = page.getByRole('tab', { name: /privacy/i }).first();
      const hasTab = await privacyTab.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasTab) {
        await privacyTab.click();
        await page.waitForTimeout(1_000);

        // Should show privacy-related content — "Privacy Settings" is the card title
        const privacyContent = page.getByText(/privacy settings/i).first();
        await expect.soft(privacyContent).toBeVisible({ timeout: 10_000 });
      }
    });

    test('Clicking Profile tab should show profile content', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2_000);

      // Wait for page to load first
      await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15_000 });

      const profileTab = page.getByRole('tab', { name: /profile/i }).first();
      const hasTab = await profileTab.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasTab) {
        await profileTab.click();
        await page.waitForTimeout(1_000);

        // Should show profile-related content — "Profile Information" is the card title
        const profileContent = page.getByText(/profile information/i).first();
        await expect.soft(profileContent).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test.describe('Multi-Role Settings Access', () => {
    const roles = [
      { key: 'hrRecruiter', label: 'HR Recruiter' },
      { key: 'techSpoc', label: 'Tech SPOC' },
      { key: 'billingContact', label: 'Billing Contact' },
    ] as const;

    for (const role of roles) {
      test(`${role.label} should access settings page`, async ({ page }) => {
        await signInViaAPI(page, role.key);
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15_000 });
      });
    }
  });
});
