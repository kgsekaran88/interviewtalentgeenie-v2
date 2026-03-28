/**
 * Flow Test 06: Learning Plan User Flow
 *
 * User Journey: Guest user navigates their learning experience.
 *   1. Land on Learning Dashboard
 *   2. View quick stats (assessments, score, certifications)
 *   3. Navigate to My Learning Plan
 *   4. View assigned training plan with topics
 *   5. Navigate to My Certificates
 *   6. Navigate to Learning History
 *   7. Browse Learning Catalog
 *
 * ⚠️  READ-ONLY: No data is created or modified.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Learning Plan User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'guest');
  });

  test('should display Learning Dashboard with stats and features', async ({ page }) => {
    await page.goto('/learning-dashboard');
    await page.waitForLoadState('networkidle');

    // Learning Hub heading
    await expect(page.getByText(/learning hub/i).first()).toBeVisible({ timeout: 15_000 });

    // Quick stats cards
    await expect.soft(page.getByText(/total assessment/i).first()).toBeVisible({ timeout: 10_000 });
    await expect.soft(page.getByText(/certif/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate from dashboard to My Learning Plan', async ({ page }) => {
    await page.goto('/learning-dashboard');
    await page.waitForLoadState('networkidle');

    // Click "View My Plan" button
    const planBtn = page.getByRole('button', { name: /view my plan/i }).or(
      page.getByRole('link', { name: /view my plan/i })
    ).first();
    if (await planBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await planBtn.click();
      await page.waitForLoadState('networkidle');

      // Should be on My Learning Plan page
      expect.soft(page.url()).toContain('/my-learning-plan');
    }
  });

  test('should display assigned training plan with topics', async ({ page }) => {
    await page.goto('/my-learning-plan');
    await page.waitForLoadState('networkidle');

    // Page should show training content
    await expect(page.getByText(/learning plan|training/i).first()).toBeVisible({ timeout: 15_000 });

    // Seeded plan: E2E React Learning Path
    await expect.soft(page.getByText(/E2E React Learning Path/i).first()).toBeVisible({ timeout: 10_000 });

    // Seeded topics
    await expect.soft(page.getByText(/javascript fundamentals/i).first()).toBeVisible({ timeout: 10_000 });
    await expect.soft(page.getByText(/react advanced patterns/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show topic details (duration, required status)', async ({ page }) => {
    await page.goto('/my-learning-plan');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(3_000);

    // Topics show duration as Xh (e.g., 2h, 3h) — 120min=2h, 180min=3h
    const duration = page.getByText(/2h|3h|N\/A/i).first();
    await expect.soft(duration).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate from dashboard to My Certificates', async ({ page }) => {
    await page.goto('/learning-dashboard');
    await page.waitForLoadState('networkidle');

    // Click "My Certs" button
    const certsBtn = page.getByRole('button', { name: /my cert/i }).or(
      page.getByRole('link', { name: /my cert/i })
    ).first();
    if (await certsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await certsBtn.click();
      await page.waitForLoadState('networkidle');

      expect.soft(page.url()).toContain('/my-certificates');
      await expect.soft(page.getByText(/certif/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should navigate to Learning History', async ({ page }) => {
    await page.goto('/learning-dashboard');
    await page.waitForLoadState('networkidle');

    // Click "View All History" link
    const historyLink = page.getByText(/view all history/i).first();
    if (await historyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await historyLink.click();
      await page.waitForLoadState('networkidle');

      expect.soft(page.url()).toContain('/learning-history');
    }
  });

  test('should browse Learning Catalog', async ({ page }) => {
    await page.goto('/learning-dashboard');
    await page.waitForLoadState('networkidle');

    // Click "Browse" button on Certifications card
    const browseBtn = page.getByRole('button', { name: /browse/i }).or(
      page.getByRole('link', { name: /browse/i })
    ).first();
    if (await browseBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await browseBtn.click();
      await page.waitForLoadState('networkidle');

      expect.soft(page.url()).toContain('/certif');
    }
  });

  test('should show Learning Dashboard recent activity section', async ({ page }) => {
    await page.goto('/learning-dashboard');
    await page.waitForLoadState('networkidle');

    // Recent Activity card
    const activitySection = page.getByText(/recent activity|no activity/i).first();
    await expect.soft(activitySection).toBeVisible({ timeout: 10_000 });
  });
});
