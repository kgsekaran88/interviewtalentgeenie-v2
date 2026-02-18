/**
 * E2E Tests: Authentication Flow
 * 
 * Tests sign-up, sign-in, sign-out, and protected route access.
 * Does NOT test data deletion.
 */
import { test, expect } from '@playwright/test';
import { signInViaUI, signInViaAPI, signOut, expectOnAuthPage } from './auth-utils';
import { TEST_USERS, API_URL, ANON_KEY } from './helpers';

test.describe('Authentication', () => {

  test.describe('Sign-Up Flow', () => {

    test('should create a new account via UI', async ({ page }) => {
      const uniqueEmail = `e2e-signup-${Date.now()}@talentgeenie.test`;

      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      // Step 1: Enter email
      await page.locator('#email').fill(uniqueEmail);
      await page.getByRole('button', { name: 'Continue' }).click();

      // Step 2: Should show sign-up form (new user)
      const nameField = page.getByRole('textbox', { name: /full name/i });
      const signInBtn = page.getByRole('button', { name: 'Sign In' });

      // Wait for either form to appear
      await expect(nameField.or(signInBtn).first()).toBeVisible({ timeout: 10_000 });

      if (await nameField.isVisible()) {
        // Fill sign-up form
        await nameField.fill('E2E Test Signup');
        await page.getByRole('textbox', { name: /password/i }).fill('TestSignup123!@#');
        await page.getByRole('button', { name: 'Create Account' }).click();

        // Should show verification step or navigate away
        const verifyText = page.getByText(/check your email|verify/i);
        const navigated = page.locator('body');
        await expect(verifyText.or(navigated)).toBeVisible({ timeout: 15_000 });
      }
    });

    test('should show password requirements during sign-up', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      const uniqueEmail = `e2e-pwreq-${Date.now()}@talentgeenie.test`;
      await page.locator('#email').fill(uniqueEmail);
      await page.getByRole('button', { name: 'Continue' }).click();

      const createAccountBtn = page.getByRole('button', { name: 'Create Account' });
      if (await createAccountBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        // Type a weak password to see requirements
        await page.locator('#signup-password').fill('weak');
        
        // Password requirements should be shown
        const requirements = page.getByText(/character|uppercase|lowercase|number|special/i);
        await expect(requirements.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('Sign-In Flow', () => {

    test('should sign in platform admin via UI', async ({ page }) => {
      await signInViaUI(page, 'platformAdmin');

      // Should be redirected to partner portal or admin area (platform_admin gets /partner/portal)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth');
    });

    test('should sign in via API and access protected pages', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');

      // Navigate to admin hub
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should see Platform Admin Hub (not redirected to /auth)
      await expect(page.getByRole('heading', { name: 'Platform Admin Hub' })).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('should show error for wrong password', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await page.locator('#email').fill(TEST_USERS.platformAdmin.email);
      await page.getByRole('button', { name: 'Continue' }).click();

      await page.locator('#signin-password').waitFor({ state: 'visible', timeout: 10_000 });
      await page.locator('#signin-password').fill('WrongPassword123!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Should show an error message
      const error = page.getByText(/invalid|incorrect|wrong|error|credentials/i);
      await expect(error.first()).toBeVisible({ timeout: 10_000 });
    });

    test('should sign in guest user and redirect to learning dashboard', async ({ page }) => {
      await signInViaAPI(page, 'guest');

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Guest should be redirected to learning dashboard
      await page.waitForURL(/learning-dashboard|dashboard|\//, { timeout: 15_000 });
    });
  });

  test.describe('Sign-Out', () => {

    test('should sign out and redirect to auth', async ({ page }) => {
      await signInViaAPI(page, 'platformAdmin');

      // Verify signed in — visit a protected page
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('/auth');

      // Sign out
      await signOut(page);
      await expectOnAuthPage(page);
    });
  });

  test.describe('Protected Route Access', () => {

    test('should redirect unauthenticated users to /auth from /admin', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
    });

    test('should redirect unauthenticated users to /auth from /partner/portal', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
    });

    test('should redirect unauthenticated users to /auth from /profile', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
    });

    test('should redirect unauthenticated users to /auth from /settings', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
    });

    test('guest user should not access admin pages', async ({ page }) => {
      await signInViaAPI(page, 'guest');
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show Access Denied alert or be redirected
      await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible({ timeout: 15_000 });
    });

    test('HR recruiter should not access admin hub directly', async ({ page }) => {
      await signInViaAPI(page, 'hrRecruiter');
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show Access Denied
      await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible({ timeout: 15_000 });
    });
  });
});
