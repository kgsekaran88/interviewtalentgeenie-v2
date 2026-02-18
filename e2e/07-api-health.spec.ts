/**
 * E2E Tests: API Health & Edge Functions
 * 
 * Tests the self-hosted Supabase API endpoints and edge functions.
 * Validates that the backend services are properly running.
 */
import { test, expect } from '@playwright/test';
import { API_URL, ANON_KEY, SERVICE_KEY } from './helpers';

test.describe('API & Backend Health', () => {

  test.describe('Supabase Core Services', () => {

    test('PostgREST API should be accessible', async ({ request }) => {
      const response = await request.get(`${API_URL}/rest/v1/`, {
        headers: { apikey: ANON_KEY },
      });
      expect(response.status()).toBe(200);
    });

    test('Auth API should be accessible', async ({ request }) => {
      const response = await request.get(`${API_URL}/auth/v1/settings`, {
        headers: { apikey: ANON_KEY },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('external');
    });

    test('Storage API should be accessible', async ({ request }) => {
      const response = await request.get(`${API_URL}/storage/v1/bucket`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      // 200 with list of buckets
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('should have storage buckets configured', async ({ request }) => {
      const response = await request.get(`${API_URL}/storage/v1/bucket`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      const buckets = await response.json();
      const bucketNames = buckets.map((b: any) => b.name);

      // Expected buckets from migration
      const expectedBuckets = ['certificates', 'consent-documents', 'documentation', 'proctoring-recordings'];
      for (const expected of expectedBuckets) {
        expect(bucketNames).toContain(expected);
      }
    });
  });

  test.describe('Database Tables', () => {

    test('subscription_plans should have seeded data', async ({ request }) => {
      const response = await request.get(`${API_URL}/rest/v1/subscription_plans?select=id,name&is_active=eq.true`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      expect(response.status()).toBe(200);
      const plans = await response.json();
      expect(plans.length).toBeGreaterThanOrEqual(5);

      const names = plans.map((p: any) => p.name);
      expect(names).toContain('Free Trial');
      expect(names).toContain('Enterprise');
    });

    test('email_templates should have seeded data', async ({ request }) => {
      const response = await request.get(`${API_URL}/rest/v1/email_templates?select=id,template_key&is_active=eq.true`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      expect(response.status()).toBe(200);
      const templates = await response.json();
      expect(templates.length).toBeGreaterThanOrEqual(20);
    });

    test('profiles table should have test users', async ({ request }) => {
      const response = await request.get(`${API_URL}/rest/v1/profiles?select=id,full_name,email&email=like.*talentgeenie.test`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      expect(response.status()).toBe(200);
      const profiles = await response.json();
      expect(profiles.length).toBeGreaterThanOrEqual(1);
    });

    test('organizations table should have test org', async ({ request }) => {
      const response = await request.get(`${API_URL}/rest/v1/organizations?select=id,name,status&name=eq.E2E Test Organization`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      expect(response.status()).toBe(200);
      const orgs = await response.json();
      expect(orgs.length).toBe(1);
      expect(orgs[0].status).toBe('active');
    });
  });

  test.describe('Edge Functions', () => {

    test('edge functions health endpoint should respond', async ({ request }) => {
      const response = await request.get(`${API_URL}/functions/v1/health`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });
      // Health might return various status codes — just not 502/503
      expect(response.status()).not.toBe(502);
      expect(response.status()).not.toBe(503);
    });

    test('chatbot-assist function should accept POST', async ({ request }) => {
      const response = await request.post(`${API_URL}/functions/v1/chatbot-assist`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { message: 'Hello', context: 'test' },
      });
      // Should not be 404 (routing works) — might be 400/401/500 depending on config
      expect(response.status()).not.toBe(404);
    });

    test('generate-questions function should accept POST', async ({ request }) => {
      const response = await request.post(`${API_URL}/functions/v1/generate-questions`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { topic: 'JavaScript', count: 1 },
      });
      expect(response.status()).not.toBe(404);
    });

    test('send-email function should accept POST', async ({ request }) => {
      const response = await request.post(`${API_URL}/functions/v1/send-email`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { to: 'test@example.com', template: 'test' },
      });
      expect(response.status()).not.toBe(404);
    });
  });

  test.describe('Authentication API', () => {

    test('should authenticate with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/v1/token?grant_type=password`, {
        headers: {
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
        },
        data: {
          email: 'e2e-admin@talentgeenie.test',
          password: 'TestAdmin123!@#',
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body.user.email).toBe('e2e-admin@talentgeenie.test');
    });

    test('should reject invalid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/v1/token?grant_type=password`, {
        headers: {
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
        },
        data: {
          email: 'e2e-admin@talentgeenie.test',
          password: 'WrongPassword',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('should list users via admin API', async ({ request }) => {
      const response = await request.get(`${API_URL}/auth/v1/admin/users`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.users.length).toBeGreaterThanOrEqual(1);
    });
  });
});
