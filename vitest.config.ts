import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['public/**', 'dist/**', 'node_modules/**', 'supabase/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/lib/emailValidator.ts',
        'src/lib/hiringDecisionUtils.ts',
        'src/lib/validations.ts',
        'src/lib/roleBasedDefaults.ts',
        'src/lib/permissions.ts',
      ],
      exclude: [
        'src/lib/__tests__/**',
        'src/lib/designTokens.ts',
        'src/lib/migrationPlanPdfExport.ts',
      ],
      thresholds: {
        // Applied only to files that are actually tested (see include above).
        // These numbers reflect current coverage and will be raised incrementally.
        lines: 30,
        functions: 30,
        branches: 20,
        statements: 30,
      },
    },
  },
});
