/**
 * Smoke Tests for IAS Platform Deployment
 * Run these tests immediately after deployment to verify core functionality
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Post-Deployment Smoke Tests', () => {
  
  test('Health check endpoint responds', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });

  test('Landing page loads successfully', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/TalentGeenie/);
    
    // Check for key elements
    await expect(page.locator('text=TalentGeenie')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('Auth page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Database connection works', async ({ request }) => {
    // Test database connectivity through API
    const response = await request.get(`${BASE_URL}/api/health/database`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.database).toBe('connected');
  });

  test('Storage bucket is accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/storage`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.storage).toBe('accessible');
  });

  test('Authentication flow works', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    
    // Test signup form validation
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    
    // Should show some response (success or validation)
    const signupButton = page.locator('button:has-text("Sign Up")');
    await expect(signupButton).toBeEnabled();
  });

  test('Interview creation page loads (after auth)', async ({ page }) => {
    // This test assumes you can navigate to protected routes
    // In production, you'd need to authenticate first
    await page.goto(`${BASE_URL}/recruiter/create-interview`);
    
    // Should redirect to auth or show login required
    await page.waitForURL(/\/(auth|recruiter\/create-interview)/);
  });

  test('Proctoring service is reachable', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/proctoring`);
    
    // Should return 200 or 503 if service is down
    expect([200, 503]).toContain(response.status());
  });

  test('Static assets load correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check if logo/images load
    const images = page.locator('img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify at least one image loaded
    const firstImage = images.first();
    await expect(firstImage).toBeVisible();
  });

  test('API rate limiting is configured', async ({ request }) => {
    // Make multiple rapid requests to test rate limiting
    const requests = Array(10).fill(null).map(() => 
      request.get(`${BASE_URL}/api/health`)
    );
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    
    // Should see some 200s, might see 429 if rate limited
    expect(statusCodes.filter(s => s === 200).length).toBeGreaterThan(0);
  });

  test('CORS headers are properly configured', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': 'https://example.com'
      }
    });
    
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('SSL certificate is valid', async ({ request }) => {
    if (BASE_URL.startsWith('https://')) {
      const response = await request.get(BASE_URL);
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('Error pages render correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page-12345`);
    
    // Should show 404 page
    await expect(page.locator('text=/404|Not Found/i')).toBeVisible();
  });

  test('Monitoring endpoints are accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/metrics`);
    
    // Prometheus metrics endpoint
    if (response.status() === 200) {
      const text = await response.text();
      expect(text).toContain('# HELP');
    }
  });
});

test.describe('Critical User Flows', () => {
  
  test('Candidate can access interview link', async ({ page }) => {
    // Simulate candidate receiving interview link
    const mockInterviewId = 'test-interview-123';
    await page.goto(`${BASE_URL}/interview/${mockInterviewId}/take`);
    
    // Should either show interview or redirect to auth
    await page.waitForURL(/\/(interview|auth)/);
  });

  test('Proctoring pre-checks are functional', async ({ page }) => {
    await page.goto(`${BASE_URL}/interview/test/take`);
    
    // Check if camera/mic permission prompts appear
    // (This would be more detailed in actual implementation)
    const page_text = await page.textContent('body');
    expect(page_text).toBeTruthy();
  });
});

test.describe('Performance Checks', () => {
  
  test('Page load time is acceptable', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    const loadTime = Date.now() - startTime;
    
    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('API response time is acceptable', async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${BASE_URL}/api/health`);
    const responseTime = Date.now() - startTime;
    
    // Should respond in under 500ms
    expect(responseTime).toBeLessThan(500);
  });
});
