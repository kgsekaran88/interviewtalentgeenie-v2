/**
 * E2E Tests: Partner / Organization Features
 * 
 * Tests the partner portal, organization management,
 * and all partner-level functionality.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Partner Portal', () => {

  test.describe('Partner Admin', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'partnerAdmin');
    });

    test('should display partner portal', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      // Should show Partner Hub or portal content
      const heading = page.getByText(/partner|hub|portal|organization/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('should display partner dashboard', async ({ page }) => {
      await page.goto('/partner/dashboard');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/dashboard|overview|partner/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display partner settings', async ({ page }) => {
      await page.goto('/partner/settings');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/setting|configuration|partner/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display partner analytics', async ({ page }) => {
      await page.goto('/partner/analytics');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/analytics|report|insight/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display partner users page', async ({ page }) => {
      await page.goto('/partner/users');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/user|team|member/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display partner billing page', async ({ page }) => {
      await page.goto('/partner/billing');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/billing|invoice|payment|subscription/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Recruiting Features (HR Recruiter)', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
    });

    test('should display interviews list', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/interview|assessment|position/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display JD builder page', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/job description|jd|position|builder/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display create interview page', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/create|new|interview|assessment/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display quick create page', async ({ page }) => {
      await page.goto('/partner/recruiting/quick-create');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/quick|create|fast|new/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display question repository', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/question|repository|bank|library/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display templates page', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/template|library|saved/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should display report builder page', async ({ page }) => {
      await page.goto('/partner/recruiting/report-builder');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/report|builder|analytics/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Tech SPOC Features', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'techSpoc');
    });

    test('should display pending reviews page', async ({ page }) => {
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/pending|review|technical/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });
});
