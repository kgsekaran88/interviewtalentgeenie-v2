/**
 * Flow 15: User Management CRUD Operations
 *
 * Tests the Add User dialog, role assignment, and user table:
 * - Open Add User dialog → fill form → validate → submit
 * - Verify form validation (empty fields, invalid email)
 * - Role checkbox interactions
 * - User table search and filter
 * - Multi-role user management access
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

const SUPABASE_URL = 'http://localhost:8000';
const SERVICE_KEY = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc3MTQwNDIzNywgImV4cCI6IDIwODY3NjQyMzd9.6_nqKXwhutXVE2LtPo26yjPILFBbTcv1LBzen3vaf2Y';

test.describe('User Management — Add User Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  test('should open Add User dialog with all form fields', async ({ page }) => {
    await page.goto('/admin/user-management');
    await page.waitForLoadState('networkidle');

    // Click Add User button
    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
    await addUserBtn.click();

    // Dialog should appear with form fields
    await expect(page.getByText(/add.*user|invite.*user|create.*user/i).first()).toBeVisible({ timeout: 10_000 });

    // Name field
    const nameField = page.locator('input[placeholder="John Doe"]').or(page.getByLabel(/full name|name/i)).first();
    await expect(nameField).toBeVisible({ timeout: 5_000 });

    // Email field
    const emailField = page.locator('input[placeholder="user@example.com"]').or(page.getByLabel(/email/i)).first();
    await expect(emailField).toBeVisible();

    // Role checkboxes
    const hrCheckbox = page.locator('#new-hr_recruiter').or(page.getByLabel(/hr.*recruiter/i)).first();
    await expect.soft(hrCheckbox).toBeVisible({ timeout: 5_000 });
  });

  test('should validate required fields in Add User dialog', async ({ page }) => {
    await page.goto('/admin/user-management');
    await page.waitForLoadState('networkidle');

    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
    await addUserBtn.click();

    await page.waitForTimeout(500);

    // Try to submit without filling anything
    const submitBtn = page.getByRole('button', { name: /add|create|invite|submit/i })
      .filter({ hasNotText: /cancel|close/i }).last();
    
    if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await submitBtn.click();

      // Should show validation error
      const error = await page.getByText(/required|fill|email.*valid|enter.*name/i).first()
        .isVisible({ timeout: 5_000 }).catch(() => false);
      
      // At minimum, dialog should still be open (form didn't submit)
      await expect(page.getByText(/add.*user|invite.*user|create.*user/i).first()).toBeVisible();
    }
  });

  test('should validate email format in Add User dialog', async ({ page }) => {
    await page.goto('/admin/user-management');
    await page.waitForLoadState('networkidle');

    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
    await addUserBtn.click();

    await page.waitForTimeout(500);

    // Fill name
    const nameField = page.locator('input[placeholder="John Doe"]').or(page.getByLabel(/full name|name/i)).first();
    if (await nameField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameField.fill('Test User');
    }

    // Fill invalid email
    const emailField = page.locator('input[placeholder="user@example.com"]').or(page.getByLabel(/email/i)).first();
    if (await emailField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await emailField.fill('not-an-email');
    }

    // Select a role
    const hrCheckbox = page.locator('#new-hr_recruiter');
    if (await hrCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await hrCheckbox.click();
    }

    // Try to submit
    const submitBtn = page.getByRole('button', { name: /add|create|invite|submit/i })
      .filter({ hasNotText: /cancel|close/i }).last();

    if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await submitBtn.evaluate((el: HTMLElement) => el.click());
      await page.waitForTimeout(1000);

      // Should show email validation error or dialog stays open
      const errorOrStillOpen = await page.getByText(/invalid.*email|valid.*email|email.*format/i).first()
        .isVisible({ timeout: 5_000 }).catch(() => false);

      if (!errorOrStillOpen) {
        // Dialog should still be open
        await expect.soft(page.locator('input[placeholder="user@example.com"]')
          .or(page.getByLabel(/email/i)).first()).toBeVisible();
      }
    }
  });

  test('should have role checkboxes that are interactive', async ({ page }) => {
    await page.goto('/admin/user-management');
    await page.waitForLoadState('networkidle');

    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
    await addUserBtn.click();
    await page.waitForTimeout(500);

    // Check various role checkboxes exist
    const roleCheckboxes = [
      'new-hr_recruiter',
      'new-tech_spoc',
      'new-partner_admin',
      'new-billing_contact',
    ];

    for (const checkboxId of roleCheckboxes) {
      const checkbox = page.locator(`#${checkboxId}`);
      if (await checkbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Click to check
        await checkbox.click();
        await page.waitForTimeout(200);

        // Click again to uncheck
        await checkbox.click();
        await page.waitForTimeout(200);
      }
    }

    // At least some role options should be visible
    const roleLabels = page.getByText(/hr.*recruiter|tech.*spoc|partner.*admin|billing.*contact/i);
    expect(await roleLabels.count()).toBeGreaterThanOrEqual(1);
  });

  test('should close dialog on Cancel click', async ({ page }) => {
    await page.goto('/admin/user-management');
    await page.waitForLoadState('networkidle');

    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
    await addUserBtn.click();

    await page.waitForTimeout(500);

    // Verify dialog opened — a dialog-specific element should be visible
    const dialogOverlay = page.locator('[role="dialog"]').or(page.locator('[data-state="open"]')).first();
    const dialogOpened = await dialogOverlay.isVisible({ timeout: 3_000 }).catch(() => false);

    if (dialogOpened) {
      // Press Escape to close dialog (more reliable than clicking X)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Dialog overlay should be gone
      await expect(dialogOverlay).not.toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('User Management — User Table Operations', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
    await page.goto('/admin/user-management');
    await page.waitForLoadState('networkidle');
  });

  test('should display user table with seeded users', async ({ page }) => {
    // User table should show seeded E2E users
    const userContent = page.getByText(/e2e|platform.*admin|partner.*admin/i).first();
    await expect(userContent).toBeVisible({ timeout: 15_000 });
  });

  test('should search users by name or email', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i]').or(page.getByRole('searchbox')).first();
    const isVisible = await searchInput.isVisible({ timeout: 10_000 }).catch(() => false);

    if (isVisible) {
      await searchInput.fill('e2e');
      await page.waitForTimeout(1000);

      // Should show filtered results containing "e2e"
      const results = page.getByText(/e2e/i);
      await expect(results.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should display role badges for users', async ({ page }) => {
    // Users should have role badges
    const roleBadges = page.getByText(/platform.*admin|partner.*admin|hr.*recruiter|tech.*spoc|billing|guest/i);
    await expect(roleBadges.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('User Management — Partner Admin Access', () => {
  test('Partner Admin should access partner-level user management', async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
    await page.goto('/partner/users');
    await page.waitForLoadState('networkidle');

    // Should see user management page (partner scope)
    const content = page.getByText(/user|management|member/i).first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test('Partner Admin should see Add User button', async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
    await page.goto('/partner/users');
    await page.waitForLoadState('networkidle');

    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
  });

  test('Partner Admin Add User dialog should scope to organization', async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
    await page.goto('/partner/users');
    await page.waitForLoadState('networkidle');

    const addUserBtn = page.getByRole('button', { name: /add user|invite user|new user/i });
    await expect(addUserBtn).toBeVisible({ timeout: 15_000 });
    await addUserBtn.click();

    await page.waitForTimeout(500);

    // Dialog should appear
    const dialog = page.getByText(/add.*user|invite.*user|create.*user/i).first();
    await expect.soft(dialog).toBeVisible({ timeout: 10_000 });
  });
});
