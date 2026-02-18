// Vitest config.
//
// NOTE: We intentionally export a plain object (instead of importing `defineConfig`
// from `vitest/config`) because Vitest is not installed as a local dependency in
// this project. Importing from `vitest/config` can fail in some runners.
//
// The repository also contains Playwright smoke tests under
// `public/deployment-package/` which must NOT be executed by Vitest. Without this
// config, Vitest can pick up `*.spec.ts` files outside `src/` and fail.
export default {
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.m{ts,tsx}"],
    exclude: ["public/**", "dist/**", "node_modules/**", "supabase/**"],
    passWithNoTests: true,
  },
};
