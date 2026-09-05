/**
 * Proctored mini core path: camera/screen mocks → checks → take → submit → finalize.
 *
 * Run: MINI_SHARE_LINK=... npx playwright test e2e/manual-mini-proctor-path.spec.ts --reporter=line
 */
import { test, expect } from '@playwright/test';

const SHARE = process.env.MINI_SHARE_LINK || '';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8084';

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
    ],
  },
});

test('mini proctor: checks + take + submit/finalize', async ({ page, context }) => {
  test.skip(!SHARE, 'Set MINI_SHARE_LINK');

  const findings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') findings.push(`console.error: ${msg.text().slice(0, 180)}`);
  });

  // Fake camera/mic + entire-screen share for headless Chromium
  await page.addInitScript(() => {
    const makeStream = (withAudio: boolean, displaySurface?: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      // Bright frame so lighting check can pass
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(320, 200, 80, 0, Math.PI * 2);
      ctx.fill();
      const stream = canvas.captureStream(15);
      if (withAudio) {
        const ctxAudio = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = ctxAudio.createMediaStreamDestination();
        const osc = ctxAudio.createOscillator();
        osc.frequency.value = 440;
        osc.connect(dest);
        osc.start();
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      if (displaySurface) {
        const track = stream.getVideoTracks()[0];
        const orig = track.getSettings.bind(track);
        track.getSettings = () => ({ ...orig(), displaySurface, width: 1280, height: 720 });
      }
      return stream;
    };

    const gum = async (constraints: MediaStreamConstraints) => {
      const wantAudio = !!(constraints as any)?.audio;
      return makeStream(wantAudio);
    };
    const gdm = async () => makeStream(false, 'monitor');

    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: gum });
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: gdm });

    // Fullscreen may be blocked in automation — no-op success
    Document.prototype.requestFullscreen = async function () {
      return;
    } as any;
  });

  await context.grantPermissions(['camera', 'microphone']);

  // Soften recording upload validation in automation — MediaRecorder+signed URL path is flaky headless
  await page.route('**/functions/v1/get-chunk-upload-url', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        signedUrl: 'https://example.com/fake-upload',
        path: 'proctoring-recordings/fake/chunk-0.webm',
        token: 'fake',
      }),
    });
  });
  await page.route('https://example.com/fake-upload**', async (route) => {
    await route.fulfill({ status: 200, body: 'ok' });
  });
  // Also allow PUT to any storage signed URL style
  await page.route('**/storage/v1/object/**', async (route) => {
    if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
      await route.fulfill({ status: 200, body: '{}' });
      return;
    }
    await route.continue();
  });

  await page.goto(`${BASE}/take-interview/${SHARE}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(/Mini Proctoring Path Test|proctor/i).first()).toBeVisible({ timeout: 20_000 });
  await page.locator('#name').fill('Proctor Candidate');
  await page.locator('#email').fill(`proctor-${Date.now()}@talentgeenie.test`);
  await page.getByRole('button', { name: /start interview/i }).click();
  findings.push('start_form:ok');

  // Intro
  await expect(page.getByRole('button', { name: /i understand, continue/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /i understand, continue/i }).click();

  // Consents (4 required)
  for (const id of ['#proctoring-consent', '#recording-consent', '#data-consent', '#ai-analysis-consent']) {
    await page.locator(id).click();
  }
  await page.getByRole('button', { name: /accept & continue|continue to setup/i }).click();
  findings.push('consent:ok');

  // Checks running → All Checks Passed
  await expect(page.getByRole('button', { name: /all checks passed/i })).toBeVisible({ timeout: 90_000 });
  findings.push('checks:passed');
  await page.getByRole('button', { name: /all checks passed/i }).click();

  // Ready → Start Assessment / Start Interview
  const startAssess = page.getByRole('button', { name: /start (assessment|interview)/i }).last();
  await expect(startAssess).toBeVisible({ timeout: 20_000 });
  await startAssess.click();
  findings.push('screen_share_start:ok');

  // Recording validation can take a bit; then 3s countdown
  const failToast = page.getByText(/recording test failed|unable to start|entire screen required|screen sharing required/i);
  const questionsReady = page.getByText(/question \d+ of|multiple choice|coding challenge|descriptive|scenario-based/i);
  const countdown = page.getByText(/starting in|get ready|3|2|1/i);

  await Promise.race([
    questionsReady.first().waitFor({ state: 'visible', timeout: 90_000 }),
    failToast.first().waitFor({ state: 'visible', timeout: 90_000 }),
    page.waitForTimeout(90_000),
  ]);

  if (await failToast.isVisible().catch(() => false)) {
    const msg = await failToast.first().innerText().catch(() => 'unknown');
    findings.push(`start_failed:${msg.slice(0, 120)}`);
    console.log('MINI_PROCTOR_FINDINGS', JSON.stringify(findings));
    throw new Error(`Proctor start failed: ${msg}`);
  }

  await expect(questionsReady.first()).toBeVisible({ timeout: 30_000 });
  findings.push('questions_loaded:ok');

  // Answer up to 5 quickly
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(600);
    const qLabel = await page.getByText(/question \d+ of/i).first().innerText().catch(() => `idx${i}`);
    findings.push(`at:${qLabel}`);

    const isCoding = (await page.locator('.monaco-editor').count()) > 0
      || (await page.getByText(/coding challenge/i).count()) > 0;
    if (isCoding) {
      const monaco = page.locator('.monaco-editor textarea.inputarea').first();
      if (await monaco.count()) {
        await monaco.click({ force: true });
        await page.keyboard.type('SELECT 1 as score;');
      }
      findings.push(`q${i + 1}:coding`);
    } else if (await page.locator('[role="radio"]').count()) {
      await page.locator('[role="radio"]').first().click({ force: true });
      findings.push(`q${i + 1}:mcq`);
    } else if (await page.locator('label').filter({ hasText: /^A\./ }).count()) {
      await page.locator('label').filter({ hasText: /^A\./ }).first().click();
      findings.push(`q${i + 1}:mcq_label`);
    } else if (await page.locator('#answer').isVisible().catch(() => false)) {
      await page.locator('#answer').fill('Proctored descriptive answer with enough detail for evaluation.');
      findings.push(`q${i + 1}:text`);
    } else {
      findings.push(`q${i + 1}:skip`);
    }

    const submitBtn = page.getByRole('button', { name: /submit interview/i });
    if (await submitBtn.isVisible().catch(() => false)) {
      findings.push('saw_submit');
      break;
    }
    const next = page.getByRole('button', { name: /next question|^next$/i }).first();
    if (await next.isVisible().catch(() => false) && await next.isEnabled().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(400);
    } else {
      findings.push(`no_next_at_${i}`);
      break;
    }
  }

  const submit = page.getByRole('button', { name: /submit interview/i }).first();
  await expect(submit).toBeVisible({ timeout: 20_000 });
  await submit.click();
  const confirm = page.getByRole('button', { name: /^(confirm|yes|submit)$/i }).last();
  if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false) && await confirm.isEnabled().catch(() => false)) {
    await confirm.click({ timeout: 5_000 }).catch(() => {});
  }

  // Completion or upload progress then complete
  await expect(
    page.getByText(/interview completed|thank you|submitted|upload|finaliz/i).first()
  ).toBeVisible({ timeout: 120_000 });
  findings.push('submit_or_upload:ok');

  // Prefer completed state
  const completed = await page.getByText(/interview completed/i).isVisible().catch(() => false);
  if (completed) findings.push('completed:ok');

  console.log('MINI_PROCTOR_FINDINGS', JSON.stringify(findings));
  expect(findings).toContain('checks:passed');
  expect(findings).toContain('questions_loaded:ok');
  expect(findings.some((f) => f.startsWith('submit') || f === 'completed:ok')).toBeTruthy();
});
