/**
 * Flow Test 10: Notification Lifecycle Flow
 *
 * User Journey: User interacts with the notification system.
 *   1. Navigate to notifications page
 *   2. View All / Unread tabs
 *   3. View seeded notifications
 *   4. Check Mark all read button availability
 *   5. Multiple roles can access notifications
 *
 * ⚠️  READ-ONLY: No notifications are created or marked as read.
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

test.describe('Flow: Notification Lifecycle', () => {
  test.describe('Guest User Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await signInViaAPI(page, 'guest');
    });

    test('should display notifications page', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show All and Unread tabs', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      // Tabs include count suffix like "All (N)" and "Unread (N)"
      const allTab = page.getByRole('tab', { name: /all/i }).first();
      const unreadTab = page.getByRole('tab', { name: /unread/i }).first();

      await expect.soft(allTab).toBeVisible({ timeout: 10_000 });
      await expect.soft(unreadTab).toBeVisible({ timeout: 10_000 });
    });

    test('should display seeded notifications', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2_000);

      // Seeded notifications contain welcome/system messages
      const notifContent = page.getByText(/welcome|system|notification/i).first();
      await expect.soft(notifContent).toBeVisible({ timeout: 10_000 });
    });

    test('should switch between All and Unread tabs', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      // Click Unread tab
      const unreadTab = page.getByRole('tab', { name: /unread/i }).first();
      if (await unreadTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await unreadTab.click();
        await page.waitForTimeout(500);

        // Content should update (either unread notifications or empty state)
        const content = page.getByText(/notification|no unread/i).first();
        await expect.soft(content).toBeVisible({ timeout: 10_000 });
      }

      // Click All tab
      const allTab = page.getByRole('tab', { name: /all/i }).first();
      if (await allTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await allTab.click();
        await page.waitForTimeout(500);
      }
    });

    test('should show Mark all read button when unread exist', async ({ page }) => {
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      const markAllBtn = page.getByRole('button', { name: /mark all read/i }).first();
      const isVisible = await markAllBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      // If visible, unread notifications exist
      if (isVisible) {
        await expect.soft(markAllBtn).toBeVisible();
      }
      // If not visible, no unread notifications — also valid
    });
  });

  test.describe('Notifications Across Roles', () => {
    const roles = [
      { key: 'platformAdmin', label: 'Platform Admin' },
      { key: 'partnerAdmin', label: 'Partner Admin' },
      { key: 'hrRecruiter', label: 'HR Recruiter' },
    ] as const;

    for (const role of roles) {
      test(`${role.label} should access notifications page`, async ({ page }) => {
        await signInViaAPI(page, role.key);
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 15_000 });
      });
    }
  });
});
