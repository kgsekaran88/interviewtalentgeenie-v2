# Comprehensive Test Cases - TalentGeenie Platform

## Document Information
- **Version**: 3.0
- **Last Updated**: 2025-11-15
- **Status**: Active
- **Scope**: All platform flows and functionalities including dynamic AI configuration

---

## 1. Authentication & User Management Flow

### TC-AUTH-001: Staff Sign Up with Strong Password
**Priority**: Critical  
**Category**: Security  
**Steps**:
1. Navigate to /auth page
2. Click "Sign Up" tab
3. Enter valid email (test@example.com)
4. Enter strong password (Min8Ch@r!)
5. Click "Sign Up"

**Expected**: Account created, auto-confirmed, redirected to dashboard  
**Data Required**: None  
**Post-Conditions**: User record in auth.users, default role assigned

---

### TC-AUTH-002: Sign In with Valid Credentials
**Priority**: Critical  
**Category**: Functionality  
**Steps**:
1. Navigate to /auth
2. Enter registered email
3. Enter correct password
4. Click "Sign In"

**Expected**: JWT token issued, redirected based on role  
**Validation**: Check localStorage for auth token

---

### TC-AUTH-003: Prevent Weak Password Registration
**Priority**: High  
**Category**: Security  
**Steps**:
1. Attempt sign up with password "12345"
2. Attempt with "password"

**Expected**: Validation error, registration blocked  
**Security Note**: Must enforce 8+ chars, mixed case, numbers, symbols

---

## 2. Role-Based Access Control (RBAC) Flow

### TC-RBAC-001: Platform Admin Full Access
**Priority**: Critical  
**Category**: Authorization  
**Setup**: Sign in as platform_admin user  
**Tests**:
1. Access /platform-admin ✓
2. Access /partner-management ✓
3. Access /pricing-management ✓
4. Access /test-management ✓
5. Access /organization-management ✓

**Expected**: All pages accessible, no permission errors

---

### TC-RBAC-002: HR Recruiter Limited Access
**Priority**: High  
**Category**: Authorization  
**Setup**: Sign in as hr_recruiter user  
**Tests**:
1. Access /create-interview ✓
2. Access /proctoring-dashboard ✓
3. Access /platform-admin ✗ (403)
4. Access /pricing-management ✗ (403)

**Expected**: Role-appropriate access only

---

### TC-RBAC-003: Candidate Restricted Access
**Priority**: Critical  
**Category**: Security  
**Setup**: Sign in as candidate user  
**Tests**:
1. Access /my-applications ✓
2. Access /take-interview/:id (own) ✓
3. Access /take-interview/:other_id ✗
4. Access /create-interview ✗
5. View other candidate's data ✗

**Expected**: Data isolation enforced via RLS

---

## 3. Interview Creation & Management Flow

### TC-INT-001: Create Interview from Scratch
**Priority**: Critical  
**Category**: Core Functionality  
**Role**: HR Recruiter  
**Steps**:
1. Navigate to /create-interview
2. Enter job title: "Senior React Developer"
3. Select difficulty: "Medium"
4. Choose question types: MCQ (5), Coding (2), Descriptive (3)
5. Set duration: 60 minutes
6. Click "Generate Questions" (AI)

**Expected**: 
- Questions generated within 30s
- Question distribution correct
- Interview saved with status "draft"

**Post-Conditions**: 
- Record in interviews table
- Questions in interview_questions table
- Audit log entry created

---

### TC-INT-002: AI Question Generation Quality
**Priority**: High  
**Category**: AI Functionality  
**Data**: Job role "Python Backend Engineer", Difficulty "Hard"  
**Validation**:
1. Questions relevant to role ✓
2. Difficulty matches selection ✓
3. No duplicate questions ✓
4. Coding questions have test cases ✓
5. MCQs have 4 options with 1 correct ✓

**Expected**: Quality score > 85%

---

### TC-INT-003: Interview Sharing & Link Generation
**Priority**: High  
**Category**: Functionality  
**Steps**:
1. Create interview
2. Click "Share"
3. Generate unique link
4. Copy link

**Expected**: 
- Unique UUID in URL
- Link accessible without login (if public)
- Link tracks access attempts

**Security Check**: Link cannot access other interviews

---

## 4. Candidate Interview Taking Flow

### TC-CAND-001: Take Interview End-to-End
**Priority**: Critical  
**Category**: Core Flow  
**Steps**:
1. Candidate receives interview link
2. Opens link, sees pre-interview checks
3. Grants camera/mic permissions
4. Completes proctoring setup
5. Starts interview (timer begins)
6. Answers MCQ questions
7. Writes code in editor
8. Submits descriptive answers
9. Clicks "Submit Interview"

**Expected**:
- All answers saved
- Proctoring session recorded
- Status changes: not_started → in_progress → completed
- Evaluation triggered automatically

**Duration**: ~60 minutes  
**Validation Points**:
- Timer countdown accurate
- Auto-save every 30s
- No data loss on refresh

---

### TC-CAND-002: Interview Auto-Submit on Time Expiry
**Priority**: Critical  
**Category**: Business Logic  
**Steps**:
1. Start interview with 5-minute duration
2. Wait for timer to reach 00:00
3. Observe auto-submission

**Expected**:
- Interview submitted automatically
- All answered questions saved
- Candidate cannot re-access
- Status = "completed"

---

## 5. Proctoring & Integrity Monitoring Flow

### TC-PROC-001: Pre-Interview Checks
**Priority**: Critical  
**Category**: Proctoring Setup  
**Components**:
1. **Camera Check**: Detects face, adequate lighting
2. **Microphone Check**: Records 3s audio sample
3. **ID Verification**: Upload government ID (optional)
4. **Environment Scan**: 360° room scan

**Expected**: All checks pass before interview starts  
**Failure Handling**: Clear error messages, retry option

---

### TC-PROC-002: Real-Time Violation Detection
**Priority**: Critical  
**Category**: Integrity Monitoring  
**Violations Tracked**:
1. **Tab Switch**: Detect visibilitychange event
2. **Multiple Persons**: Face detection count > 1
3. **Look Away**: No face detected for >10s
4. **Audio Anomaly**: Background voices detected
5. **Copy Attempt**: Ctrl+C / Cmd+C during interview

**For Each Violation**:
- Log to proctoring_violations table
- Increment violation counter
- Capture video timestamp
- Update session integrity_score

**Thresholds**:
- Minor: 1-2 violations (Warning)
- Moderate: 3-5 violations (Review)
- Severe: 6+ violations (Flag)

---

### TC-PROC-003: Recording Upload & Storage
**Priority**: Critical  
**Category**: Security  
**Flow**:
1. Interview ends
2. Stop video recorder
3. Stop screen recorder
4. Upload via edge function `upload-proctoring-recording`
5. Verify recordings in storage bucket

**Security Requirements**:
- Upload via authenticated edge function ✓
- Direct storage access blocked ✓
- File type validation (video/webm) ✓
- Max size limits enforced ✓

**Validation SQL**:
```sql
SELECT video_recording_url, screen_recording_url, integrity_score
FROM proctoring_sessions
WHERE session_id = 'test_session_id';
```

**Expected**: Both URLs populated, integrity_score calculated

---

### TC-PROC-004: Integrity Score Calculation
**Priority**: High  
**Category**: Algorithm Validation  
**Formula**:
```
integrity_score = 100 - (
  (tab_switches * 5) +
  (multiple_persons * 15) +
  (look_away_count * 8) +
  (copy_attempts * 20)
)
```

**Test Cases**:
| Tab Switch | Multi-Person | Look Away | Copy | Expected Score |
|------------|--------------|-----------|------|----------------|
| 0 | 0 | 0 | 0 | 100 |
| 2 | 0 | 1 | 0 | 82 |
| 3 | 1 | 2 | 1 | 39 |
| 5 | 2 | 5 | 2 | -5 → 0 |

**Validation**: Score never negative, capped at 100

---

## 6. AI Evaluation Flow

### TC-EVAL-001: Auto-Evaluation Trigger
**Priority**: Critical  
**Category**: AI Automation  
**Trigger**: Interview status changes to "completed"  
**Steps**:
1. Candidate submits interview
2. Edge function `evaluate-interview` invoked
3. AI evaluates each answer
4. Scores calculated
5. Recommendations generated

**Expected**:
- Evaluation completes within 2 minutes
- Each answer has score and feedback
- Overall recommendation: Strongly Recommend | Recommend | Consider | Not Recommended

---

### TC-EVAL-002: MCQ Auto-Scoring
**Priority**: High  
**Category**: Evaluation Logic  
**Method**: Exact match with correct_answer field  
**Test Data**:
- Question: "What is React?"
- Options: [A, B, C, D]
- Correct: B
- Candidate Answer: B

**Expected**: 
- Score: 1.0 (100%)
- Feedback: "Correct"

**Edge Case**: Multiple correct answers (array comparison)

---

### TC-EVAL-003: Coding Question Evaluation with Test Cases
**Priority**: Critical  
**Category**: AI + Logic  
**Question**: "Write a function to reverse a string"  
**Test Cases**:
1. Input: "hello" → Expected: "olleh"
2. Input: "" → Expected: ""
3. Input: "a" → Expected: "a"

**Candidate Code**:
```javascript
function reverse(str) {
  return str.split('').reverse().join('');
}
```

**Evaluation**:
- Run against all test cases
- Check syntax errors
- Evaluate efficiency (AI)
- Assess code quality (AI)

**Expected Output**:
```json
{
  "score": 0.95,
  "test_cases_passed": 3,
  "test_cases_total": 3,
  "code_quality": "excellent",
  "feedback": "Correct implementation, efficient approach"
}
```

---

### TC-EVAL-004: Descriptive Answer AI Evaluation
**Priority**: High  
**Category**: AI NLP  
**Question**: "Explain the difference between REST and GraphQL"  
**Candidate Answer**: "REST uses fixed endpoints for each resource... GraphQL allows clients to request exactly what they need..."

**AI Evaluation Criteria**:
1. Relevance to question (0-25 points)
2. Technical accuracy (0-30 points)
3. Depth of explanation (0-25 points)
4. Clarity & structure (0-20 points)

**Expected**: 
- Score: 0-100
- Detailed feedback paragraph
- Key points identified

---

## 7. ATS Integration Flow

### TC-ATS-001: Webhook Signature Verification
**Priority**: Critical  
**Category**: Security  
**Endpoint**: `/functions/v1/ats-webhook`  
**Method**: POST  
**Headers**:
```
x-webhook-signature: <hmac-sha256>
x-webhook-timestamp: <unix-timestamp>
```

**Test Cases**:
1. **Valid Signature**: Status 200, candidate synced
2. **Invalid Signature**: Status 401, rejected
3. **Missing Timestamp**: Status 401, rejected
4. **Old Timestamp** (>5 min): Status 401, replay rejected
5. **Duplicate requestId**: Status 409, duplicate blocked

**Validation**: Check audit_logs for webhook receipt

---

### TC-ATS-002: Candidate Data Sync
**Priority**: High  
**Category**: Integration  
**Payload**:
```json
{
  "integrationId": "uuid",
  "event": "candidate.created",
  "candidate": {
    "id": "ext_123",
    "name": "John Doe",
    "email": "john@example.com",
    "skills": ["React", "Node.js"]
  }
}
```

**Expected**:
- Candidate upserted in ats_candidates table
- Mapped to integration_id
- Skills array stored correctly

**SQL Validation**:
```sql
SELECT * FROM ats_candidates 
WHERE integration_id = 'uuid' AND external_id = 'ext_123';
```

---

## 8. Partner Onboarding Flow

### TC-PART-001: Partner Registration
**Priority**: High  
**Category**: Onboarding  
**Steps**:
1. Fill partner onboarding form
2. Select plan (Starter/Growth/Enterprise)
3. Submit for admin approval
4. Admin reviews and approves
5. Partner receives access

**Expected**:
- Organization record created
- Partner_admin role assigned
- Plan limits enforced
- Billing setup prompted

---

### TC-PART-002: Organization Isolation
**Priority**: Critical  
**Category**: Security (RLS)  
**Test**:
1. Create 2 organizations: OrgA, OrgB
2. UserA creates interview in OrgA
3. UserB (OrgB) attempts to access OrgA interview

**Expected**: 
- UserB receives 403 or null data
- RLS policy blocks cross-org access

**SQL Test**:
```sql
-- As UserB
SELECT * FROM interviews WHERE organization_id = 'OrgA_id';
-- Result: Empty (RLS blocks)
```

---

## 9. Billing & Plan Management Flow

### TC-BILL-001: Plan Limit Enforcement
**Priority**: High  
**Category**: Business Logic  
**Plans**:
- **Starter**: 10 interviews/month
- **Growth**: 100 interviews/month
- **Enterprise**: Unlimited

**Test**:
1. Organization on Starter plan
2. Create 10 interviews ✓
3. Attempt 11th interview ✗

**Expected**: 
- Error: "Plan limit reached"
- Prompt to upgrade
- Interview creation blocked

---

## 10. Reporting & Analytics Flow

### TC-REP-001: Generate Candidate Report
**Priority**: High  
**Category**: Reporting  
**Input**: Candidate with completed interview  
**Report Sections**:
1. Personal info (name, email)
2. Interview details (role, date, duration)
3. Question-wise scores
4. Proctoring summary (integrity score, violations)
5. AI evaluation summary
6. Final recommendation

**Expected**: PDF generated, downloadable

---

## 11. Security Testing

### TC-SEC-001: SQL Injection Prevention
**Priority**: Critical  
**Category**: Security  
**Vectors**:
1. `'; DROP TABLE interviews; --` in job title
2. `1' OR '1'='1` in interview ID

**Expected**: 
- Parameterized queries block injection
- No database changes
- Input sanitized

---

### TC-SEC-002: XSS Prevention
**Priority**: Critical  
**Category**: Security  
**Input**: `<script>alert('XSS')</script>` in interview title  
**Expected**:
- Script not executed
- HTML escaped in display
- Stored safely in database

---

### TC-SEC-003: RLS Policy Verification
**Priority**: Critical  
**Category**: Database Security  
**Tables to Test**:
- interviews
- interview_questions
- candidate_answers
- proctoring_sessions
- organizations

**Method**: Run linter, verify all tables have:
1. RLS enabled
2. Policies for SELECT, INSERT, UPDATE, DELETE
3. Policies use auth.uid() or organization checks

---

## 13. AI Configuration & Model Management

### TC-AI-CFG-001: Dynamic Model Loading from Database
**Priority**: Critical  
**Category**: AI Infrastructure  
**Role**: Platform Admin  
**Steps**:
1. Navigate to /admin/ai-configuration
2. Go to "Health Monitoring" tab
3. Observe model dropdown for any AI feature
4. Verify models are loaded from `ai_providers` table

**Expected**:
- Models list is not hardcoded
- All active providers' models appear in dropdown
- Models are dynamically fetched: `google/gemini-2.5-pro`, `google/gemini-2.5-flash`, `openai/gpt-5`, etc.
- No hardcoded model arrays in frontend code

**Database Validation**:
```sql
SELECT provider_type, supported_models 
FROM ai_providers 
WHERE is_active = true;
```

---

### TC-AI-CFG-002: AI Feature Scanning (Dynamic Discovery)
**Priority**: Critical  
**Category**: AI Infrastructure  
**Steps**:
1. Navigate to /admin/ai-configuration
2. Click "AI Features" tab
3. Click "Refresh" button
4. Observe scanning process

**Expected**:
- Scan reads from `ai_feature_health` table (not hardcoded list)
- Returns current count of features in database
- Creates missing configurations in `ai_feature_configurations`
- Does NOT create duplicate configurations
- Shows accurate feature count (e.g., "14 features found")

**Edge Function Test**:
```bash
POST /functions/v1/scan-ai-features
Body: {}
Expected: { success: true, total_count: <dynamic>, new_configs_created: 0 }
```

---

### TC-AI-CFG-003: Feature Configuration Creation
**Priority**: High  
**Category**: AI Infrastructure  
**Preconditions**: Run scan with new feature in `ai_feature_health`  
**Steps**:
1. Insert new feature into `ai_feature_health`:
```sql
INSERT INTO ai_feature_health (feature_id, feature_name, edge_function, current_model)
VALUES ('test-feature', 'Test AI Feature', 'test-ai-function', 'google/gemini-2.5-flash');
```
2. Run scan-ai-features
3. Query `ai_feature_configurations`

**Expected**:
- New configuration created automatically
- Default settings applied:
  - `fallback_enabled`: true
  - `retry_attempts`: 3
  - `timeout_seconds`: 30
  - `is_enabled`: true
- Configuration appears in "AI Features" tab

---

### TC-AI-CFG-004: Model Selection & Update
**Priority**: High  
**Category**: AI Configuration  
**Steps**:
1. Navigate to "Health Monitoring" tab
2. Select an AI feature (e.g., "Question Generation")
3. Change current model from dropdown
4. Verify update triggers `update-ai-feature-model` function

**Expected**:
- Model selection persists in `ai_feature_health` table
- Toast notification shows success
- No page reload required
- Edge function logs show model update

**Database Validation**:
```sql
SELECT feature_id, current_model, updated_at
FROM ai_feature_health
WHERE feature_id = 'generate-questions';
```

---

### TC-AI-CFG-005: Fallback Model Configuration
**Priority**: High  
**Category**: AI Resilience  
**Steps**:
1. Select AI feature in Health Monitoring
2. Toggle "Fallback Model" switch to ON
3. Select fallback model from dropdown
4. Save configuration

**Expected**:
- `fallback_enabled` = true in database
- `fallback_model` field populated
- Feature uses fallback on primary model failure
- Fallback logic executes in edge functions

---

### TC-AI-CFG-006: Provider Model Synchronization
**Priority**: Medium  
**Category**: Data Integrity  
**Steps**:
1. Add new AI provider to `ai_providers` table
2. Include new supported models in `supported_models` JSON
3. Refresh AI Configuration page
4. Check model dropdowns

**Expected**:
- New models immediately available in dropdowns
- No code deployment required
- Models sorted alphabetically
- Duplicate models handled correctly

**Test SQL**:
```sql
INSERT INTO ai_providers (name, display_name, provider_type, base_url, supported_models, is_active)
VALUES (
  'test-provider',
  'Test Provider',
  'test',
  'https://test.api.com',
  '["test/model-1", "test/model-2"]'::jsonb,
  true
);
```

---

### TC-AI-CFG-007: Health Status Monitoring
**Priority**: High  
**Category**: AI Observability  
**Steps**:
1. Navigate to Health Monitoring tab
2. Observe feature status badges
3. Trigger AI feature via platform (e.g., generate questions)
4. Refresh health data
5. Check updated metrics

**Expected**:
- Status accurately reflects: `healthy`, `degraded`, `failed`, `unknown`
- Metrics update: `total_requests`, `successful_requests`, `failed_requests`
- `consecutive_failures` increments on errors
- `last_success_at` and `last_error_at` timestamps accurate

---

### TC-AI-CFG-008: Auto-Retry Configuration
**Priority**: Medium  
**Category**: AI Resilience  
**Steps**:
1. Enable auto-retry for AI feature
2. Set `max_retry_attempts` to 3
3. Simulate AI endpoint failure
4. Observe retry behavior in logs

**Expected**:
- Function retries up to configured attempts
- Exponential backoff between retries
- Falls back to fallback model after max retries
- Logs show retry attempts with delays

---

### TC-AI-CFG-009: Feature Enable/Disable Toggle
**Priority**: High  
**Category**: AI Management  
**Steps**:
1. Select AI feature in Health Monitoring
2. Toggle feature switch to OFF
3. Attempt to use feature via platform
4. Toggle back to ON

**Expected When Disabled**:
- Feature skipped in API calls
- User-friendly error message shown
- No AI tokens consumed
- Database shows `is_enabled = false`

**Expected When Re-enabled**:
- Feature resumes normal operation
- Previously configured settings retained

---

### TC-AI-CFG-010: Alert Acknowledgment
**Priority**: Medium  
**Category**: AI Observability  
**Preconditions**: Generate AI health alert  
**Steps**:
1. Cause repeated AI feature failures (5+)
2. Alert appears in banner
3. Click "Acknowledge" button
4. Verify alert dismissed

**Expected**:
- Alert record updated: `is_acknowledged = true`
- `acknowledged_by` set to current user ID
- `acknowledged_at` timestamp recorded
- Alert removed from banner display

---

### TC-AI-CFG-011: Usage Analytics Display
**Priority**: Low  
**Category**: AI Analytics  
**Steps**:
1. Navigate to "Usage Analytics" tab
2. View feature usage statistics
3. Check AI token consumption

**Expected**:
- Usage data from `ai_usage_logs` table
- Grouped by feature
- Shows: request count, success rate, avg latency
- Token usage displayed (if tracked)

---

### TC-AI-CFG-012: Multi-Provider Configuration
**Priority**: High  
**Category**: AI Infrastructure  
**Setup**: Add API keys for multiple providers  
**Steps**:
1. Navigate to "API Keys" tab
2. Add OpenAI API key
3. Add Anthropic API key
4. Test connections
5. Assign different features to different providers

**Expected**:
- Multiple providers active simultaneously
- Features can use different providers
- Primary and fallback can be from different providers
- Provider-specific models shown correctly

---

### TC-AI-CFG-013: Scan Performance with Large Dataset
**Priority**: Medium  
**Category**: Performance  
**Setup**: 50+ features in `ai_feature_health`  
**Steps**:
1. Click Refresh in AI Features tab
2. Measure scan execution time
3. Check database query performance

**Expected**:
- Scan completes in < 5 seconds
- No duplicate configuration creation
- Efficient bulk insert operations
- No timeout errors

---

### TC-AI-CFG-014: Configuration Migration from Hardcoded
**Priority**: Critical  
**Category**: Migration  
**Validation**: Ensure no hardcoded model lists remain  
**Checks**:
1. Search codebase for hardcoded model arrays
2. Verify `useAIHealthMonitoring` fetches from database
3. Check no `const AVAILABLE_MODELS = [...]` patterns

**Expected**:
- Zero hardcoded model arrays found
- All models loaded via database queries
- Configuration fully database-driven

---

### TC-AI-CFG-015: Edge Function Integration
**Priority**: High  
**Category**: Integration  
**Steps**:
1. Update AI configuration for "generate-questions"
2. Call `generate-questions` edge function
3. Verify function uses updated configuration

**Expected**:
- Edge function reads from `ai_feature_configurations`
- Uses configured primary provider/model
- Falls back to fallback model on failure
- Logs to `ai_usage_logs` table

---

## Test Execution Summary

### Test Categories
- **Security**: 15 tests
- **Functionality**: 25 tests
- **Integration**: 8 tests
- **Performance**: 5 tests
- **AI/ML**: 7 tests
- **AI Configuration**: 15 tests (NEW)

### Total Test Cases: 75

### Automation Status
- Fully Automated: 45
- Manual Required: 20
- Semi-Automated: 10

### Test Environment Requirements
- Supabase project with full schema
- Test user accounts for each role
- Sample interview data
- AI model access
- Storage bucket configured

---

## Continuous Testing Schedule

### Daily
- Smoke tests (critical paths)
- Security scans

### Weekly
- Full regression suite
- Performance benchmarks

### Monthly
- Security penetration testing
- AI model evaluation accuracy review

### Before Each Release
- Complete test suite execution
- Manual exploratory testing
- User acceptance testing (UAT)

---

## Test Data Management

### Test Users
```sql
-- Platform Admin
email: admin@test.talentgeenie.com
role: platform_admin

-- HR Recruiter
email: hr@test.talentgeenie.com
role: hr_recruiter

-- Candidate
email: candidate@test.talentgeenie.com
role: candidate
```

### Test Organizations
- TestOrg Alpha (Starter Plan)
- TestOrg Beta (Growth Plan)
- TestOrg Gamma (Enterprise Plan)

---

## Appendix: Test Result Format

```json
{
  "test_id": "TC-PROC-003",
  "test_name": "Recording Upload & Storage",
  "status": "passed",
  "execution_time_ms": 1250,
  "timestamp": "2025-01-11T10:30:00Z",
  "environment": "staging",
  "tester": "automated",
  "notes": "All validations passed"
}
```

---

**Document End**
