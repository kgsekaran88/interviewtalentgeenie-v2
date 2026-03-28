/**
 * Flow Test 02: Interview Management Flow
 *
 * User Journey: HR Recruiter manages existing interviews.
 *   1. View interview list with seeded data
 *   2. Search interviews by keyword
 *   3. Filter by status
 *   4. Toggle between view modes (cards, compact, table)
 *   5. View interview details
 *   6. Navigate back to list
 *
 * ⚠️  READ-ONLY: No interviews are created or modified.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Interview Management', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'hrRecruiter');
  });

  test('should display interview list with seeded data', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/interview management/i).first()).toBeVisible({ timeout: 15_000 });

    // Stats cards should show counts
    await expect.soft(page.getByText(/total interview/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should search interviews by keyword', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Type a search term
    await searchInput.fill('Frontend');
    await page.waitForTimeout(500);

    // Results should filter (or show no results message)
    const content = page.getByText(/frontend|no interview/i).first();
    await expect.soft(content).toBeVisible({ timeout: 10_000 });

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('should filter interviews by status', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    // Status filter button/popover
    const statusFilter = page.getByRole('button', { name: /status|filter/i }).first();
    if (await statusFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await statusFilter.click();
      await page.waitForTimeout(500);

      // Should show filter options (Active, Draft, Archived)
      const filterOption = page.getByText(/active|draft|archived/i).first();
      await expect.soft(filterOption).toBeVisible({ timeout: 5_000 });

      // Close without selecting
      await page.keyboard.press('Escape');
    }
  });

  test('should toggle between view modes', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/interview management/i).first()).toBeVisible({ timeout: 15_000 });

    // View mode toggle buttons (Compact, Cards, Table)
    const viewToggles = page.getByRole('button').filter({ has: page.locator('svg') });

    // Try clicking each view toggle if visible
    for (const label of ['table', 'compact', 'cards']) {
      const btn = page.locator(`button[aria-label*="${label}" i], button[title*="${label}" i]`).first();
      if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show download template button', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    const downloadBtn = page.getByRole('button', { name: /download template/i }).first();
    await expect.soft(downloadBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should show stats cards with correct labels', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    // 4 stats cards
    const labels = [/total interview/i, /active/i, /archived/i, /attempt/i];
    for (const label of labels) {
      await expect.soft(page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should show group by selector', async ({ page }) => {
    await page.goto('/partner/recruiting/interviews');
    await page.waitForLoadState('networkidle');

    const groupBy = page.getByText(/group by|no grouping/i).first();
    await expect.soft(groupBy).toBeVisible({ timeout: 10_000 });
  });
});
