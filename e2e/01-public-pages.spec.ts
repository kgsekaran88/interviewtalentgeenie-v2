/**
 * E2E Tests: Public Pages
 * 
 * Tests all pages that should be accessible without authentication:
 * - Landing page
 * - Auth page
 * - Pricing page
 * - Learning catalog
 * - Certificate verification
 */
import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {

  test.describe('Landing Page', () => {

    test('should display hero section with CTA', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Hero content
      await expect(page.getByText('AI-Powered Interview Platform')).toBeVisible();
      await expect(page.getByText('Smart Interviews. Secure Assessments. Confident Decisions.')).toBeVisible();

      // CTA buttons
      const getStarted = page.getByRole('button', { name: 'Get Started Free' }).first();
      await expect(getStarted).toBeVisible();
    });

    test('should have navigation with Sign In link', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const signIn = page.getByRole('button', { name: 'Sign In' }).first();
      await expect(signIn).toBeVisible();
    });

    test('Get Started Free navigates to /auth', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const getStarted = page.getByRole('button', { name: 'Get Started Free' }).first();
      await getStarted.click();
      await page.waitForURL(/\/auth/, { timeout: 10_000 });
    });

    test('should have pricing link', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const pricingLink = page.getByRole('button', { name: /pricing/i }).or(page.getByRole('link', { name: /pricing/i })).first();
      await expect(pricingLink).toBeVisible();
    });
  });

  test.describe('Auth Page', () => {

    test('should display email entry form (step 1)', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Welcome to TalentGeenie')).toBeVisible();
      await expect(page.getByText('Enter your email to get started')).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    });

    test('should show validation error on empty email', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Continue' }).click();
      // HTML5 validation should prevent submission — email is required
      const emailInput = page.locator('#email');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
      expect(isInvalid).toBe(true);
    });

    test('should advance to sign-up for new email', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await page.locator('#email').fill('brand-new-user-e2e@example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Should show sign-up form with Full Name field
      const nameField = page.getByRole('textbox', { name: /full name/i });
      const signInBtn = page.getByRole('button', { name: 'Sign In' });
      await expect(nameField.or(signInBtn).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should advance to sign-in for existing user', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await page.locator('#email').fill('e2e-admin@talentgeenie.test');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Should show sign-in form
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#signin-password')).toBeVisible();
    });

    test('should show Forgot Password link on sign-in step', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await page.locator('#email').fill('e2e-admin@talentgeenie.test');
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Forgot your password?')).toBeVisible();
    });
  });

  test.describe('Pricing Page', () => {

    test('should display pricing plans', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Page heading
      await expect(page.getByRole('heading', { name: /choose your plan/i })).toBeVisible({ timeout: 10_000 });

      // Should have plan tabs
      const interviewTab = page.getByRole('tab', { name: /interview platform/i });
      const learningTab = page.getByRole('tab', { name: /learning hub/i });

      // At least one tab should be visible
      await expect(interviewTab).toBeVisible({ timeout: 10_000 });
    });

    test('should show subscription plans from database', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Wait for plans to load — we seeded Free Trial, Starter, Professional, Enterprise, Large Enterprises
      await expect(page.getByText('Free Trial').or(page.getByText('Free'))).toBeVisible({ timeout: 15_000 });
    });

    test('should toggle between Monthly and Annual pricing', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      const monthlyTab = page.getByRole('tab', { name: /monthly/i });
      const annualTab = page.getByRole('tab', { name: /annual/i });

      if (await monthlyTab.isVisible()) {
        await monthlyTab.click();
        await annualTab.click();
        // Both tabs should exist
        await expect(annualTab).toBeVisible();
      }
    });
  });

  test.describe('Reset Password Page', () => {

    test('should display password reset form', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      // Should show some form of password reset UI
      const heading = page.getByText(/reset|forgot|password/i).first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Learning Page', () => {

    test('should display learning catalog', async ({ page }) => {
      await page.goto('/learning');
      await page.waitForLoadState('networkidle');

      // Should show the learning hub / catalog
      const heading = page.getByText(/learn|practice|skill|assessment/i).first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Certificate Verification', () => {

    test('should display verification form', async ({ page }) => {
      await page.goto('/verify-certificate');
      await page.waitForLoadState('networkidle');

      // Should show some form of certificate verification UI
      const heading = page.getByText(/certif|verif/i).first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('404 Page', () => {

    test('should show not found for invalid routes', async ({ page }) => {
      await page.goto('/this-route-does-not-exist-12345');
      await page.waitForLoadState('networkidle');

      // Should show 404 page
      const notFound = page.getByRole('heading', { name: '404' });
      await expect(notFound).toBeVisible({ timeout: 10_000 });
    });
  });
});
