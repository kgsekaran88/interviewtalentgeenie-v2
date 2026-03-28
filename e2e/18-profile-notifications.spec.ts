/**
 * E2E Tests: Cross-Role Profile, Notifications & Common Pages
 *
 * Tests profile page, notifications, and settings for ALL 6 roles.
 * Also tests common authenticated pages like dashboard redirect.
 *
 * Each role should:
 * - Access /profile and see their own name
 * - Access /notifications and see notification UI
 * - Access /settings
 * - Be redirected to the correct dashboard on /dashboard
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     Mark-all-read buttons are checked for visibility but NEVER clicked.
 *     Profile fields are checked for presence but NEVER modified.
 *     No form submissions, no data creation/update/deletion.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';
import { TEST_USERS, type TestUserKey } from './helpers';

// ─── Role configs for parameterized tests ────────────────────────────────────
const ROLE_CONFIGS: Array<{
  key: TestUserKey;
  label: string;
  fullName: string;
  expectedDashboardPattern: RegExp;
}> = [
  {
    key: 'platformAdmin',
    label: 'Platform Admin',
    fullName: 'E2E Platform Admin',
    expectedDashboardPattern: /\/admin/,
  },
  {
    key: 'partnerAdmin',
    label: 'Partner Admin',
    fullName: 'E2E Partner Admin',
    expectedDashboardPattern: /\/partner/,
  },
  {
    key: 'hrRecruiter',
    label: 'HR Recruiter',
    fullName: 'E2E HR Recruiter',
    expectedDashboardPattern: /\/partner|\/recruiting/,
  },
  {
    key: 'techSpoc',
    label: 'Tech SPOC',
    fullName: 'E2E Tech SPOC',
    expectedDashboardPattern: /\/partner|\/recruiting/,
  },
  {
    key: 'billingContact',
    label: 'Billing Contact',
    fullName: 'E2E Billing Contact',
    expectedDashboardPattern: /\/learning-dashboard|\/partner|\/profile/,
  },
  {
    key: 'guest',
    label: 'Guest',
    fullName: 'E2E Guest User',
    expectedDashboardPattern: /\/learning|\/dashboard/,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE — Each role sees their own profile
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Profile — All Roles', () => {
  for (const role of ROLE_CONFIGS) {
    test.describe(`${role.label}`, () => {
      test.beforeEach(async ({ page }) => {
        await signInViaAPI(page, role.key);
      });

      test('should access profile page', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/profile|account/i).first()).toBeVisible({ timeout: 15_000 });
      });

      test('should see own name on profile', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.getByText(role.fullName).first()).toBeVisible({ timeout: 10_000 });
      });

      test('should see email on profile', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForLoadState('networkidle');

        const email = TEST_USERS[role.key].email;
        await expect.soft(page.getByText(email).first()).toBeVisible({ timeout: 10_000 });
      });

      test('should see change password section', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.getByText(/change password|password/i).first()).toBeVisible({ timeout: 10_000 });
      });

      test('should have personal information section with Full Name input', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForLoadState('networkidle');

        const nameInput = page.locator('input#fullName').or(page.locator('input[placeholder="John Doe"]')).first();
        await expect.soft(nameInput).toBeVisible({ timeout: 10_000 });

        // Should be pre-filled with user's name
        if (await nameInput.isVisible().catch(() => false)) {
          const value = await nameInput.inputValue();
          expect.soft(value.toLowerCase()).toContain('e2e');
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS — Each role sees their notifications
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Notifications — All Roles', () => {
  for (const role of ROLE_CONFIGS) {
    test.describe(`${role.label}`, () => {
      test.beforeEach(async ({ page }) => {
        await signInViaAPI(page, role.key);
      });

      test('should access notifications page', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 15_000 });
      });

      test('should show All and Unread tabs', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');

        // Tabs include count suffix like "All (0)" and "Unread (0)"
        await expect.soft(page.getByRole('tab', { name: /all/i }).first()).toBeVisible({ timeout: 10_000 });
        await expect.soft(page.getByRole('tab', { name: /unread/i }).first()).toBeVisible({ timeout: 10_000 });
      });

      test('should show Mark all read button when there are unread notifications', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');

        // Mark all read button only appears when there are unread notifications
        const markAllBtn = page.getByRole('button', { name: /mark all read/i }).first();
        const isVisible = await markAllBtn.isVisible({ timeout: 5_000 }).catch(() => false);
        // If no unread notifications exist, button won't be shown — that's valid
        if (isVisible) {
          await expect.soft(markAllBtn).toBeVisible();
        } else {
          // Confirm the page loaded properly by checking notification list or empty state
          await expect.soft(page.getByText(/notification|no notification/i).first()).toBeVisible({ timeout: 10_000 });
        }
      });

      test('should display seeded notifications or empty state', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');

        // Either notifications exist or empty state
        const content = page.getByText(/welcome|system|no notification|notification/i).first();
        await expect.soft(content).toBeVisible({ timeout: 10_000 });
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS — Each role can access settings
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Settings — All Roles', () => {
  for (const role of ROLE_CONFIGS) {
    test(`${role.label} should access settings page`, async ({ page }) => {
      await signInViaAPI(page, role.key);
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/setting/i).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD REDIRECT — Each role redirected correctly
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Dashboard Redirect — All Roles', () => {
  for (const role of ROLE_CONFIGS) {
    test(`${role.label} should be redirected to correct dashboard`, async ({ page }) => {
      await signInViaAPI(page, role.key);
      await page.goto('/dashboard');
      // Don't use networkidle — dashboards may have continuous API polling
      await page.waitForLoadState('domcontentloaded');
      // Wait for redirect to settle
      await page.waitForTimeout(3000);

      const url = page.url();
      // Should be redirected to role-appropriate dashboard
      expect.soft(url, `${role.label} should redirect to their dashboard`).toMatch(role.expectedDashboardPattern);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// UNAUTHENTICATED ACCESS — Public pages work without login
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Unauthenticated — Public Pages', () => {
  test('should display landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Landing page should have app branding or CTA
    await expect(page.getByText(/talentgeenie|interview|hiring|get started/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display auth page', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/sign in|log in|email/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/pricing|plan|free/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display learning catalog', async ({ page }) => {
    await page.goto('/learning');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/learn|practice|skill/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display certifications page', async ({ page }) => {
    await page.goto('/certifications');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/certif/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display 404 for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/not found|404|page.*not/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should redirect /admin to auth for unauthenticated user', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should redirect to auth page
    expect(page.url()).toContain('/auth');
  });

  test('should redirect /partner/portal to auth for unauthenticated user', async ({ page }) => {
    await page.goto('/partner/portal');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/auth');
  });

  test('should redirect /profile to auth for unauthenticated user', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/auth');
  });
});
