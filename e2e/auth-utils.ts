/**
 * Shared page object model for common auth operations.
 */
import { type Page, expect } from '@playwright/test';
import { TEST_USERS, type TestUserKey, API_URL, ANON_KEY } from './helpers';

/**
 * Sign in through the UI (multi-step auth page).
 * After sign-in, waits for navigation away from /auth.
 */
export async function signInViaUI(page: Page, userKey: TestUserKey): Promise<void> {
  const user = TEST_USERS[userKey];

  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Step 1: Enter email
  const emailInput = page.locator('#email');
  await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
  await emailInput.fill(user.email);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: Enter password (sign-in form should appear)
  const passwordInput = page.locator('#signin-password');
  await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
  await passwordInput.fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for navigation away from /auth
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15_000 });
}

/**
 * Sign in via the Supabase API directly and set the session in localStorage.
 * This is faster than UI sign-in and avoids flaky UI interactions.
 */
export async function signInViaAPI(page: Page, userKey: TestUserKey): Promise<void> {
  const user = TEST_USERS[userKey];

  // Call Supabase Auth API directly
  const response = await page.request.post(`${API_URL}/auth/v1/token?grant_type=password`, {
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    data: {
      email: user.email,
      password: user.password,
    },
  });

  const body = await response.json();

  if (!response.ok()) {
    throw new Error(`Auth API failed for ${user.email}: ${body.error_description || body.msg || JSON.stringify(body)}`);
  }

  const { access_token, refresh_token, expires_in, token_type, user: authUser } = body;

  // Go to a page to set localStorage
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Set the session in localStorage (same key Supabase JS client uses)
  await page.evaluate(
    ({ access_token, refresh_token, expires_in, token_type, user }) => {
      const storageKey = `sb-localhost-auth-token`;
      const session = {
        access_token,
        refresh_token,
        expires_in,
        expires_at: Math.floor(Date.now() / 1000) + expires_in,
        token_type,
        user,
      };
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { access_token, refresh_token, expires_in, token_type, user: authUser },
  );

  // Reload to pick up the session — the Supabase client will read it from localStorage
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Give auth context time to process the session
  await page.waitForTimeout(2000);
}

/**
 * Sign out the current user.
 */
export async function signOut(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear all supabase session keys
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    }
  });
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
}

/**
 * Expect the user to be on the auth page (not authenticated).
 */
export async function expectOnAuthPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByText('Welcome to TalentGeenie')).toBeVisible();
}
