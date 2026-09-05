import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for InterviewTalentGeenie
 * 
 * Self-hosted stack:
 *   Frontend:  http://localhost:8084  (Vite dev server)
 *   API:       http://localhost:8000  (Kong → Supabase services)
 *   Auth:      http://localhost:8000/auth/v1
 *   Studio:    http://localhost:3001
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // Run tests sequentially to avoid auth state conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                    // Single worker for deterministic execution
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 60_000,               // 60s per test (some pages load slowly)
  expect: {
    timeout: 15_000,             // 15s for assertions
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8084',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  // Deferred product surfaces (feature flags off / out of scope for launch hardening)
  testIgnore: [
    '**/05-learning-hub.spec.ts',
    '**/flow-05-training-plan-mgmt.spec.ts',
    '**/flow-06-learning-plan-user.spec.ts',
    '**/17-guest-deep.spec.ts',
    '**/flow-18-candidate-journey.spec.ts',
  ],
  // Global setup runs before all tests
  globalSetup: './e2e/global.setup.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start the frontend if not running
  webServer: {
    command: 'npx vite --host 0.0.0.0 --port 8084 --strictPort',
    url: 'http://localhost:8084',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
