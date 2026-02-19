import '@testing-library/jest-dom';

// Mock import.meta.env for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'http://localhost:8000',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
    VITE_SUPABASE_PROJECT_ID: 'test',
    MODE: 'test',
    DEV: true,
    PROD: false,
  },
});
