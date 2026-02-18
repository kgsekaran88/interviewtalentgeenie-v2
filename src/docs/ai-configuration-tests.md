# AI Configuration System - End-to-End Test Documentation

## Overview

This document provides comprehensive end-to-end testing procedures for the dynamic AI Configuration system, covering model loading, feature scanning, provider management, and health monitoring.

---

## Test Environment Setup

### Prerequisites
- Active Lovable Cloud connection
- Platform admin user account
- Multiple AI providers configured in database
- Sample AI features in `ai_feature_health` table

### Database Prerequisites
```sql
-- Verify AI providers exist
SELECT id, name, display_name, provider_type, supported_models, is_active
FROM ai_providers
WHERE is_active = true;

-- Verify AI features exist
SELECT feature_id, feature_name, edge_function, current_model, status
FROM ai_feature_health
LIMIT 10;

-- Verify configurations table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_feature_configurations';
```

---

## Test Suite 1: Dynamic Model Loading

### Test Case: AI-CFG-E2E-001 - Models Loaded from Database
**Objective**: Verify all models are dynamically loaded from `ai_providers` table  
**Priority**: Critical

**Steps**:
1. Navigate to `/admin/ai-configuration`
2. Click "Health Monitoring" tab
3. Select any AI feature
4. Open "Current Model" dropdown
5. Inspect dropdown options

**Expected Results**:
```javascript
// Models should come from database, not hardcoded
{
  availableModels: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "openai/gpt-5",
    "openai/gpt-5-mini",
    "claude-sonnet-4-5"
    // ... dynamically loaded from database
  ]
}
```

**Database Validation**:
```sql
-- Models in dropdown should match this query
SELECT DISTINCT jsonb_array_elements_text(supported_models) as model
FROM ai_providers
WHERE is_active = true
ORDER BY model;
```

**Pass Criteria**: 
- No hardcoded model arrays found in code
- Dropdown contains all models from database
- Adding new provider makes new models immediately available

---

### Test Case: AI-CFG-E2E-002 - Model Dropdown Population
**Objective**: Verify model dropdowns update when providers change  
**Priority**: High

**Steps**:
1. Query current models: `SELECT supported_models FROM ai_providers WHERE is_active = true`
2. Note count of unique models
3. Add new test provider:
```sql
INSERT INTO ai_providers (name, display_name, provider_type, base_url, supported_models, is_active)
VALUES (
  'test-provider-xyz',
  'Test Provider XYZ',
  'test',
  'https://test.api.xyz',
  '["test/new-model-1", "test/new-model-2"]'::jsonb,
  true
);
```
4. Refresh AI Configuration page
5. Check model dropdowns

**Expected Results**:
- New models `test/new-model-1` and `test/new-model-2` appear in dropdowns
- No code changes required
- Models appear across all relevant feature dropdowns

**Cleanup**:
```sql
DELETE FROM ai_providers WHERE name = 'test-provider-xyz';
```

---

## Test Suite 2: Feature Scanning

### Test Case: AI-CFG-E2E-003 - Dynamic Feature Discovery
**Objective**: Verify scan reads from database, not hardcoded list  
**Priority**: Critical

**Steps**:
1. Count features before scan:
```sql
SELECT COUNT(*) as feature_count FROM ai_feature_health;
```
2. Navigate to AI Configuration → AI Features tab
3. Click "Refresh" button
4. Observe response in Network tab

**Expected Network Response**:
```json
{
  "success": true,
  "total_count": 14,  // Should match database count
  "healthy_count": 0,
  "degraded_count": 0,
  "failed_count": 0,
  "new_configs_created": 0,
  "features": [
    {
      "id": "detect-bias",
      "name": "Bias Detection",
      "edge_function": "detect-bias",
      "model_used": "google/gemini-2.5-pro",
      "status": "unknown"
    }
    // ... dynamically from database
  ]
}
```

**Database Validation**:
```sql
-- Scan results should match this query
SELECT 
  feature_id as id,
  feature_name as name,
  edge_function,
  current_model as model_used,
  status
FROM ai_feature_health
ORDER BY feature_name;
```

**Pass Criteria**:
- `total_count` in response matches database count
- Features array length matches `total_count`
- No hardcoded feature list found in `scan-ai-features` function

---

### Test Case: AI-CFG-E2E-004 - Prevent Duplicate Configurations
**Objective**: Verify scan doesn't create duplicate configurations  
**Priority**: High

**Steps**:
1. Run initial scan, note `new_configs_created` count
2. Without changes, run scan again immediately
3. Check response and database

**Expected Results**:
```json
{
  "success": true,
  "new_configs_created": 0,  // No duplicates created
  "features": [/* same features */]
}
```

**Database Validation**:
```sql
-- Should have no duplicate configurations
SELECT feature_name, COUNT(*) as count
FROM ai_feature_configurations
GROUP BY feature_name
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

---

### Test Case: AI-CFG-E2E-005 - New Feature Auto-Configuration
**Objective**: Verify new features get auto-configured on scan  
**Priority**: High

**Steps**:
1. Insert new feature into health table:
```sql
INSERT INTO ai_feature_health (
  feature_id, 
  feature_name, 
  edge_function, 
  current_model,
  status
) VALUES (
  'test-auto-feature',
  'Test Auto Feature',
  'test-auto-function',
  'google/gemini-2.5-flash',
  'unknown'
);
```
2. Run scan via UI
3. Check `ai_feature_configurations` table

**Expected Database State**:
```sql
SELECT * FROM ai_feature_configurations 
WHERE feature_name = 'test_auto_feature';
-- Should return 1 row with:
-- - is_enabled: true
-- - fallback_enabled: true
-- - retry_attempts: 3
-- - timeout_seconds: 30
```

**Cleanup**:
```sql
DELETE FROM ai_feature_health WHERE feature_id = 'test-auto-feature';
DELETE FROM ai_feature_configurations WHERE feature_name = 'test_auto_feature';
```

---

## Test Suite 3: Health Monitoring

### Test Case: AI-CFG-E2E-006 - Real-time Status Updates
**Objective**: Verify health status reflects actual usage  
**Priority**: High

**Steps**:
1. Navigate to Health Monitoring tab
2. Note current status of "Question Generation" feature
3. Trigger question generation via platform:
   - Go to Create Interview
   - Generate questions for a role
4. Return to Health Monitoring
5. Refresh page or wait for auto-refresh

**Expected Results**:
- `total_requests` increments
- `successful_requests` increments (if successful)
- `last_success_at` timestamp updates
- `average_latency_ms` calculated
- Status remains `healthy` or changes to `degraded`/`failed` based on errors

**Database Validation**:
```sql
SELECT 
  feature_name,
  status,
  total_requests,
  successful_requests,
  failed_requests,
  last_success_at
FROM ai_feature_health
WHERE feature_id = 'generate-questions';
```

---

### Test Case: AI-CFG-E2E-007 - Feature Toggle Functionality
**Objective**: Verify enabling/disabling features works correctly  
**Priority**: Critical

**Steps**:
1. Select "Resume Parsing" feature
2. Toggle switch to OFF (disabled)
3. Attempt to use resume parsing:
   - Upload resume in interview creation
   - Expect parsing to skip
4. Check logs for skip message
5. Toggle back to ON
6. Retry resume parsing

**Expected When Disabled**:
```javascript
// Edge function should detect feature disabled
{
  featureEnabled: false,
  message: "Resume parsing is currently disabled",
  fallbackBehavior: "manual_entry"
}
```

**Database Checks**:
```sql
-- After disabling
SELECT is_enabled FROM ai_feature_health WHERE feature_id = 'parse-resume';
-- Should return: false

-- After re-enabling
SELECT is_enabled FROM ai_feature_health WHERE feature_id = 'parse-resume';
-- Should return: true
```

---

## Test Suite 4: Model Configuration

### Test Case: AI-CFG-E2E-008 - Primary Model Update
**Objective**: Verify model changes persist and apply  
**Priority**: Critical

**Steps**:
1. Navigate to Health Monitoring
2. Select "Chatbot Assistant" feature
3. Change model from `google/gemini-2.5-flash` to `google/gemini-2.5-pro`
4. Save changes
5. Verify toast notification
6. Trigger chatbot functionality

**Expected Results**:
- Database updated immediately:
```sql
SELECT current_model, updated_at 
FROM ai_feature_health 
WHERE feature_id = 'chatbot-assist';
-- Should show: google/gemini-2.5-pro with recent timestamp
```
- Edge function uses new model on next invocation
- No deployment required for change to take effect

---

### Test Case: AI-CFG-E2E-009 - Fallback Model Configuration
**Objective**: Verify fallback model activation on primary failure  
**Priority**: High

**Steps**:
1. Configure feature with fallback:
   - Primary: `openai/gpt-5`
   - Fallback: `google/gemini-2.5-flash`
   - Fallback enabled: YES
2. Simulate primary model failure:
   - Temporarily disable OpenAI provider OR
   - Use invalid API key for OpenAI
3. Trigger AI feature
4. Check logs and usage records

**Expected Behavior**:
```json
{
  "primary_model_attempted": "openai/gpt-5",
  "primary_model_status": "failed",
  "fallback_triggered": true,
  "fallback_model_used": "google/gemini-2.5-flash",
  "fallback_status": "success"
}
```

**Database Validation**:
```sql
-- Check ai_usage_logs
SELECT 
  feature_name,
  model_used,
  fallback_used,
  success
FROM ai_usage_logs
WHERE feature_name = '<tested-feature>'
ORDER BY created_at DESC
LIMIT 1;
-- Should show: fallback_used = true
```

---

### Test Case: AI-CFG-E2E-010 - A/B Testing Configuration
**Objective**: Verify A/B testing distributes between models  
**Priority**: Medium

**Steps**:
1. Enable A/B testing for feature:
   - Primary model: `google/gemini-2.5-flash`
   - A/B test model: `google/gemini-2.5-pro`
   - Split: 50/50
2. Trigger feature 20 times
3. Analyze distribution

**Expected Results**:
```sql
-- Check distribution in ai_model_performance
SELECT 
  model_name,
  COUNT(*) as request_count,
  AVG(average_latency_ms) as avg_latency
FROM ai_model_performance
WHERE feature_id = '<tested-feature>'
  AND is_active_test = true
GROUP BY model_name;
-- Should show roughly equal distribution
```

---

## Test Suite 5: API Key Management

### Test Case: AI-CFG-E2E-011 - Add & Test Provider Credentials
**Objective**: Verify API key addition and testing workflow  
**Priority**: High

**Steps**:
1. Navigate to API Keys tab
2. Click "Add API Key"
3. Select provider (e.g., "OpenAI")
4. Enter test API key
5. Set model preference
6. Click "Test Connection"

**Expected Results**:
- Test connection calls `test-ai-connection` edge function
- Success shows green badge with timestamp
- Failure shows error message
- API key stored encrypted in database:
```sql
SELECT 
  provider_id,
  is_active,
  test_status,
  last_tested_at
FROM ai_provider_credentials
WHERE provider_id = '<openai-provider-id>';
-- API key should be encrypted, not plaintext
```

---

### Test Case: AI-CFG-E2E-012 - Delete API Credentials
**Objective**: Verify credential deletion workflow  
**Priority**: Medium

**Steps**:
1. View existing credentials in API Keys tab
2. Click delete icon on test credential
3. Confirm deletion
4. Verify features using that provider fallback correctly

**Expected Results**:
- Credential removed from `ai_provider_credentials`
- Features revert to default provider (Lovable AI Gateway)
- No errors when features execute
- Toast notification shows deletion success

---

## Test Suite 6: Performance & Scale

### Test Case: AI-CFG-E2E-013 - Scan with 50+ Features
**Objective**: Verify scan performance with large dataset  
**Priority**: Medium

**Setup**: Populate `ai_feature_health` with 50 features

**Steps**:
1. Time the scan execution
2. Monitor database query performance
3. Check for timeout errors

**Expected Performance**:
- Scan completes in < 5 seconds
- Database queries optimized (use indexes)
- No duplicate inserts attempted
- Memory usage stable

**Performance SQL**:
```sql
-- Check scan performance
EXPLAIN ANALYZE
SELECT * FROM ai_feature_health ORDER BY feature_name;
```

---

### Test Case: AI-CFG-E2E-014 - Concurrent Configuration Updates
**Objective**: Verify thread-safety of configuration updates  
**Priority**: Low

**Steps**:
1. Open AI Configuration in two browser tabs
2. Simultaneously update different features from each tab
3. Verify both updates succeed without conflicts

**Expected Results**:
- Both updates persist correctly
- No race conditions or lost updates
- Database constraints prevent conflicts
- Last update wins with proper timestamps

---

## Test Suite 7: Integration

### Test Case: AI-CFG-E2E-015 - Edge Function Integration
**Objective**: Verify edge functions use updated configurations  
**Priority**: Critical

**Steps**:
1. Update configuration for `generate-questions`:
   - Change model to `google/gemini-2.5-pro`
   - Enable fallback
   - Set retry attempts to 5
2. Call `generate-questions` edge function
3. Monitor logs

**Expected Edge Function Behavior**:
```typescript
// Function should:
// 1. Read configuration from database
// 2. Use configured primary model
// 3. Respect retry settings
// 4. Log to ai_usage_logs
```

**Validation**:
```sql
-- Check usage log matches configuration
SELECT 
  feature_name,
  model_used,
  success,
  latency_ms
FROM ai_usage_logs
WHERE feature_name = 'generate_questions'
ORDER BY created_at DESC
LIMIT 1;
-- model_used should match configured model
```

---

## Test Suite 8: Error Handling

### Test Case: AI-CFG-E2E-016 - Handle Missing Provider Gracefully
**Objective**: Verify system handles missing/disabled providers  
**Priority**: High

**Steps**:
1. Configure feature to use specific provider
2. Disable that provider in database:
```sql
UPDATE ai_providers 
SET is_active = false 
WHERE name = 'openai';
```
3. Trigger the configured feature
4. Observe behavior

**Expected Results**:
- Feature falls back to default provider
- Error logged but doesn't crash
- User sees graceful error message
- System continues operating

---

## Automation Scripts

### Automated Test Runner
```bash
#!/bin/bash
# Run comprehensive AI configuration tests

echo "Starting AI Configuration E2E Tests..."

# Test 1: Verify dynamic model loading
curl -X GET http://localhost:54321/rest/v1/ai_providers?select=supported_models&is_active=eq.true

# Test 2: Run feature scan
curl -X POST http://localhost:54321/functions/v1/scan-ai-features \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{}'

# Test 3: Update feature configuration
curl -X POST http://localhost:54321/functions/v1/update-ai-feature-model \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -d '{"feature_id": "generate-questions", "model": "google/gemini-2.5-pro"}'

echo "Tests completed. Check logs for results."
```

---

## Regression Checklist

Before releasing AI configuration changes:

- [ ] All models load from database (TC-001)
- [ ] Feature scan is dynamic (TC-003)
- [ ] No duplicate configurations created (TC-004)
- [ ] Health monitoring updates correctly (TC-006)
- [ ] Feature enable/disable works (TC-007)
- [ ] Model changes apply immediately (TC-008)
- [ ] Fallback models trigger correctly (TC-009)
- [ ] API key management functional (TC-011)
- [ ] Edge functions use updated configs (TC-015)
- [ ] Error handling graceful (TC-016)

---

## Known Issues & Workarounds

### Issue: Models not updating in dropdown
**Workaround**: Hard refresh page (Ctrl+Shift+R)

### Issue: Scan shows stale data
**Workaround**: Clear browser cache or use incognito mode

---

**Document End** - AI Configuration Test Suite v1.0
