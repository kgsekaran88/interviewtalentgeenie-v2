/**
 * Flow Test 05: Training Plan Management Flow
 *
 * User Journey: Platform Admin manages learning plans.
 *   1. Navigate to Admin Hub
 *   2. Go to Learning Plan Management
 *   3. View existing plans
 *   4. Open Create Plan dialog → verify fields → close
 *   5. Verify plan cards show correct details
 *
 * ⚠️  READ-ONLY: No plans are created or modified.
 *     Dialogs are opened for verification but closed with Escape.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Training Plan Management', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  test('should navigate from Admin Hub to Learning Plan Management', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/admin|platform/i).first()).toBeVisible({ timeout: 15_000 });

    // Find Learning Plan Management link/card
    const learningLink = page.getByText(/learning plan|training/i).first();
    if (await learningLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await learningLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/learning plan management/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('should display Learning Plan Management page', async ({ page }) => {
    await page.goto('/admin/learning-plan-management');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);

    // Use heading specifically to avoid matching breadcrumb link with same text
    await expect(page.getByRole('heading', { name: /learning plan management/i })).toBeVisible({ timeout: 20_000 });
    await expect.soft(page.getByText(/configure learning/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show Back to Admin Hub button', async ({ page }) => {
    await page.goto('/admin/learning-plan-management');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);

    // Back button is an icon button (ArrowLeft) that navigates to /admin
    const backBtn = page.getByRole('button').filter({ has: page.locator('svg') }).first();
    await expect.soft(backBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should show Create Plan button', async ({ page }) => {
    await page.goto('/admin/learning-plan-management');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create plan/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should open Create Plan dialog and verify fields', async ({ page }) => {
    await page.goto('/admin/learning-plan-management');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create plan/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await page.waitForTimeout(500);

    // Dialog should have form fields
    await expect.soft(page.getByText(/plan name/i).first()).toBeVisible({ timeout: 5_000 });
    await expect.soft(page.getByText(/price/i).first()).toBeVisible({ timeout: 5_000 });

    // Close dialog
    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
    if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('should display existing plan cards', async ({ page }) => {
    await page.goto('/admin/learning-plan-management');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2_000);

    // Plan cards should exist if there are plans
    const planCard = page.getByText(/monthly|yearly|active|assessment|certification/i).first();
    await expect.soft(planCard).toBeVisible({ timeout: 10_000 });
  });
});
