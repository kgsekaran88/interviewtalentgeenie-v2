/**
 * Flow Test 09: User Management Flow
 *
 * User Journey: Platform Admin manages users and roles.
 *   1. Navigate to User Management (admin path)
 *   2. View users table with seeded users
 *   3. Switch view mode (Platform Wide vs By Organization)
 *   4. Open Add User dialog → verify fields → close
 *   5. Verify role badges on user rows
 *
 * ⚠️  READ-ONLY: No users are created or modified.
 *     Dialogs are opened for verification but closed with Escape.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: User Management', () => {
  test.describe('Platform Admin — Admin Path', () => {
    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');
    });

    test('should display user management page', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/user management/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show Platform badge on admin path', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      const badge = page.getByText(/platform/i).first();
      await expect.soft(badge).toBeVisible({ timeout: 10_000 });
    });

    test('should show users table with seeded users', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Table should have seeded users
      const userEmail = page.getByText(/e2e-.*@talentgeenie\.test/i).first();
      await expect.soft(userEmail).toBeVisible({ timeout: 10_000 });
    });

    test('should show role badges on user rows', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Role badges
      const roleBadge = page.getByText(/platform_admin|partner_admin|hr_recruiter|tech_spoc|billing_contact|guest/i).first();
      await expect.soft(roleBadge).toBeVisible({ timeout: 10_000 });
    });

    test('should have Add User button', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      const addBtn = page.getByRole('button', { name: /add user/i }).first();
      await expect(addBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should open Add User dialog and verify fields', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      const addBtn = page.getByRole('button', { name: /add user/i }).first();
      await expect(addBtn).toBeVisible({ timeout: 10_000 });
      await addBtn.click();
      await page.waitForTimeout(500);

      // Dialog fields
      await expect.soft(page.getByText(/full name/i).first()).toBeVisible({ timeout: 5_000 });
      await expect.soft(page.getByText(/email/i).first()).toBeVisible({ timeout: 5_000 });

      // Close dialog
      await page.keyboard.press('Escape');
    });

    test('should have view mode selector', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      // View mode: Platform Wide / By Organization
      const viewMode = page.getByText(/platform wide|by organization/i).first();
      await expect.soft(viewMode).toBeVisible({ timeout: 10_000 });
    });

    test('should show Back to Admin Hub button', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      const backBtn = page.getByText(/back to.*admin/i).first();
      await expect.soft(backBtn).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Partner Admin — Partner Path', () => {
    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
    });

    test('should access user management from partner path', async ({ page }) => {
      await page.goto('/partner/users');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/user management|team/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show organization members', async ({ page }) => {
      await page.goto('/partner/users');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Should show team members from the org
      const member = page.getByText(/e2e-.*@talentgeenie\.test/i).first();
      await expect.soft(member).toBeVisible({ timeout: 10_000 });
    });
  });
});
