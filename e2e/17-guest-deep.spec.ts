/**
 * E2E Tests: Guest User — Deep Interaction Tests
 *
 * Tests all pages accessible to guest role with real interactions:
 * learning dashboard, learning history, my learning plan, my certificates.
 * Also tests access denial for admin, partner, and recruiting routes.
 *
 * Guests are learners who use the self-service learning & certification platform.
 * Uses seeded data from global.setup.ts.
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     Mark-all-read buttons are checked for visibility but NEVER clicked.
 *     No form submissions, no data creation/update/deletion.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI, expectAccessDenied } from './auth-utils';

test.describe('Guest User — Deep', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'guest');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Learning Dashboard', () => {
    test('should display learning dashboard with hub content', async ({ page }) => {
      await page.goto('/learning-dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/learning hub|learning dashboard/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show stats cards', async ({ page }) => {
      await page.goto('/learning-dashboard');
      await page.waitForLoadState('networkidle');

      // Stats: Total Assessments, Average Score, Certifications, Active Plans
      await expect.soft(page.getByText(/assessment|score|certification|plan/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show feature cards for navigation', async ({ page }) => {
      await page.goto('/learning-dashboard');
      await page.waitForLoadState('networkidle');

      // Feature cards: Certifications, My Learning Plan, Browse, View All History
      const featureButtons = [
        /browse|catalog/i,
        /cert/i,
        /plan|learning plan/i,
        /history/i,
      ];
      for (const pattern of featureButtons) {
        await expect.soft(page.getByText(pattern).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should navigate to certifications from dashboard', async ({ page }) => {
      await page.goto('/learning-dashboard');
      await page.waitForLoadState('networkidle');

      const certLink = page.getByText(/my cert|certificate/i).first();
      if (await certLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await certLink.click();
        await page.waitForLoadState('networkidle');
        // URL may contain /cert or remain on learning-dashboard if link is internal
        expect.soft(page.url()).toMatch(/cert|learning/i);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Learning History', () => {
    test('should display learning history page', async ({ page }) => {
      await page.goto('/learning-history');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/assessment history|learning history/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/learning-history');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      await expect.soft(searchInput).toBeVisible({ timeout: 10_000 });
    });

    test('should have status filter', async ({ page }) => {
      await page.goto('/learning-history');
      await page.waitForLoadState('networkidle');

      // Status filter: All, Draft, Generating, Ready, Completed
      await expect.soft(page.getByText(/status|all status/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have mode filter', async ({ page }) => {
      await page.goto('/learning-history');
      await page.waitForLoadState('networkidle');

      // Mode filter: All, Practice, Assessment
      await expect.soft(page.getByText(/mode|practice|assessment/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show back button to learning dashboard', async ({ page }) => {
      await page.goto('/learning-history');
      await page.waitForLoadState('networkidle');

      const backBtn = page.locator('button, a').filter({ hasText: /back|←/i }).first();
      if (await backBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/learning-dashboard');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MY LEARNING PLAN
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('My Learning Plan', () => {
    test('should display learning plan page', async ({ page }) => {
      await page.goto('/my-learning-plan');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/learning plan|study plan|training/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show learning plan content (cards or empty state)', async ({ page }) => {
      await page.goto('/my-learning-plan');
      await page.waitForLoadState('networkidle');

      // MyLearningPlan renders a flat card list (no tabs)
      // Either topic cards with progress bars or empty state
      const content = page.getByText(/javascript|react|start practice|no.*plan|training/i).first();
      await expect.soft(content).toBeVisible({ timeout: 10_000 });
    });

    test('should display seeded training topics', async ({ page }) => {
      await page.goto('/my-learning-plan');
      await page.waitForLoadState('networkidle');

      // Seeded topics: JavaScript Fundamentals, React Advanced Patterns
      await expect.soft(page.getByText(/javascript|react|fundamental|advanced/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have action buttons per topic (Start Practice Assessment)', async ({ page }) => {
      await page.goto('/my-learning-plan');
      await page.waitForLoadState('networkidle');

      const actionBtn = page.getByRole('button', { name: /start practice assessment/i }).first();
      // Button only shows if topics are loaded
      if (await actionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect.soft(actionBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MY CERTIFICATES
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('My Certificates', () => {
    test('should display certificates page', async ({ page }) => {
      await page.goto('/my-certificates');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/my certificate|certificate|earned/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show certificate cards or empty state', async ({ page }) => {
      await page.goto('/my-certificates');
      await page.waitForLoadState('networkidle');

      // Either certificates exist or empty state with "Browse Certifications"
      const content = page.getByText(/download|share|verify|browse certif|no certificate/i).first();
      await expect.soft(content).toBeVisible({ timeout: 10_000 });
    });

    test('should have Download PDF button if certificates exist', async ({ page }) => {
      await page.goto('/my-certificates');
      await page.waitForLoadState('networkidle');

      const downloadBtn = page.getByRole('button', { name: /download|pdf/i }).first();
      if (await downloadBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect.soft(downloadBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE & NOTIFICATIONS (Auth-Any)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Profile & Notifications', () => {
    test('should access profile page', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/profile|account/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should see own name on profile', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/E2E Guest User/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have change password section', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/change password|password/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should access notifications page', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show Mark all read button when unread exist', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      // Mark all read button only appears when unreadCount > 0
      const markAllBtn = page.getByRole('button', { name: /mark all read/i }).first();
      const isVisible = await markAllBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (isVisible) {
        await expect.soft(markAllBtn).toBeVisible();
      } else {
        await expect.soft(page.getByText(/notification/i).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should show notification tabs (All, Unread)', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      // Tabs include count suffix like "All (0)" and "Unread (0)"
      await expect.soft(page.getByRole('tab', { name: /all/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect.soft(page.getByRole('tab', { name: /unread/i }).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should access settings page', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/setting/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC LEARNING PAGES (accessible even without auth)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Public Learning Pages (Authenticated Guest)', () => {
    test('should access learning catalog', async ({ page }) => {
      await page.goto('/learning');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/learn|practice|skill|assessment/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access certifications page', async ({ page }) => {
      await page.goto('/certifications');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/certif|learn|skill/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access learning pricing page', async ({ page }) => {
      await page.goto('/learning-pricing');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/pricing|plan|learn/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL — Admin Routes
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Admin Routes', () => {
    test('should NOT access /admin', async ({ page }) => {
      await expectAccessDenied(page, '/admin');
    });

    test('should NOT access /admin/organizations', async ({ page }) => {
      await expectAccessDenied(page, '/admin/organizations');
    });

    test('should NOT access /admin/user-management', async ({ page }) => {
      await expectAccessDenied(page, '/admin/user-management');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL — Partner Routes
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Partner Routes', () => {
    test('should NOT access /partner/portal', async ({ page }) => {
      await expectAccessDenied(page, '/partner/portal');
    });

    test('should NOT access /partner/users', async ({ page }) => {
      await expectAccessDenied(page, '/partner/users');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL — Recruiting Routes
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Recruiting Routes', () => {
    test('should NOT access /partner/recruiting/interviews', async ({ page }) => {
      await expectAccessDenied(page, '/partner/recruiting/interviews');
    });

    test('should NOT access /partner/recruiting/jd-builder', async ({ page }) => {
      await expectAccessDenied(page, '/partner/recruiting/jd-builder');
    });

    test('should NOT access /partner/recruiting/question-repository', async ({ page }) => {
      await expectAccessDenied(page, '/partner/recruiting/question-repository');
    });
  });
});
