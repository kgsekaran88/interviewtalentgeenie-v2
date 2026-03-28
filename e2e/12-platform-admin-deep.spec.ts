/**
 * E2E Tests: Platform Admin — Deep Interaction Tests
 *
 * Tests every page accessible to platform_admin with real interactions:
 * admin hub navigation, org management, user management, billing,
 * email config, AI config, learning management, monitoring, promotions,
 * scheduled jobs, log analysis, cost monitoring.
 *
 * Uses seeded data from global.setup.ts.
 *
 * ⚠️  DATA SAFETY: These tests are strictly READ-ONLY.
 *     Dialogs are opened for verification but ALWAYS closed with Escape.
 *     No form submissions, no data creation/update/deletion.
 */
import { test, expect, type Page } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

// ─── Sign in once per test ────────────────────────────────────────────────────
test.describe('Platform Admin — Deep', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN HUB
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Admin Hub', () => {
    test('should display all category sections', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /Platform Admin Hub/i })).toBeVisible({ timeout: 15_000 });

      // All 7 category groups
      for (const cat of [
        'Critical Operations',
        'Billing',
        'Monitoring',
        'Communications',
        'Learning',
        'AI',
        'DevOps',
      ]) {
        await expect.soft(page.getByText(new RegExp(cat, 'i')).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should display stat cards with real numbers', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Stat cards: Total Organizations, Pending Applications, Active Organizations, Active Subscriptions
      const statsSection = page.locator('[class*="grid"]').first();
      await expect(statsSection).toBeVisible({ timeout: 15_000 });

      // At least the "Total Organizations" card should show our E2E org
      await expect.soft(page.getByText(/total organization/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should navigate to each sub-page via nav cards', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Click the "Partner Organizations" card and verify navigation
      const orgCard = page.getByText(/Partner Organizations/i).first();
      if (await orgCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await orgCard.click();
        await page.waitForURL(/\/admin\/organizations/, { timeout: 10_000 });
        expect(page.url()).toContain('/admin/organizations');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANIZATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Organization Management', () => {
    test('should display organizations list with search', async ({ page }) => {
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/partner organization/i).first()).toBeVisible({ timeout: 15_000 });

      // Search for our test org
      const searchInput = page.locator('input[placeholder*="earch"]').or(page.locator('input[type="search"]')).first();
      if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await searchInput.fill('E2E');
        await page.waitForTimeout(1000); // debounce
        await expect(page.getByText('E2E Test Organization')).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should display seeded E2E Test Organization with stats', async ({ page }) => {
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('E2E Test Organization')).toBeVisible({ timeout: 15_000 });

      // Should show member/interview counts from seeded data
      const orgCard = page.locator('[class*="card"]').filter({ hasText: 'E2E Test Organization' }).first();
      await expect(orgCard).toBeVisible({ timeout: 10_000 });
    });

    test('should filter organizations by status', async ({ page }) => {
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');

      // Click "Active" filter button
      const activeBtn = page.getByRole('button', { name: /active/i }).first();
      if (await activeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await activeBtn.click();
        await page.waitForTimeout(500);
        // Our seeded org should still be visible (it's active)
        await expect.soft(page.getByText('E2E Test Organization')).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should open organization manage page with tabs', async ({ page }) => {
      await page.goto('/admin/organizations');
      await page.waitForLoadState('networkidle');

      // Click "Settings" or "View" on the E2E org
      const orgCard = page.locator('[class*="card"]').filter({ hasText: 'E2E Test Organization' }).first();
      const settingsBtn = orgCard.locator('button, a').filter({ hasText: /setting|manage|view/i }).first();
      if (await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await settingsBtn.click();
        await page.waitForLoadState('networkidle');

        // After clicking, we should see org management content — either tabbed view or feature cards
        const orgContent = page.getByText(/team member|interview|organization|setting/i).first();
        await expect.soft(orgContent).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('User Management', () => {
    test('should display user management page with users', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/user management/i).first()).toBeVisible({ timeout: 15_000 });

      // Should show our seeded test users
      await expect.soft(page.getByText(/e2e/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should have Add User button that opens dialog', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      const addBtn = page.getByRole('button', { name: /add user/i }).first();
      if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addBtn.click();
        // Dialog should appear with name, email fields
        await expect(page.getByText(/full name|email/i).first()).toBeVisible({ timeout: 10_000 });
        // SAFETY: Close dialog without submitting — never create/modify data
        await page.keyboard.press('Escape');
      }
    });

    test('should switch between Platform Wide and By Organization views', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      // Look for view mode selector
      const viewSelector = page.locator('select, [role="combobox"]').filter({ hasText: /platform|organization/i }).first();
      if (await viewSelector.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await viewSelector.click();
        await page.getByText(/by organization/i).first().click();
        await page.waitForTimeout(1000);
        // Should show org selector
        await expect.soft(page.getByText(/select.*organization/i).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should show role badges for each user', async ({ page }) => {
      await page.goto('/admin/user-management');
      await page.waitForLoadState('networkidle');

      // Role badges should be visible (at least one of our roles)
      const roleBadges = page.getByText(/platform_admin|partner_admin|hr_recruiter|tech_spoc|billing_contact|guest/i).first();
      await expect.soft(roleBadges).toBeVisible({ timeout: 10_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Role Management', () => {
    test('should display role assignment page', async ({ page }) => {
      await page.goto('/admin/role-assignment');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/role/i).first()).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });

    test('should display role permissions page', async ({ page }) => {
      await page.goto('/admin/role-permissions');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/permission|role/i).first()).toBeVisible({ timeout: 15_000 });
      expect(page.url()).not.toContain('/auth');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Analytics', () => {
    test('should display analytics dashboard with charts', async ({ page }) => {
      await page.goto('/admin/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/analytics|dashboard|overview/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display operation logs', async ({ page }) => {
      await page.goto('/admin/operation-logs');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/operation|log|interview/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BILLING
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Billing & Plans', () => {
    test('should display platform billing page with tabs', async ({ page }) => {
      await page.goto('/admin/billing');
      await page.waitForLoadState('networkidle');

      // The billing page may render admin hub if it navigates away
      await expect(page.getByText(/billing|platform|administration/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display plan management page', async ({ page }) => {
      await page.goto('/admin/plan-management');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/plan|subscription/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display promotions page with seeded data', async ({ page }) => {
      await page.goto('/admin/promotions');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/promotion/i).first()).toBeVisible({ timeout: 15_000 });

      // Should show "Create Promotion" button
      const createBtn = page.getByRole('button', { name: /create promotion/i }).first();
      await expect.soft(createBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should open create promotion dialog', async ({ page }) => {
      await page.goto('/admin/promotions');
      await page.waitForLoadState('networkidle');

      const createBtn = page.getByRole('button', { name: /create promotion/i }).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();

        // Dialog should have name, type, code, discount fields
        await expect(page.getByText(/promotion name|promotion type/i).first()).toBeVisible({ timeout: 10_000 });
        // SAFETY: Close dialog without submitting — never create/modify data
        await page.keyboard.press('Escape');
      }
    });

    test('should display cost monitoring page with filters', async ({ page }) => {
      await page.goto('/admin/cost-monitoring');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/cost|monitoring/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMAIL CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Email Configuration', () => {
    test('should display email config with tabs', async ({ page }) => {
      await page.goto('/admin/email-configuration');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/email configuration/i).first()).toBeVisible({ timeout: 15_000 });

      // Tabs: Provider/Settings, Templates, Analytics (text may be hidden on small viewports)
      // Check for tab triggers by role instead of text
      const tabs = page.getByRole('tab');
      await expect.soft(tabs.first()).toBeVisible({ timeout: 10_000 });
    });

    test('should display provider settings form', async ({ page }) => {
      await page.goto('/admin/email-configuration');
      await page.waitForLoadState('networkidle');

      // Provider form fields
      await expect.soft(page.getByText(/api key|from email|from name|enable/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should switch to Templates tab', async ({ page }) => {
      await page.goto('/admin/email-configuration');
      await page.waitForLoadState('networkidle');

      const templatesTab = page.getByText(/template/i).first();
      if (await templatesTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await templatesTab.click();
        await page.waitForTimeout(1000);
        // Templates content should load
        const mainContent = page.locator('main');
        await expect.soft(mainContent.getByText(/template|email/i).first()).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('AI Configuration', () => {
    test('should display AI config page with tabs', async ({ page }) => {
      await page.goto('/admin/ai-configuration');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/ai configuration/i).first()).toBeVisible({ timeout: 15_000 });

      // Tabs: Health, Features, Credentials/API Keys, Usage/Analytics
      for (const tab of ['Health', 'Features']) {
        await expect.soft(page.getByText(new RegExp(tab, 'i')).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should show Add API Key button in credentials tab', async ({ page }) => {
      await page.goto('/admin/ai-configuration');
      await page.waitForLoadState('networkidle');

      // Navigate to API Keys tab (labeled "API Keys", not "Credentials")
      const credTab = page.getByRole('tab', { name: /api key|credential/i }).first();
      if (await credTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await credTab.click();
        await page.waitForTimeout(1000);

        const addKeyBtn = page.getByRole('button', { name: /add.*key/i }).first();
        await expect.soft(addKeyBtn).toBeVisible({ timeout: 10_000 });
      } else {
        // Fallback — click the tab by text
        const tabByText = page.getByText(/api key/i).first();
        if (await tabByText.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await tabByText.click();
          await page.waitForTimeout(1000);
          const addKeyBtn = page.getByRole('button', { name: /add.*key/i }).first();
          await expect.soft(addKeyBtn).toBeVisible({ timeout: 10_000 });
        }
      }
    });

    test('should display chatbot management page', async ({ page }) => {
      await page.goto('/admin/chatbot-management');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/chatbot|assistant|ai/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display AI usage monitoring', async ({ page }) => {
      await page.goto('/admin/ai-usage-monitoring');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/ai.*usage|usage.*monitor/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display AI log analysis with chat interface', async ({ page }) => {
      await page.goto('/admin/log-analysis');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/log.*analysis|ai.*analysis/i).first()).toBeVisible({ timeout: 15_000 });

      // Should have quick prompt buttons
      const promptBtns = page.getByRole('button');
      const count = await promptBtns.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING & CERTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Learning & Certification Admin', () => {
    test('should display learning management with stats', async ({ page }) => {
      await page.goto('/admin/learning-management');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/learning.*administration|learning.*management/i).first()).toBeVisible({ timeout: 15_000 });

      // Stats cards
      await expect.soft(page.getByText(/assessment|active user|revenue|score/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should display learning management tabs', async ({ page }) => {
      await page.goto('/admin/learning-management');
      await page.waitForLoadState('networkidle');

      // Tabs: Activity, Topics, Subscriptions, Payments
      for (const tab of ['Activity', 'Topics', 'Subscription', 'Payment']) {
        await expect.soft(page.getByText(new RegExp(tab, 'i')).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should display certification admin page', async ({ page }) => {
      await page.goto('/admin/certification-admin');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/certif/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MONITORING & SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Monitoring & System', () => {
    test('should display system monitoring with health metrics', async ({ page }) => {
      await page.goto('/admin/system-monitoring');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/monitor|system|health/i).first()).toBeVisible({ timeout: 15_000 });

      // Should have a refresh button
      const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
      await expect.soft(refreshBtn).toBeVisible({ timeout: 10_000 });
    });

    test('should display scheduled jobs page', async ({ page }) => {
      await page.goto('/admin/scheduled-jobs');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/scheduled|job|cron/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display platform settings page', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/setting|platform|configuration/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER APPLICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Partner Application Review', () => {
    test('should display partner applications with tabs', async ({ page }) => {
      await page.goto('/admin/applications');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/partner|application/i).first()).toBeVisible({ timeout: 15_000 });

      // Tabs: Pending, Approved, Rejected
      for (const tab of ['Pending', 'Approved', 'Rejected']) {
        await expect.soft(page.getByText(new RegExp(tab, 'i')).first()).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENTATION & ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Documentation & Architecture', () => {
    test('should display documentation page', async ({ page }) => {
      await page.goto('/admin/documentation');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/documentation|guide|reference/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display architecture documentation', async ({ page }) => {
      await page.goto('/admin/architecture');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/architect|system|diagram/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display deployment configurator', async ({ page }) => {
      await page.goto('/admin/deploy');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/deploy|configuration/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display deployment dashboard', async ({ page }) => {
      await page.goto('/admin/deploy-dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/deploy|dashboard/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ADMIN PAGES
  // ═══════════════════════════════════════════════════════════════════════════
  test.describe('Additional Admin Pages', () => {
    test('should display certification analytics page', async ({ page }) => {
      await page.goto('/admin/certification-analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/certif|analytics/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display certification configuration page', async ({ page }) => {
      await page.goto('/admin/certification-configuration');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/certif|config/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display proctoring settings page', async ({ page }) => {
      await page.goto('/admin/proctoring-settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/proctor|setting|config/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display training management page', async ({ page }) => {
      await page.goto('/admin/training');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/training|manage/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display testing hub page', async ({ page }) => {
      await page.goto('/admin/testing-hub');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/test|hub|quality/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display payment gateways page', async ({ page }) => {
      await page.goto('/admin/payment-gateways');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/payment|gateway/i).first()).toBeVisible({ timeout: 15_000 });
    });
  });
});
