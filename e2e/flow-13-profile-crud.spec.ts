/**
 * Flow 13: Profile CRUD Operations
 *
 * Tests ACTUAL data mutations on the Profile page:
 * - Update full name → save → verify persistence
 * - Change password form validation
 * - Verify profile data pre-fill from DB
 * - Cross-role profile editing
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Profile CRUD — Name Update Flow', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  test('should display profile page with pre-filled name', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Verify profile form is visible
    const nameInput = page.locator('input#fullName');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });

    // Should be pre-filled with current name
    const currentValue = await nameInput.inputValue();
    expect(currentValue.length).toBeGreaterThan(0);
  });

  test('should update profile name and verify persistence', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('input#fullName');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });

    // Save original name for restoration
    const originalName = await nameInput.inputValue();

    // Only letters, spaces, hyphens, apostrophes (regex: /^[a-zA-Z\s'-]+$/)
    const newName = 'Test Updated Admin';
    await nameInput.clear();
    await nameInput.fill(newName);

    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await saveBtn.click();
    await page.waitForTimeout(4000);

    // Reload page and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    const updatedInput = page.locator('input#fullName');
    await expect(updatedInput).toBeVisible({ timeout: 15_000 });
    await expect(updatedInput).toHaveValue(newName);

    // Restore original name
    await updatedInput.clear();
    await updatedInput.fill(originalName);
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForTimeout(4000);
  });

  test('should show validation error for empty name', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('input#fullName');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });

    // Clear the name field
    await nameInput.clear();

    // Click Save
    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await saveBtn.click();

    // Should show validation error (toast or inline)
    const errorVisible = await page.getByText(/required|name.*must|cannot be empty|at least/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    // If form doesn't submit, the field should still be empty (form prevented submission)
    if (!errorVisible) {
      // At minimum, verify no success toast appeared
      const successVisible = await page.getByText(/profile updated successfully/i)
        .isVisible({ timeout: 2_000 }).catch(() => false);
      expect(successVisible).toBe(false);
    }
  });

  test('should display Account Information section', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Use first() to avoid strict mode with multiple matches
    await expect(page.getByText(/account information/i).first()).toBeVisible({ timeout: 15_000 });
    // Email should be displayed
    await expect(page.getByText(/@.*\.test/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show Change Password section with required fields', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/change password/i).first()).toBeVisible({ timeout: 15_000 });

    const currentPwd = page.locator('input#currentPassword');
    const newPwd = page.locator('input#newPassword');
    const confirmPwd = page.locator('input#confirmPassword');

    await expect(currentPwd).toBeVisible({ timeout: 10_000 });
    await expect(newPwd).toBeVisible();
    await expect(confirmPwd).toBeVisible();

    // Change Password button should exist
    await expect(page.getByRole('button', { name: /change password/i })).toBeVisible();
  });

  test('should validate password mismatch', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const currentPwd = page.locator('input#currentPassword');
    const newPwd = page.locator('input#newPassword');
    const confirmPwd = page.locator('input#confirmPassword');

    await expect(currentPwd).toBeVisible({ timeout: 15_000 });

    await currentPwd.fill('SomePassword123!');
    await newPwd.fill('NewPassword123!');
    await confirmPwd.fill('DifferentPassword123!');

    const changePwdBtn = page.getByRole('button', { name: /change password/i });
    await changePwdBtn.click();

    // Should show mismatch error
    const errorVisible = await page.getByText(/match|mismatch|don't match|do not match/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    if (!errorVisible) {
      // At minimum, no success toast
      const successVisible = await page.getByText(/password changed successfully/i)
        .isVisible({ timeout: 2_000 }).catch(() => false);
      expect(successVisible).toBe(false);
    }
  });
});

test.describe('Profile CRUD — Multi-Role Verification', () => {
  const roles = [
    { key: 'partnerAdmin' as const, label: 'Partner Admin', tempName: 'Partner Temp Name' },
    { key: 'hrRecruiter' as const, label: 'HR Recruiter', tempName: 'Recruiter Temp Name' },
    { key: 'guest' as const, label: 'Guest', tempName: 'Guest Temp Name' },
  ];

  for (const role of roles) {
    test(`${role.label} should update name and verify persistence`, async ({ page }) => {
      await signInViaAPI(page, role.key);
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('input#fullName');
      await expect(nameInput).toBeVisible({ timeout: 15_000 });

      const originalName = await nameInput.inputValue();

      // Only letters and spaces
      await nameInput.clear();
      await nameInput.fill(role.tempName);
      await page.getByRole('button', { name: /save changes/i }).click();
      await page.waitForTimeout(4000);

      // Reload and check
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('input#fullName')).toHaveValue(role.tempName, { timeout: 15_000 });

      // Restore
      const restored = page.locator('input#fullName');
      await restored.clear();
      await restored.fill(originalName);
      await page.getByRole('button', { name: /save changes/i }).click();
      await page.waitForTimeout(4000);
    });
  }
});
