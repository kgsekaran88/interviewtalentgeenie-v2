# Comprehensive E2E Testing System

## Overview
This testing system simulates complete user workflows and validates that all functionality and navigation flows work correctly - just like manual testing, but automated.

## What It Tests

### 1. Complete Interview Flow
**Simulates**: Organization → Create Interview → Add Questions → Candidate Takes Interview → Submit → AI Evaluation

**Steps with Detailed Validations**:
1. ✅ **Create Organization**: Validates ID generation, status, timestamps, industry, size
2. ✅ **Add Organization Member**: Validates role assignment, status, joined_at, user linkage
3. ✅ **Create Subscription**: Validates limits (interviews, users, AI tokens), usage counters start at 0, period dates
4. ✅ **Create Interview**: Validates share_link generation, status, proctoring settings, organization linkage
5. ✅ **Add 5 Questions**: Validates question types (MCQ, descriptive, coding), difficulty distribution (easy/medium/hard), required fields (text, correct_answer, options for MCQ)
6. ✅ **Create Candidate Attempt**: Validates session token generation, status, started_at timestamp, interview linkage
7. ✅ **Link Questions to Attempt**: Validates all questions linked, sequential display order (1,2,3,4,5)
8. ✅ **Submit Answers**: Validates status change to 'submitted', submitted_at timestamp, answer completeness, time recording
9. ✅ **Generate AI Assessment**: Validates score range (0-100), hiring decision validity, topic scores presence, strengths/weaknesses identification, detailed analysis, attempt linkage
10. ✅ **Verify Complete Data Chain**: Validates all FK relationships (Interview→Organization, Attempt→Interview, Assessment→Attempt), question-answer count consistency, data completeness
11. ✅ **Cleanup Test Data**: Removes all E2E_TEST tagged data

**What It Catches**:
- ❌ Broken foreign key relationships
- ❌ Missing RLS policies
- ❌ Data integrity issues (missing fields, wrong types)
- ❌ Edge function failures
- ❌ Incomplete workflows
- ❌ **Deviations from expected behavior** (flagged with severity)
- ❌ Question type distribution issues
- ❌ Difficulty level imbalances
- ❌ Missing timestamps or metadata
- ❌ Incorrect status transitions
- ❌ Incomplete answer submissions
- ❌ Invalid scoring ranges
- ❌ Broken data chain relationships

### 2. Partner Onboarding Flow
**Simulates**: New Partner Registration → Admin Approval → Subscription Assignment → Portal Access

**Steps**:
1. Register new partner organization (pending status)
2. Admin approves organization
3. Assign subscription plan
4. Add partner admin user
5. Verify portal access permissions

**What It Catches**:
- Approval workflow issues
- Role assignment problems
- Subscription activation failures
- Access control bugs

### 3. Candidate Journey Flow
**Simulates**: Receive Link → View Details → Start Interview → Answer Questions

**Steps**:
1. Candidate receives interview link
2. Views interview details (title, time limit, proctoring status)
3. Creates attempt via `create_interview_attempt` function
4. Fetches questions via `get_questions_for_attempt`

**What It Catches**:
- Link sharing issues
- Interview visibility problems
- Question fetching errors
- Session token generation failures

### 4. Proctoring Workflow
**Simulates**: Enable Proctoring → Monitor Session → Record Violations → Close Session

**Steps**:
1. Get proctoring-enabled interview
2. Create candidate attempt
3. Initialize proctoring session (camera, mic, screen share)
4. Record integrity violations (tab switches, face not visible)
5. Calculate integrity score
6. Close session

**What It Catches**:
- Proctoring setup failures
- Violation recording issues
- Integrity score calculation problems
- Session management bugs

### 5. AI Evaluation Flow
**Simulates**: Submit Attempt → Call AI Evaluation → Generate Assessment → Check Bias Detection

**Steps**:
1. Find submitted attempt
2. Call `evaluate-interview` edge function
3. Verify assessment creation
4. Check bias detection results

**What It Catches**:
- Edge function deployment issues
- AI integration problems
- Assessment generation failures
- Bias detection errors

### 6. Learning Workflow
**Simulates**: Browse Topics → Check Subscription → Take Assessment → Earn Badges

**Steps**:
1. Check available certification topics
2. Verify learning subscription status
3. Check daily free assessment limits
4. Validate badge system

**What It Catches**:
- Topic availability issues
- Subscription validation problems
- Assessment limit enforcement
- Badge award logic errors

### 7. Analytics & Reporting Flow
**Simulates**: Generate CPI → Create Snapshots → Build Comparative Reports

**Steps**:
1. Check CPI calculations
2. Verify analytics snapshots
3. Validate comparative analytics
4. Check report generation

**What It Catches**:
- CPI calculation errors
- Snapshot generation issues
- Report building failures
- Data aggregation problems

## AI-Powered Error Analysis

When tests fail, the system:
1. Captures error details, context, and stack trace
2. Calls `analyze-test-error` edge function
3. Uses Lovable AI (Gemini 2.5 Flash) to analyze the error
4. Generates:
   - **Root Cause**: What actually went wrong
   - **Severity**: critical/high/medium/low
   - **Affected Areas**: Which components/tables/functions
   - **Fix Suggestions**: Specific code examples and steps
   - **Preventive Measures**: How to avoid it in future
   - **Related Issues**: Other potential problems to check

Example AI Analysis:
```json
{
  "rootCause": "RLS policy on interview_attempts table prevents candidate from creating attempts",
  "severity": "critical",
  "affectedAreas": ["interview_attempts", "create_interview_attempt", "candidate flow"],
  "suggestedFixes": [
    {
      "description": "Add RLS policy to allow candidates to insert their own attempts",
      "code": "CREATE POLICY \"Candidates can create attempts\" ON interview_attempts FOR INSERT WITH CHECK (true);",
      "file": "supabase/migrations/xxx_add_attempt_policy.sql",
      "priority": 1
    }
  ],
  "preventiveMeasures": ["Always test candidate flows after RLS changes"],
  "relatedIssues": ["Check if questions can be fetched by candidates"]
}
```

## How to Use

### Running Tests
1. Go to Testing Hub
2. Select a flow (e.g., "Complete Interview Flow")
3. Click "Run Tests"
4. System runs both:
   - Basic tests (database, RLS, constraints)
   - Comprehensive E2E tests (full user workflow)

### Viewing Results
- Green checkmarks ✅: Test passed
- Red X ❌: Test failed (click for AI analysis)
- Duration shown for each step
- Overall success rate calculated

### Understanding Reports
- **Summary**: Total/passed/failed/success rate
- **Steps**: Each workflow step with status
- **Errors**: Failed steps with AI-powered fix suggestions
- **Comprehensive Report**: Full E2E workflow results

## Test Data Management
- All test data is marked with `[E2E_TEST]` tag
- Automatically cleaned up after each test
- Never affects production data
- Uses isolated test organizations

## Benefits

### vs Manual Testing
✅ **Faster**: Runs entire flow in seconds vs minutes manually
✅ **Consistent**: Same steps every time, no human error
✅ **Comprehensive**: Tests every step, doesn't skip anything
✅ **AI-Powered**: Suggests fixes automatically
✅ **Data Integrity**: Verifies complete data chains
✅ **Scalable**: Can run hundreds of tests

### Error Detection
- Catches issues before users encounter them
- Identifies broken workflows immediately
- Validates data relationships end-to-end
- Tests edge functions and RLS policies
- Verifies AI integrations

### Fix Suggestions
- Specific code examples provided
- Database migration suggestions
- RLS policy recommendations
- Edge function debugging tips
- Performance optimization hints

## Architecture

```
TestingHub (UI)
    ↓
run-flow-tests (Basic Tests)
    ↓
run-comprehensive-flow-test (E2E Tests)
    ↓
Test Execution → Captures Errors
    ↓
analyze-test-error (AI Analysis)
    ↓
Lovable AI Gateway (Gemini 2.5 Flash)
    ↓
Fix Suggestions → Display in UI
```

## Next Steps

1. **Run Complete Interview Flow** - Validates entire hiring pipeline
2. **Review Failed Tests** - Check AI-powered fix suggestions
3. **Fix Issues** - Apply suggested code changes
4. **Re-run Tests** - Verify fixes work
5. **Expand Coverage** - Add more flows as needed

## Current Coverage

✅ Authentication & Authorization
✅ Partner Onboarding
✅ Organization Management
✅ Interview Creation
✅ Question Repository
✅ Candidate Assessment
✅ Proctoring System
✅ AI Evaluation
✅ Learning Platform
✅ Analytics & Reporting

## Future Enhancements

- [ ] UI navigation testing (Playwright integration)
- [ ] Performance benchmarking
- [ ] Load testing
- [ ] Security vulnerability scanning
- [ ] Mobile app testing
- [ ] API endpoint testing
- [ ] Real-time collaboration testing

---

**The system now provides automated E2E testing that covers everything manual testing would cover, with AI-powered error detection and actionable fix suggestions.**
