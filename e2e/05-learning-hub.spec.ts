/**
 * E2E Tests: Learning Hub & Certifications
 * 
 * Tests the learning dashboard, practice assessments,
 * certifications, and related features.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Learning Hub', () => {

  test.describe('Guest User (Learner)', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'guest');
    });

    test('should display learning dashboard', async ({ page }) => {
      await page.goto('/learning-dashboard');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/learning|dashboard|hub|practice/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display learning history', async ({ page }) => {
      await page.goto('/learning-history');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/history|past|completed|record/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display my learning plan', async ({ page }) => {
      await page.goto('/my-learning-plan');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/learning plan|study|track/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display my certificates page', async ({ page }) => {
      await page.goto('/my-certificates');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/certificate|earned|achievement/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Public Learning Pages', () => {

    test('should display learning catalog without auth', async ({ page }) => {
      await page.goto('/learning');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/learn|practice|skill|assessment/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display learning pricing without auth', async ({ page }) => {
      await page.goto('/learning-pricing');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/pricing|plan|learn/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display certifications page without auth', async ({ page }) => {
      await page.goto('/certifications');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/certif|learn|skill/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });
});
