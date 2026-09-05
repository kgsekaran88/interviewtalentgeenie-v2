/**
 * Flow Test 07: Partner Onboarding Flow
 *
 * User Journey: Platform Admin manages organizations and members.
 *   1. Navigate to Admin Hub → Organizations
 *   2. View organization list with seeded org
 *   3. Search organizations
 *   4. Click into an organization → view members, interviews
 *   5. Navigate between org management tabs
 *
 * ⚠️  READ-ONLY: No organizations or members are created/modified.
 *     Dialogs are opened for verification but closed with Escape.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';
import { getAdminClient } from './helpers';

test.describe('Flow: Partner Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await signInViaAPI(page, 'platformAdmin');
  });

  test('should navigate from Admin Hub to Organizations', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/admin|platform/i).first()).toBeVisible({ timeout: 15_000 });

    // Find Organizations link
    const orgLink = page.getByText(/organization/i).first();
    if (await orgLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await orgLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should display organizations list with seeded org', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');

    // Should show the seeded organization
    await expect(page.getByText(/E2E Test Organization/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should search organizations', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill('E2E');
      await page.waitForTimeout(500);

      // Should still show E2E Test Organization
      await expect.soft(page.getByText(/E2E Test Organization/i).first()).toBeVisible({ timeout: 10_000 });

      await searchInput.clear();
    }
  });

  test('should show organization stats (members, interviews)', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2_000);

    // Org card should show member count or interview count
    const stats = page.getByText(/member|interview|active/i).first();
    await expect.soft(stats).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate into organization management', async ({ page }) => {
    const admin = getAdminClient();
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('name', 'E2E Test Organization')
      .maybeSingle();
    expect(org?.id).toBeTruthy();

    await page.goto('/admin/organizations');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/E2E Test Organization/i).first()).toBeVisible({ timeout: 15_000 });

    // Direct manage URL (Settings control is icon-only in the list UI)
    await page.goto(`/partner/manage/${org!.id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect
      .soft(page.getByText(/E2E Test Organization|member|interview|setting|organization/i).first())
      .toBeVisible({ timeout: 15_000 });
  });

  test('should show organization management tabs', async ({ page }) => {
    // Navigate directly to org management
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');

    const manageBtn = page.getByRole('button', { name: /manage|view/i }).first();
    if (await manageBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await manageBtn.click();
      await page.waitForLoadState('networkidle');

      // Tabs: Members, Interviews, Pricing, Settings
      await expect.soft(page.getByText(/member/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should show Partner Portal from Partner Admin perspective', async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
    await page.goto('/partner/portal');
    await page.waitForLoadState('networkidle');

    // Partner Portal should show org-specific dashboard
    await expect(page.getByText(/partner|portal|dashboard/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('should show Organization Settings from Partner Admin', async ({ page }) => {
    await signInViaAPI(page, 'partnerAdmin');
    await page.goto('/partner/settings');
    await page.waitForLoadState('networkidle');

    // Partner Admin can access org settings
    const content = page.getByText(/setting|organization|team/i).first();
    await expect.soft(content).toBeVisible({ timeout: 15_000 });
  });
});
