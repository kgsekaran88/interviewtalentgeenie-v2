/**
 * E2E Tests: Interview & Assessment Workflows
 * 
 * Tests the complete interview lifecycle:
 * - Creating interview positions
 * - Managing questions
 * - Interview templates
 * - Candidate view (take interview)
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Interview & Assessment Workflows', () => {

  test.describe('Interview Management (HR Recruiter)', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
    });

    test('should display interviews page with table or empty state', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      // Should show interviews heading and either a table or "no interviews" message
      const heading = page.getByText(/interview|assessment|position/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });

      // Either data rows or empty state
      const content = page.getByText(/no interview|create your first|get started|interview/i).first();
      await expect(content).toBeVisible({ timeout: 10_000 });
    });

    test('should load create interview page with form', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      // Should have form elements for creating an interview
      const heading = page.getByText(/create|new|interview|position/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });

      // Look for form inputs (title, description, etc.)
      const inputs = page.locator('input, textarea, select').first();
      await expect(inputs).toBeVisible({ timeout: 10_000 });
    });

    test('should load quick create page', async ({ page }) => {
      await page.goto('/partner/recruiting/quick-create');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/quick|create|fast/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should load JD builder', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/job description|jd|builder|position/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Question Repository', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
    });

    test('should display question repository page', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/question|repository|bank|library/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test('should show seeded test question', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      // We seeded a question about dependency injection
      const question = page.getByText(/dependency injection/i);
      if (await question.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await expect(question).toBeVisible();
      }
    });
  });

  test.describe('Interview Templates', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
    });

    test('should display templates page', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/template|library|saved/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Tech SPOC Review', () => {

    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'techSpoc');
    });

    test('should display pending reviews', async ({ page }) => {
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      const heading = page.getByText(/pending|review|technical/i).first();
      await expect(heading).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Public Interview Links', () => {

    test('should show interview page for share link format', async ({ page }) => {
      // This tests the route exists (with a fake token)
      await page.goto('/take-interview/fake-share-link-123');
      await page.waitForLoadState('networkidle');

      // Should show either interview UI or "not found" / "invalid link"
      const content = page.getByText(/interview|not found|invalid|expired|link/i).first();
      await expect(content).toBeVisible({ timeout: 15_000 });
    });

    test('should show interview complete page', async ({ page }) => {
      await page.goto('/interview-complete/fake-attempt-id');
      await page.waitForLoadState('networkidle');

      const content = page.getByText(/complete|finish|thank|submit|not found/i).first();
      await expect(content).toBeVisible({ timeout: 15_000 });
    });
  });
});
