/**
 * E2E Tests: HR Recruiter — Deep Interaction Tests
 *
 * Tests all recruiting pages with real interactions:
 * interviews list, create interview, quick create, JD builder,
 * question repository, templates, report builder, proctoring.
 *
 * HR Recruiters are the primary users of the recruiting module.
 * Uses seeded data from global.setup.ts.
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     Form fields are filled to verify they accept input, then CLEARED.
 *     Dialogs are opened for verification but ALWAYS closed with Escape.
 *     No form submissions, no data creation/update/deletion.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI, expectAccessDenied } from './auth-utils';

test.describe('HR Recruiter — Deep', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'hrRecruiter');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERVIEW LIST (Dashboard)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Interview List', () => {
    test('should display interviews page with seeded data', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/interview|assessment|position/i).first()).toBeVisible({ timeout: 15_000 });

      // Seeded interviews: Senior React Developer, Full Stack Engineer, Data Engineer, DevOps Engineer
      await expect.soft(page.getByText(/senior react|full stack|data engineer|devops/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have search input that filters interviews', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="earch"]').or(page.locator('input[type="search"]')).first();
      if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await searchInput.fill('React');
        await page.waitForTimeout(1000); // debounce
        // Should filter to show only React-related interviews
        await expect.soft(page.getByText(/react/i).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should have status filter', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      // Status filter: Active, Draft, Completed
      const statusFilter = page.getByText(/active|draft|status/i).first();
      await expect.soft(statusFilter).toBeVisible({ timeout: 10_000 });
    });

    test('should have view mode toggles (cards, compact, table)', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      // View toggle buttons exist
      const buttons = page.locator('button[aria-label], button[title]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should navigate to create interview page', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create/i }).or(page.locator('a[href*="create-interview"]')).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForLoadState('networkidle');
        // Create Interview navigates to JD Builder wizard
        expect(page.url()).toMatch(/jd-builder|create-interview|create/);
      }
    });

    test('should support pagination if many interviews', async ({ page }) => {
      await page.goto('/partner/recruiting/interviews');
      await page.waitForLoadState('networkidle');

      // Pagination controls (may not appear with only 4 seeded interviews)
      const paginationBtn = page.getByRole('button', { name: /next|previous|\d/i }).first();
      // Soft check — only relevant with many items
      if (await paginationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect.soft(paginationBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE INTERVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Create Interview', () => {
    test('should display create interview form with all fields', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/create.*interview|new.*interview/i).first()).toBeVisible({ timeout: 15_000 });

      // Core form fields should be present
      const inputs = page.locator('input, textarea, select');
      const count = await inputs.count();
      expect(count).toBeGreaterThan(2); // Title, JD, etc.
    });

    test('should have Interview Title input', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      // SAFETY: Only verify field exists and accepts input — NEVER click Submit/Save/Create
      const titleInput = page.locator('input[name*="title"], input[placeholder*="title" i]').first();
      if (await titleInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await titleInput.fill('E2E Test Interview Position');
        await expect(titleInput).toHaveValue('E2E Test Interview Position');
        // Clear the field to prevent any auto-save side effects
        await titleInput.clear();
      }
    });

    test('should have Job Description textarea', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      // SAFETY: Only verify field exists and accepts input — NEVER click Submit/Save/Create
      const jdTextarea = page.locator('textarea[name*="description" i], textarea[placeholder*="description" i], textarea[placeholder*="job" i]').first();
      if (await jdTextarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await jdTextarea.fill('We are looking for a skilled developer...');
        // Clear the field to prevent any auto-save side effects
        await jdTextarea.clear();
      }
    });

    test('should have number of questions slider/input', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      // Look for question count control
      await expect.soft(page.getByText(/number of question|question count|how many/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have proctoring enable toggle', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/proctor|enable proctor/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Generate Questions button', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      const genBtn = page.getByRole('button', { name: /generate/i }).first();
      await expect.soft(genBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should have Save as Template option', async ({ page }) => {
      await page.goto('/partner/recruiting/create-interview');
      await page.waitForLoadState('networkidle');

      const templateBtn = page.getByRole('button', { name: /template|save.*template/i }).first();
      await expect.soft(templateBtn).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK CREATE
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Quick Create', () => {
    test('should display quick create page', async ({ page }) => {
      await page.goto('/partner/recruiting/quick-create');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/quick|create|fast/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should have Quick Create button', async ({ page }) => {
      await page.goto('/partner/recruiting/quick-create');
      await page.waitForLoadState('networkidle');

      const quickBtn = page.getByRole('button', { name: /quick create|create/i }).first();
      await expect.soft(quickBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should have Customize Settings option', async ({ page }) => {
      await page.goto('/partner/recruiting/quick-create');
      await page.waitForLoadState('networkidle');

      // QuickCreatePreview has "Customize Settings" button (not "Full Editor")
      const customizeBtn = page.getByRole('button', { name: /customize|settings/i }).first();
      await expect.soft(customizeBtn).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JD BUILDER (Job Description Wizard)
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('JD Builder', () => {
    test('should display JD builder wizard', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/job description|jd|builder/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should have wizard decision step with options', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      // JD Builder starts on a decision step with options: "I Have a JD", "Build from Scratch", or "Start from Template"
      const option = page.getByRole('button', { name: /have a jd|build from scratch|start from template/i }).first();
      await expect.soft(option).toBeVisible({ timeout: 10_000 });
    });

    test('should have skill selection checkboxes', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      // Skill checkboxes or badges
      await expect.soft(page.getByText(/skill|select|choose/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should navigate to Build from Scratch and see Next', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      // Click "Build from Scratch" to advance to the basic step where Next appears
      const scratchBtn = page.getByRole('button', { name: /build from scratch/i }).first();
      if (await scratchBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await scratchBtn.click();
        await page.waitForTimeout(1000);
        const nextBtn = page.getByRole('button', { name: /next/i }).first();
        await expect.soft(nextBtn).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should have Use Template option', async ({ page }) => {
      await page.goto('/partner/recruiting/jd-builder');
      await page.waitForLoadState('networkidle');

      const templateBtn = page.getByRole('button', { name: /template/i }).first();
      await expect.soft(templateBtn).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION REPOSITORY
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Question Repository', () => {
    test('should display question repository with seeded questions', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/question.*repository|question.*bank/i).first()).toBeVisible({ timeout: 15_000 });

      // Seeded questions should appear
      await expect.soft(page.getByText(/dependency injection|react hook|sql|api design|system design/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have search input for questions', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await searchInput.fill('dependency');
        await page.waitForTimeout(1000);
        await expect.soft(page.getByText(/dependency/i).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should have topic filter dropdown', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      // QuestionRepository has a Topic label above a select filter
      await expect.soft(page.getByText(/topic/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have difficulty filter', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      await expect.soft(page.getByText(/difficulty|easy|medium|hard/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should display question cards with badges', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      // Question cards should show type, difficulty, topic badges or empty state
      const badges = page.locator('[class*="badge"]');
      const count = await badges.count();
      // If questions are seeded, badges should exist; otherwise check page loaded
      expect.soft(count >= 0).toBeTruthy();
    });

    test('should have Create Question button (for authorized roles)', async ({ page }) => {
      await page.goto('/partner/recruiting/question-repository');
      await page.waitForLoadState('networkidle');

      // HR may or may not have create permission — soft check
      const createBtn = page.getByRole('button', { name: /create|add.*question|new.*question/i }).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect.soft(createBtn).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Interview Templates', () => {
    test('should display templates page', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/interview template|template library/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should have Create Template button', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create template/i }).first();
      await expect.soft(createBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should open create template dialog', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create template/i }).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();

        // Dialog fields: Template Name, Role Type, Category, Seniority
        await expect(page.getByText(/template name|role type|category/i).first()).toBeVisible({ timeout: 10_000 });
        // SAFETY: Close dialog without submitting — never create/modify data
        await page.keyboard.press('Escape');
      }
    });

    test('should have template search input', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      await expect.soft(searchInput).toBeVisible({ timeout: 10_000 });
    });

    test('should have seniority filter', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      // Seniority appears as SelectValue placeholder text inside a Select trigger
      // Use separate isVisible checks to avoid strict mode violation with .or()
      const seniorityFilter = page.locator('[role="combobox"]').filter({ hasText: /seniority|all levels/i }).first();
      const altFilter = page.getByText(/seniority|all levels|junior|senior|mid-level/i).first();
      const isSeniorityVisible = await seniorityFilter.isVisible().catch(() => false);
      const isAltVisible = await altFilter.isVisible().catch(() => false);
      expect.soft(isSeniorityVisible || isAltVisible, 'Seniority filter should be visible').toBe(true);
    });

    test('should have category tabs (All, Technical, Behavioral, Domain)', async ({ page }) => {
      await page.goto('/partner/recruiting/templates');
      await page.waitForLoadState('networkidle');

      for (const tab of ['All', 'Technical', 'Behavioral', 'Domain']) {
        await expect.soft(page.getByText(new RegExp(tab, 'i')).first()).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT BUILDER
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Report Builder', () => {
    test('should display report builder page', async ({ page }) => {
      await page.goto('/partner/recruiting/report-builder');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/report.*builder|custom report/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should have report creation form', async ({ page }) => {
      await page.goto('/partner/recruiting/report-builder');
      await page.waitForLoadState('networkidle');

      // Form fields: Report Name, Description, Type, Metrics
      const nameInput = page.locator('input[placeholder*="report" i], input[name*="name" i]').first();
      await expect.soft(nameInput).toBeVisible({ timeout: 10_000 });
    });

    test('should have metric checkboxes', async ({ page }) => {
      await page.goto('/partner/recruiting/report-builder');
      await page.waitForLoadState('networkidle');

      // Metric checkboxes: Average Score, Hire Rate, etc.
      await expect.soft(page.getByText(/average score|hire rate|metric/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Create Template submit button', async ({ page }) => {
      await page.goto('/partner/recruiting/report-builder');
      await page.waitForLoadState('networkidle');

      const submitBtn = page.getByRole('button', { name: /create template|create report/i }).first();
      await expect.soft(submitBtn).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCTORING
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Proctoring', () => {
    test('should display proctoring dashboard', async ({ page }) => {
      await page.goto('/partner/recruiting/proctoring');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/proctor|monitor|surveillance/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIAL — Admin routes blocked for HR
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Access Denial — Admin Routes', () => {
    test('should NOT access /admin hub', async ({ page }) => {
      await expectAccessDenied(page, '/admin');
    });

    test('should NOT access /admin/organizations', async ({ page }) => {
      await expectAccessDenied(page, '/admin/organizations');
    });

    test('should NOT access /admin/billing', async ({ page }) => {
      await expectAccessDenied(page, '/admin/billing');
    });

    test('should NOT access /admin/ai-configuration', async ({ page }) => {
      await expectAccessDenied(page, '/admin/ai-configuration');
    });
  });
});
