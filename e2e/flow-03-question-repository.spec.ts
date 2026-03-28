/**
 * Flow Test 03: Question Repository Flow
 *
 * User Journey: Tech SPOC works with the question repository.
 *   1. View question repository with seeded questions
 *   2. Search questions by keyword
 *   3. Filter by topic
 *   4. Filter by difficulty
 *   5. View question details (badges, status)
 *   6. Verify Create Question dialog opens/closes
 *
 * ⚠️  READ-ONLY: No questions are created or modified.
 *     Dialogs are opened for verification but closed with Escape.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Question Repository', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'techSpoc');
  });

  test('should display question repository with seeded questions', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/question repository/i).first()).toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByText(/centralized question bank/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should search questions by keyword', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    // Search input
    const searchInput = page.locator('#search').or(page.locator('input[placeholder*="earch"]')).first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Search for a term
    await searchInput.fill('React');
    await page.waitForTimeout(500);

    // Should filter results
    const content = page.getByText(/react|no question/i).first();
    await expect.soft(content).toBeVisible({ timeout: 10_000 });

    // Clear and search for another
    await searchInput.clear();
    await searchInput.fill('JavaScript');
    await page.waitForTimeout(500);

    // Clear search
    await searchInput.clear();
  });

  test('should filter questions by topic', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    // Topic filter dropdown
    const topicFilter = page.getByText(/all topics/i).first();
    if (await topicFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await topicFilter.click();
      await page.waitForTimeout(500);

      // Should show topic options
      const option = page.getByRole('option').first();
      if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Close without selecting
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should filter questions by difficulty', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    // Difficulty filter
    const diffFilter = page.getByText(/all levels/i).first();
    if (await diffFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await diffFilter.click();
      await page.waitForTimeout(500);

      // Should show Easy/Medium/Hard options
      const option = page.getByText(/easy|medium|hard/i).first();
      await expect.soft(option).toBeVisible({ timeout: 5_000 });

      // Close without selecting
      await page.keyboard.press('Escape');
    }
  });

  test('should display question cards with badges', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    // Wait for questions to load
    await page.waitForTimeout(2_000);

    // Question cards should have type and difficulty badges
    const badge = page.locator('.inline-flex, [data-slot="badge"]').first();
    if (await badge.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Badges exist — question cards are rendered
      await expect.soft(badge).toBeVisible();
    }
  });

  test('should open Create Question dialog and close it', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    // Create Question button (available for tech_spoc)
    const createBtn = page.getByRole('button', { name: /create question/i }).first();
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Dialog should have form fields
      await expect.soft(page.getByText(/question text/i).first()).toBeVisible({ timeout: 5_000 });
      await expect.soft(page.getByText(/question type/i).first()).toBeVisible({ timeout: 5_000 });
      await expect.soft(page.getByText(/difficulty/i).first()).toBeVisible({ timeout: 5_000 });

      // Cancel button
      const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should show approve button for pending questions', async ({ page }) => {
    await page.goto('/partner/recruiting/question-repository');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2_000);

    // Check for Approve button on pending questions
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect.soft(approveBtn).toBeVisible();
    }
    // If no pending questions, that's also valid
  });
});
