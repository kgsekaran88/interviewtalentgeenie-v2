# Quick Test Execution Guide

## Table of Contents
1. [Running Tests Manually](#running-tests-manually)
2. [Running Tests via UI](#running-tests-via-ui)
3. [Running Tests via API](#running-tests-via-api)
4. [AI Configuration Specific Tests](#ai-configuration-specific-tests)
5. [Interpreting Results](#interpreting-results)
6. [Common Test Commands](#common-test-commands)

---

## Running Tests Manually

### 1. Comprehensive Test Suite

Navigate to test documentation and follow step-by-step:
```bash
# Open test documentation
docs/comprehensive-test-cases.md
```

**Example: Testing AI Configuration (TC-AI-CFG-001)**
1. Open browser to `/admin/ai-configuration`
2. Open Network DevTools (F12 → Network tab)
3. Navigate to "Health Monitoring" tab
4. Click any AI feature dropdown
5. Verify models are NOT hardcoded:
   - Check network request to `/rest/v1/ai_providers`
   - Verify models come from database response
6. ✅ PASS if dropdown matches database query results

### 2. Proctoring Flow Tests

```bash
# Open proctoring test documentation
docs/proctoring-flow-tests.md
```

**Example: Testing Camera Setup (PROC-E2E-001)**
1. Navigate to `/take-interview/:id` (as candidate)
2. Click "Start Interview"
3. Grant camera permissions
4. Verify camera preview shows video
5. Check console for face detection logs
6. ✅ PASS if all pre-checks complete

---

## Running Tests via UI

### Access Test Management Dashboard

1. **Login as Platform Admin**
   ```
   Navigate to: /admin/test-management
   ```

2. **Select Test Suite**
   - Click on desired test suite card
   - Options: Security, Functionality, Performance, Integration, AI Configuration

3. **Run Tests**
   ```
   Click "Run Tests" button → Wait for execution → View results
   ```

4. **View Detailed Results**
   - Click on any test run row
   - Expand individual test cases
   - Check error messages and fix suggestions

### Test Management UI Features

```typescript
// Available actions in UI
- Run full test suite
- View test history
- Download reports (PDF/CSV)
- Configure test parameters
- Clean up test data
- Schedule automated runs
```

---

## Running Tests via API

### Prerequisites
```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_KEY="your-service-role-key"
```

### 1. Run Complete Test Suite

```bash
curl -X POST "$SUPABASE_URL/functions/v1/run-tests" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "suiteId": "comprehensive-suite-id",
    "category": "all"
  }'
```

**Response:**
```json
{
  "success": true,
  "run_id": "uuid-here",
  "summary": "Completed 75 tests: 72 passed, 2 failed, 1 warning",
  "total_tests": 75,
  "passed_tests": 72,
  "failed_tests": 2,
  "warnings": 1,
  "execution_time_ms": 45000
}
```

### 2. Run Specific Category

```bash
# Security tests only
curl -X POST "$SUPABASE_URL/functions/v1/run-tests" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "suiteId": "security-suite-id",
    "category": "security"
  }'
```

### 3. Run Flow Tests

```bash
# Comprehensive flow test
curl -X POST "$SUPABASE_URL/functions/v1/run-comprehensive-flow-test" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "flowId": "interview-creation-flow",
    "template": "medium"
  }'
```

---

## AI Configuration Specific Tests

### Quick Smoke Test

Run these 5 tests to verify AI configuration is working:

#### 1. Test Dynamic Model Loading
```sql
-- In database console
SELECT DISTINCT jsonb_array_elements_text(supported_models) as model
FROM ai_providers
WHERE is_active = true
ORDER BY model;
```
Then check UI dropdown matches this query result.

#### 2. Test Feature Scanning
```bash
# Via API
curl -X POST "$SUPABASE_URL/functions/v1/scan-ai-features" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "total_count": 14,
  "new_configs_created": 0,
  "features": [/* array of features */]
}
```

#### 3. Test Model Update
```bash
curl -X POST "$SUPABASE_URL/functions/v1/update-ai-feature-model" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "feature_id": "generate-questions",
    "model": "google/gemini-2.5-pro"
  }'
```

#### 4. Test Feature Toggle
```sql
-- Disable feature
UPDATE ai_feature_health 
SET is_enabled = false 
WHERE feature_id = 'test-feature';

-- Try using the feature (should skip)

-- Re-enable
UPDATE ai_feature_health 
SET is_enabled = true 
WHERE feature_id = 'test-feature';
```

#### 5. Test Health Monitoring
```sql
-- Check health status updates
SELECT 
  feature_name,
  status,
  total_requests,
  successful_requests,
  last_success_at
FROM ai_feature_health
ORDER BY last_success_at DESC NULLS LAST
LIMIT 10;
```

---

## Interpreting Results

### Test Status Meanings

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| ✅ **Passed** | Test succeeded | None |
| ❌ **Failed** | Test failed | Review error, apply fix |
| ⚠️ **Warning** | Test passed with warnings | Monitor, may need attention |
| ⏭️ **Skipped** | Test not applicable | None |
| 🔄 **Running** | Test in progress | Wait |

### Reading Test Reports

```json
{
  "test_name": "TC-AI-CFG-001",
  "status": "failed",
  "error_message": "Expected 15 models, found 10",
  "fix_recommendation": "Verify all AI providers are active in database",
  "execution_time_ms": 234,
  "severity": "high"
}
```

**What to check:**
1. **error_message**: What went wrong
2. **fix_recommendation**: How to fix it
3. **severity**: Priority level (critical, high, medium, low)

---

## Common Test Commands

### Database Validation Queries

```sql
-- 1. Check AI providers
SELECT name, is_active, jsonb_array_length(supported_models) as model_count
FROM ai_providers;

-- 2. Check feature configurations
SELECT feature_name, is_enabled, primary_provider_id, fallback_enabled
FROM ai_feature_configurations;

-- 3. Check feature health
SELECT feature_name, status, total_requests, successful_requests, failed_requests
FROM ai_feature_health;

-- 4. Check for duplicate configurations
SELECT feature_name, COUNT(*)
FROM ai_feature_configurations
GROUP BY feature_name
HAVING COUNT(*) > 1;

-- 5. Check recent AI usage
SELECT 
  feature_name,
  model_used,
  success,
  fallback_used,
  created_at
FROM ai_usage_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Edge Function Testing

```bash
# Test question generation with AI
curl -X POST "$SUPABASE_URL/functions/v1/generate-questions" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Senior React Developer",
    "difficulty": "medium",
    "question_count": 5
  }'

# Test resume parsing
curl -X POST "$SUPABASE_URL/functions/v1/parse-resume" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_url": "https://example.com/resume.pdf"
  }'

# Test chatbot
curl -X POST "$SUPABASE_URL/functions/v1/chatbot-assist" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create an interview?",
    "role": "hr_recruiter"
  }'
```

### Browser Console Tests

```javascript
// In browser console on AI Configuration page

// 1. Check if models are loaded dynamically
console.log('Available models:', availableModels);
// Should show array from database, not hardcoded

// 2. Check health data
console.log('Health data:', healthData);
// Should show real-time status from database

// 3. Trigger scan manually
const scan = await fetch('/functions/v1/scan-ai-features', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: '{}'
});
console.log(await scan.json());
```

---

## Test Data Setup

### Create Test Organizations
```sql
INSERT INTO organizations (name, tier, status)
VALUES 
  ('Test Org Alpha', 'starter', 'active'),
  ('Test Org Beta', 'growth', 'active'),
  ('Test Org Gamma', 'enterprise', 'active');
```

### Create Test Users
```sql
-- Platform Admin
INSERT INTO user_roles (user_id, role)
VALUES ('platform-admin-uuid', 'platform_admin');

-- HR Recruiter
INSERT INTO user_roles (user_id, role)
VALUES ('hr-recruiter-uuid', 'hr_recruiter');

-- Candidate
INSERT INTO user_roles (user_id, role)
VALUES ('candidate-uuid', 'candidate');
```

### Create Test Interviews
```sql
INSERT INTO interviews (
  id,
  title,
  job_description,
  difficulty,
  question_count,
  time_limit,
  status,
  creator_id,
  organization_id
) VALUES (
  gen_random_uuid(),
  'Test Interview - React Developer',
  'Testing role for automated tests',
  'medium',
  10,
  60,
  'active',
  'hr-recruiter-uuid',
  'test-org-uuid'
);
```

---

## Cleanup After Tests

### Remove Test Data
```sql
-- Clean up test interviews
DELETE FROM interviews WHERE title LIKE 'Test Interview%';

-- Clean up test attempts
DELETE FROM interview_attempts WHERE candidate_email LIKE 'test@%';

-- Clean up test organizations
DELETE FROM organizations WHERE name LIKE 'Test Org%';

-- Clean up test AI configurations (if needed)
DELETE FROM ai_feature_configurations WHERE feature_name LIKE 'test_%';

-- Clean up test health records
DELETE FROM ai_feature_health WHERE feature_id LIKE 'test-%';
```

### Automated Cleanup
```bash
# Via edge function
curl -X POST "$SUPABASE_URL/functions/v1/cleanup-test-data" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "older_than_days": 1,
    "dry_run": false
  }'
```

---

## Continuous Integration Setup

### GitHub Actions Example
```yaml
name: Run E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run AI Configuration Tests
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/run-tests" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"suiteId": "ai-config-suite", "category": "all"}'
      
      - name: Run Integration Tests
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/run-flow-tests" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"flowId": "interview-flow", "template": "small"}'
```

---

## Troubleshooting Test Failures

### Common Issues

#### 1. "Models not loading in dropdown"
**Cause**: Database connection issue or empty `ai_providers` table  
**Fix**:
```sql
-- Check providers exist
SELECT * FROM ai_providers WHERE is_active = true;
-- If empty, run migration to seed providers
```

#### 2. "Scan creates duplicate configurations"
**Cause**: Missing unique constraint or logic error  
**Fix**:
```sql
-- Remove duplicates manually
DELETE FROM ai_feature_configurations a
USING ai_feature_configurations b
WHERE a.id > b.id AND a.feature_name = b.feature_name;

-- Add unique constraint
ALTER TABLE ai_feature_configurations
ADD CONSTRAINT unique_feature_name UNIQUE (feature_name);
```

#### 3. "Feature toggle doesn't work"
**Cause**: Edge function not checking `is_enabled` flag  
**Fix**: Update edge function to check configuration:
```typescript
const config = await getAIConfig(featureName);
if (!config?.is_enabled) {
  return { error: 'Feature is disabled', skipped: true };
}
```

#### 4. "Health status not updating"
**Cause**: No AI usage being logged  
**Fix**: Verify `logAIUsage()` is called in edge functions

---

## Test Metrics & Reporting

### Key Metrics to Track

- **Pass Rate**: (passed / total) × 100
- **Execution Time**: Total time for test suite
- **Flaky Tests**: Tests that fail intermittently
- **Coverage**: % of features tested

### Generate Test Report
```bash
# Via UI: Download PDF/CSV from Test Management page

# Via API: Get latest test run
curl "$SUPABASE_URL/rest/v1/test_runs?order=started_at.desc&limit=1" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

---

## Support

For test execution issues:
1. Check test documentation for detailed steps
2. Review database validation queries
3. Check edge function logs for errors
4. Verify test data exists and is valid
5. Consult `TEST_UPDATE_SUMMARY.md` for known issues

---

**Quick Reference** - Test Execution Guide v1.0
