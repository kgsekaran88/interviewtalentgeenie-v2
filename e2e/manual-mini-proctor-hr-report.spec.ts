/**
 * HR review smoke for the completed mini-proctor attempt.
 *
 * Run:
 *   ASSESSMENT_ID=96fc1627-bf35-4437-a48a-78787fab1caa \
 *   npx playwright test e2e/manual-mini-proctor-hr-report.spec.ts --reporter=line
 */
import { test, expect } from '@playwright/test';
import { signInViaAPI } from './auth-utils';

const ASSESSMENT_ID =
  process.env.ASSESSMENT_ID || '96fc1627-bf35-4437-a48a-78787fab1caa';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

test('HR can open assessment report with scores + proctoring', async ({ page }) => {
  await signInViaAPI(page, 'hrRecruiter');

  await page.goto(`/partner/recruiting/assessment/${ASSESSMENT_ID}`);
  await page.waitForLoadState('networkidle');

  // Candidate identity
  await expect(page.getByText(/Gunasekaran/i).first()).toBeVisible({ timeout: 30_000 });

  // Evaluation present
  await expect(page.getByText(/not[_ ]?recommended|Not Recommended/i).first()).toBeVisible({
    timeout: 20_000,
  });

  // Proctoring section / integrity cues
  const body = await page.locator('body').innerText();
  const hasProctorHints =
    /integrity|proctor|recording|tab switch|camera|screen/i.test(body);
  expect(hasProctorHints).toBeTruthy();

  // Soft check: page didn't crash into error boundary
  await expect(page.getByText(/Something went wrong|Interview Not Found/i)).toHaveCount(0);
});
