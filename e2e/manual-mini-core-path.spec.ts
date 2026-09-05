/**
 * Minimal core-path smoke: take interview with 5 of 10 bank questions,
 * exercise coding editor languages, submit, leave attempt for evaluation.
 *
 * Run: npx playwright test e2e/manual-mini-core-path.spec.ts --reporter=line
 * Env: MINI_SHARE_LINK=... (required)
 */
import { test, expect } from '@playwright/test';

const SHARE = process.env.MINI_SHARE_LINK || '';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8084';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('mini core: take interview with coding UI + submit 5 answers', async ({ page }) => {
  test.skip(!SHARE, 'Set MINI_SHARE_LINK to the interview share_link');

  const findings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') findings.push(`console.error: ${msg.text().slice(0, 200)}`);
  });

  await page.goto(`${BASE}/take-interview/${SHARE}`);
  await page.waitForLoadState('networkidle');

  // Landing / start form
  await expect(page.getByText(/Mini Core Path Test|interview/i).first()).toBeVisible({ timeout: 20_000 });
  findings.push('interview_landing:ok');

  const nameInput = page.locator('#name, input[placeholder="John Doe"]').first();
  const emailInput = page.locator('#email, input[type="email"]').first();
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.fill('Mini Core Candidate');
  await emailInput.fill(`mini-core-${Date.now()}@talentgeenie.test`);

  const startBtn = page.getByRole('button', { name: /start interview|begin|continue/i }).first();
  await expect(startBtn).toBeVisible({ timeout: 10_000 });
  await startBtn.click();

  // Wait for questions UI (non-proctored should start immediately)
  await expect(
    page.getByText(/question|mcq|coding|scenario|descriptive|submit/i).first()
  ).toBeVisible({ timeout: 45_000 });
  findings.push('questions_loaded:ok');

  // Collect question cards / steppers — walk through up to 5
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(800);

    const codingEditor = page.locator('.monaco-editor, textarea').first();
    const langSelect = page.locator('button:has-text("Python"), button:has-text("JavaScript"), [role="combobox"]').first();
    const mcqOption = page.locator('button, [role="radio"], label').filter({ hasText: /./ }).first();
    const descriptive = page.locator('textarea').first();

    const isCoding = await page.locator('.monaco-editor').count() > 0
      || await page.getByText(/write your (python|javascript|sql|code)/i).count() > 0
      || await page.getByRole('button', { name: /python|javascript|typescript|java|sql|go/i }).count() > 0;

    const isMcq = await page.locator('input[type="radio"]').count() > 0
      || await page.getByRole('radio').count() > 0
      || await page.locator('[data-question-type="mcq"]').count() > 0;

    if (isCoding) {
      findings.push(`q${i + 1}:coding`);
      const langSelect = page.locator('select').first();
      if (await langSelect.isVisible().catch(() => false)) {
        const options = await langSelect.locator('option').allTextContents();
        findings.push(`lang_options:${options.join('|')}`);
        // After RPC fix: restricted list should be the 6 allowed languages (not all ~19)
        const normalized = options.map((o) => o.trim().toLowerCase());
        if (normalized.length <= 8) {
          findings.push(`lang_restricted:ok:${normalized.length}`);
        } else {
          findings.push(`lang_restricted:fail:${normalized.length}`);
        }
        for (const lang of ['javascript', 'typescript', 'python', 'sql', 'go', 'java']) {
          const has = options.some((o) => o.toLowerCase().includes(lang === 'javascript' ? 'javascript' : lang));
          if (!has) continue;
          try {
            await langSelect.selectOption({ value: lang });
            findings.push(`lang_switch:${lang}`);
            await page.waitForTimeout(250);
          } catch {
            /* ignore */
          }
        }
        // SQL schema toggle when schema present
        await langSelect.selectOption({ value: 'sql' }).catch(() => {});
        const schemaBtn = page.getByRole('button', { name: /view schema|hide schema/i }).first();
        if (await schemaBtn.isVisible().catch(() => false)) {
          await schemaBtn.click();
          findings.push('sql_schema_toggle:ok');
        }
      } else {
        findings.push('lang_select:missing');
      }

      // Type a simple solution into monaco or fallback textarea
      const monaco = page.locator('.monaco-editor textarea').first();
      if (await monaco.count()) {
        await monaco.click({ force: true });
        await page.keyboard.press('Meta+A').catch(() => {});
        await page.keyboard.type('def solution():\n    return 42\n');
        findings.push('coding_editor:monaco');
      } else if (await descriptive.isVisible().catch(() => false)) {
        await descriptive.fill('def solution():\n    return 42\n');
        findings.push('coding_editor:textarea_fallback');
      }
    } else if (await page.locator('[role="radio"]').count() > 0 || await page.locator('input[type="radio"]').count() > 0) {
      findings.push(`q${i + 1}:mcq`);
      const radio = page.locator('input[type="radio"]').first();
      if (await radio.count()) {
        await radio.check({ force: true }).catch(async () => {
          await page.locator('label').nth(0).click();
        });
      } else {
        await page.getByRole('radio').first().click();
      }
    } else if (await descriptive.isVisible().catch(() => false)) {
      findings.push(`q${i + 1}:text`);
      await descriptive.fill(
        'This is a structured answer covering tradeoffs, edge cases, and a concrete example from production systems.'
      );
    } else {
      findings.push(`q${i + 1}:unknown_ui`);
      // Best-effort click first option-like control
      const option = page.locator('[class*="option"], button').filter({ hasText: /.+/ }).nth(1);
      if (await option.isVisible().catch(() => false)) await option.click().catch(() => {});
    }

    // Next / continue
    const next = page.getByRole('button', { name: /next|continue|save & next/i }).first();
    if (await next.isVisible().catch(() => false) && await next.isEnabled().catch(() => false)) {
      await next.click();
    }
  }

  // Submit (button may already be the last-question submit)
  const submit = page.getByRole('button', { name: /submit interview|submit|finish|complete interview/i }).first();
  await expect(submit).toBeVisible({ timeout: 20_000 });
  if (await submit.isEnabled()) {
    await submit.click();
  }

  // Optional confirm dialog — ignore if already navigating
  const confirm = page.getByRole('button', { name: /^(confirm|yes|submit)$/i }).last();
  if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await confirm.isEnabled().catch(() => false)) {
      await confirm.click({ timeout: 5_000 }).catch(() => {});
    }
  }

  await expect(
    page.getByText(/interview completed|thank you|submitted|evaluation/i).first()
  ).toBeVisible({ timeout: 60_000 });
  findings.push('submit:ok');

  // Capture coding language select if still on page (usually navigated away)
  console.log('MINI_CORE_FINDINGS', JSON.stringify(findings));
  expect(findings.some((f) => f.startsWith('questions_loaded'))).toBeTruthy();
  expect(findings).toContain('submit:ok');
});
