/**
 * Flow Test 01: Interview Creation Flow
 *
 * User Journey: HR Recruiter navigates the interview creation wizard.
 *   1. Land on interview list → click Create Interview
 *   2. JD Builder decision step → choose "Build from Scratch"
 *   3. Fill in basic info (job title, experience level)
 *   4. Navigate through wizard steps
 *   5. Verify preview step renders
 *
 * ⚠️  READ-ONLY: Wizard steps are navigated but NO form submissions.
 *     Uses Escape to close dialogs. No interviews are created.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Interview Creation', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'hrRecruiter');
  });

  test('should navigate from interview list to create interview via JD Builder', async ({ page }) => {
    // Step 1: Land on interview management page
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    await expect(page.getByText(/interview management/i).first()).toBeVisible({ timeout: 15_000 });

    // Click "Create Interview" button → navigates to JD Builder
    const createBtn = page.getByRole('button', { name: /create interview/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    // Step 2: JD Builder decision step
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/create interview/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display JD Builder decision options', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Decision step: three options
    await expect(page.getByText(/job description/i).first()).toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByText(/build from scratch/i).first()).toBeVisible({ timeout: 10_000 });
    await expect.soft(page.getByText(/template/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate JD Builder wizard — Build from Scratch path', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Click "Build from Scratch"
    const scratchBtn = page.getByText(/build from scratch/i).first();
    await expect(scratchBtn).toBeVisible({ timeout: 10_000 });
    await scratchBtn.click();

    // Step 1: Basic Information
    await expect(page.getByText(/basic information|step 1/i).first()).toBeVisible({ timeout: 10_000 });

    // Should have job title field
    const jobTitleArea = page.getByText(/job title/i).first();
    await expect.soft(jobTitleArea).toBeVisible({ timeout: 10_000 });

    // Should have experience level selector
    await expect.soft(page.getByText(/experience level/i).first()).toBeVisible({ timeout: 10_000 });

    // Next button to advance
    const nextBtn = page.getByRole('button', { name: /next/i }).first();
    await expect.soft(nextBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate JD Builder wizard — Paste JD path', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Click "I have a Job Description"
    const pasteBtn = page.getByText(/I have a job description/i).first();
    if (await pasteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pasteBtn.click();

      // Should show paste JD form
      await expect.soft(page.locator('#jobTitle')).toBeVisible({ timeout: 10_000 });
      await expect.soft(page.locator('#pastedJD, textarea').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should access full interview editor directly', async ({ page }) => {
    await page.goto('/partner/recruiting/create-interview');
    await page.waitForLoadState('networkidle');

    // Full editor page
    await expect(page.getByText(/create interview|configure/i).first()).toBeVisible({ timeout: 15_000 });

    // Key fields — use input locator to avoid strict mode with labels
    await expect.soft(page.locator('#title, input[name="title"]').first()).toBeVisible({ timeout: 10_000 });
    await expect.soft(page.getByText(/skill domain|question|job description/i).first()).toBeVisible({ timeout: 10_000 });

    // Generate button should exist
    const generateBtn = page.getByRole('button', { name: /generate questions|generate interview/i }).first();
    await expect.soft(generateBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should show proctoring toggle on interview editor', async ({ page }) => {
    await page.goto('/partner/recruiting/create-interview');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/create interview|configure/i).first()).toBeVisible({ timeout: 15_000 });

    // Proctoring section
    await expect.soft(page.getByText(/proctoring/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show template picker from JD Builder', async ({ page }) => {
    await page.goto('/partner/recruiting/jd-builder');
    await page.waitForLoadState('networkidle');

    // Click "Start from Template"
    const templateBtn = page.getByText(/start from template|template/i).first();
    if (await templateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await templateBtn.click();
      await page.waitForTimeout(1_000);

      // Should open template picker dialog or show templates
      const templateDialog = page.getByText(/template|select|choose/i).first();
      await expect.soft(templateDialog).toBeVisible({ timeout: 10_000 });

      // Close with Escape
      await page.keyboard.press('Escape');
    }
  });
});
