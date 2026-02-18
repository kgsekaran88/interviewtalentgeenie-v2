import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for InterviewTalentGeenie
 * 
 * Self-hosted stack:
 *   Frontend:  http://localhost:5174  (Vite dev server)
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
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
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
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
