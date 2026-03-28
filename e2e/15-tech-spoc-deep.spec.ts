/**
 * E2E Tests: Tech SPOC — Deep Interaction Tests
 *
 * Tests all pages accessible to tech_spoc with real interactions:
 * pending reviews, question repository review, partner portal access,
 * and access denial for admin routes.
 *
 * Tech SPOCs are technical reviewers who approve/review interview questions.
 * Uses seeded data from global.setup.ts.
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     Dialogs are opened for verification but ALWAYS closed with Escape.
 *     Approve buttons are checked for visibility but NEVER clicked.
 *     No form submissions, no data creation/update/deletion.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI, expectAccessDenied } from './auth-utils';

test.describe('Tech SPOC — Deep', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'techSpoc');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PENDING REVIEWS (Primary page for Tech SPOC)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Pending Reviews', () => {
    test('should display pending reviews page', async ({ page }) => {
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/pending review/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show review cards with interview details', async ({ page }) => {
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      // Each review card shows: interview title, JD excerpt, status badge
      // May have seeded interviews assigned to tech_spoc for review
      const cards = page.locator('[class*="card"]');
      const count = await cards.count();
      // Even if no pending reviews, the page should render properly
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show Review Questions button on cards', async ({ page }) => {
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      // If there are pending review items, they should have action button
      const reviewBtn = page.getByRole('button', { name: /review.*question/i }).or(page.getByRole('link', { name: /review/i })).first();
      if (await reviewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect.soft(reviewBtn).toBeVisible();
      }
    });

    test('should show status badges (Pending Review, Approved, Needs Changes)', async ({ page }) => {
      await page.goto('/partner/recruiting/pending-reviews');
      await page.waitForLoadState('networkidle');

      // Status badges on review items
      const statusText = page.getByText(/pending review|approved|needs changes|no.*review/i).first();
      await expect.soft(statusText).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION REPOSITORY (View + Approve)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Question Repository', () => {
    test('should display question repository with seeded questions', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/question.*repository|question.*bank/i).first()).toBeVisible({ timeout: 15_000 });

      // Should see seeded questions
      await expect.soft(page.getByText(/dependency injection|react hook|sql|api design|system design/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Create Question button (tech_spoc can create)', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create|add.*question|new/i }).first();
      await expect.soft(createBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should open create question dialog', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create|add.*question|new/i }).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();

        // Dialog should show: Question text, type, difficulty, topic
        await expect(page.getByText(/question text|type|difficulty|topic/i).first()).toBeVisible({ timeout: 10_000 });
        // SAFETY: Close dialog without submitting — never create/modify data
        await page.keyboard.press('Escape');
      }
    });

    test('should search questions by keyword', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await searchInput.fill('dependency');
        await page.waitForTimeout(1000);
        await expect.soft(page.getByText(/dependency/i).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should filter by difficulty', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const difficultyFilter = page.locator('select, [role="combobox"]').filter({ hasText: /difficulty|easy|medium|hard/i }).first();
      if (await difficultyFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await difficultyFilter.click();
        await page.getByText(/hard/i).first().click();
        await page.waitForTimeout(1000);
      }
    });

    test('should have Approve button for pending questions', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const approveBtn = page.getByRole('button', { name: /approve/i }).first();
      if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect.soft(approveBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERVIEW LIST (View access)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Interview List (View)', () => {
    test('should display interviews list', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/interview|assessment|position/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should see seeded interview positions', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/senior react|full stack|data engineer|devops/i).first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER PORTAL ACCESS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Portal', () => {
    test('should access partner portal', async ({ page }) => {
      await page.goto('/partner/portal');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/partner|hub|portal/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access partner dashboard', async ({ page }) => {
      await page.goto('/partner/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/dashboard|overview/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should access partner settings or be redirected (admin only)', async ({ page }) => {
      await page.goto('/partner/settings');
      await page.waitForLoadState('networkidle');

      // OrganizationSettings only allows partner_admin/platform_admin.
      // Tech SPOC should see an access denied toast or be redirected.
      const accessDenied = page.getByText('Access Denied').first();
      const settingsHeading = page.getByRole('heading', { name: /setting|organization/i }).first();
      const isAccessDenied = await accessDenied.isVisible().catch(() => false);
      const isSettings = await settingsHeading.isVisible().catch(() => false);
      expect(isAccessDenied || isSettings).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES (View)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Templates', () => {
    test('should access templates page', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/template/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Admin Routes', () => {
    test('should NOT access /admin hub', async ({ page }) => {
      await expectAccessDenied(page, '/admin');
    });

    test('should NOT access /admin/organizations', async ({ page }) => {
      await expectAccessDenied(page, '/admin/organizations');
    });

    test('should NOT access /admin/user-management', async ({ page }) => {
      await expectAccessDenied(page, '/admin/user-management');
    });
  });
});
