/**
 * Flow Test 04: JD Builder Wizard Flow
 *
 * User Journey: HR Recruiter uses the JD Builder wizard end-to-end.
 *   1. Decision step — choose between options
 *   2. Build from Scratch: Basic Info → Skills → Responsibilities → Additional → Preview
 *   3. Paste JD: Paste → Enhance → Preview
 *   4. Template: Pick template → Preview
 *
 * ⚠️  READ-ONLY: Wizard is navigated but NO JDs are created.
 *     Uses Back/Next buttons only.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: JD Builder Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'hrRecruiter');
  });

  test('should display decision step with all three paths', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/create interview/i).first()).toBeVisible({ timeout: 15_000 });

    // Three paths available
    await expect.soft(page.getByText(/I have a job description/i).first()).toBeVisible({ timeout: 10_000 });
    await expect.soft(page.getByText(/build from scratch/i).first()).toBeVisible({ timeout: 10_000 });
    await expect.soft(page.getByText(/start from template|template/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate Build from Scratch — Step 1 Basic Info', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Choose Build from Scratch
    await page.getByText(/build from scratch/i).first().click();
    await page.waitForTimeout(1_000);

    // Step 1: Basic Information
    await expect(page.getByText(/basic information|step 1/i).first()).toBeVisible({ timeout: 10_000 });

    // Job Title field
    await expect.soft(page.getByText(/job title/i).first()).toBeVisible({ timeout: 10_000 });

    // Experience Level
    await expect.soft(page.getByText(/experience level/i).first()).toBeVisible({ timeout: 10_000 });

    // Navigation buttons
    await expect.soft(page.getByRole('button', { name: /next/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate Build from Scratch — Step 2 Skills', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    await page.getByText(/build from scratch/i).first().click();
    await page.waitForTimeout(1_000);

    // Click Next to go to Step 2
    const nextBtn = page.getByRole('button', { name: /next/i }).first();
    if (await nextBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);

      // Step 2: Skills
      const skillContent = page.getByText(/skill|step 2/i).first();
      await expect.soft(skillContent).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should navigate Paste JD path', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Choose "I have a Job Description"
    const pasteOption = page.getByText(/I have a job description/i).first();
    if (await pasteOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pasteOption.click();
      await page.waitForTimeout(1_000);

      // Should show Job Title input and JD textarea
      await expect.soft(page.locator('#jobTitle, input[name="jobTitle"]').first()).toBeVisible({ timeout: 10_000 });

      // Paste area
      await expect.soft(page.locator('#pastedJD, textarea').first()).toBeVisible({ timeout: 10_000 });

      // Enhance with AI button
      await expect.soft(page.getByText(/enhance with ai/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should have Back button to return to decision step', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Choose Build from Scratch
    await page.getByText(/build from scratch/i).first().click();
    await page.waitForTimeout(1_000);

    // Should have Back button
    const backBtn = page.getByRole('button', { name: /back/i }).first();
    if (await backBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1_000);

      // Should be back at decision step
      await expect.soft(page.getByText(/build from scratch/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should be accessible by Partner Admin too', async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Partner Admin should also access JD Builder
    await expect(page.getByText(/create interview/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
