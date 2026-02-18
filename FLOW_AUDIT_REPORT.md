# Complete Interview Flow Audit & Issues Report

## ✅ CORRECT FLOW (What Should Happen)

### 1. **Interview Creation** (CreateInterview.tsx)
- [x] HR enters interview details (title, job description)
- [x] AI extracts skills from job description
- [x] HR configures question types & difficulty distribution
- [x] HR sets proctoring options
- [x] HR sets question bank size (larger than actual questions needed)
- [x] Creates interview with status='draft'
- [x] Background job generates question bank
- [ ] **ISSUE**: Currently trying to add candidates during creation ❌
- [ ] **FIX NEEDED**: Remove candidate email collection from CreateInterview

### 2. **Interview Review & Activation** (InterviewDetail.tsx)
- [x] HR reviews generated questions in question bank
- [x] HR can regenerate individual questions
- [x] HR can preview all questions
- [ ] **ISSUE**: Still using old single share_link system ❌
- [ ] **FIX NEEDED**: Replace with "Activate & Send Invitations" flow
  - Opens dialog to add candidate emails (single or bulk)
  - Choose whether to send emails or generate links only
  - Updates interview status to 'active'
  - Calls send-interview-invitations edge function
  - Shows invitations table with copy-link buttons

### 3. **Candidate Receives Invitation**
- [x] Candidate gets unique link (via email or direct share)
- [x] Link format: `/take-interview/{unique-token}`

### 4. **Candidate Takes Interview** (TakeInterview.tsx)
- [x] System validates invitation token
- [x] Checks if invitation expired
- [x] Pre-fills candidate email (read-only)
- [x] Candidate enters name
- [x] System validates email matches invited email
- [ ] **POTENTIAL ISSUE**: Need to verify proctoring flow still works ⚠️
- [x] If proctoring enabled:
  - Shows PreInterviewChecks component
  - Validates camera, microphone, screen share
  - Starts proctoring session
- [x] Loads candidate's pre-selected mix-and-match questions
- [x] Candidate answers questions
- [x] Proctoring monitors throughout (if enabled)
- [x] Submits answers
- [x] Updates invitation status to 'completed'

### 5. **Evaluation & Results**
- [x] System evaluates submission via evaluate-interview edge function
- [x] Generates assessment with scores
- [x] HR views results in InterviewDetail attempts table
- [x] HR can view proctoring report

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### Issue #1: Invitation Timing Wrong
**Location**: CreateInterview.tsx lines 658-790
**Problem**: Trying to send invitations during interview creation
**Impact**: HR cannot review questions before sending to candidates
**Fix**: Remove candidate email collection from CreateInterview.tsx

### Issue #2: Old Share Link System Still Active
**Location**: InterviewDetail.tsx lines 116-150, 429-441
**Problem**: Still using old single share_link system
**Impact**: Multiple candidates would share same link, breaking email validation
**Fix**: Replace generateShareLink() with activateAndSendInvitations()

### Issue #3: Proctoring Flow Integration
**Location**: TakeInterview.tsx
**Status**: ⚠️ NEEDS VERIFICATION
**Potential Issue**: Proctoring setup might not work with invitation-based flow
**Test Needed**: 
  - Verify PreInterviewChecks still loads
  - Verify ProctoringMonitor still tracks violations
  - Verify proctoring session links to attempt correctly

### Issue #4: Question Mix-and-Match Selection
**Location**: send-interview-invitations edge function
**Status**: ✅ Implemented but NEEDS TESTING
**Implementation**: 
  - Fetches all questions from interview's question bank
  - Randomly selects `interview.question_count` questions per candidate
  - Stores selected question IDs in invitation metadata
  - TakeInterview loads only those pre-selected questions
**Test Needed**: Verify different candidates get different question sets

### Issue #5: RLS Policy Coverage
**Location**: Database policies
**Status**: ⚠️ NEEDS VERIFICATION
**Required Policies**:
  - [x] Candidates can view interviews via invitation token ✅
  - [x] Candidates can create attempts only with valid invitation ✅
  - [ ] Need to verify: Can candidates view their pre-selected questions? ⚠️
  - [ ] Need to verify: Can candidates submit answers? ⚠️
  - [ ] Need to verify: Proctoring session creation with invitation_id? ⚠️

---

## 📋 COMPLETE FLOW CHECKLIST

### Pre-Interview (HR Side)
- [x] 1. HR logs in with hr_recruiter role
- [x] 2. HR creates interview (without candidates)
- [x] 3. System generates question bank in background
- [ ] 4. HR reviews questions ⚠️ (UI exists but needs testing)
- [ ] 5. HR clicks "Activate & Send Invitations" ❌ (NOT IMPLEMENTED)
- [ ] 6. HR adds candidate emails (single or bulk) ❌ (WRONG LOCATION)
- [ ] 7. System generates unique links per candidate ⚠️ (Function exists, not integrated)
- [ ] 8. System optionally sends emails ⚠️ (Function exists, not integrated)
- [ ] 9. HR sees invitations table ❌ (UI NOT IMPLEMENTED)
- [ ] 10. HR can copy individual invitation links ❌ (UI NOT IMPLEMENTED)

### During Interview (Candidate Side)
- [x] 11. Candidate opens unique link ✅
- [x] 12. System validates invitation token ✅
- [x] 13. Candidate enters name (email pre-filled) ✅
- [x] 14. System validates email matches invitation ✅
- [ ] 15. If proctoring: PreInterviewChecks runs ⚠️ (NEEDS TESTING)
- [ ] 16. If proctoring: Camera/mic permissions granted ⚠️ (NEEDS TESTING)
- [x] 17. Interview starts with pre-selected questions ✅
- [ ] 18. Proctoring monitors violations ⚠️ (NEEDS TESTING)
- [x] 19. Candidate answers questions ✅
- [x] 20. Candidate submits interview ✅

### Post-Interview (System & HR)
- [ ] 21. System evaluates submission ⚠️ (Function exists, NEEDS TESTING)
- [ ] 22. System generates assessment ⚠️ (Function exists, NEEDS TESTING)
- [ ] 23. System updates invitation to 'completed' ⚠️ (NEEDS IMPLEMENTATION)
- [ ] 24. HR views results in attempts table ⚠️ (NEEDS TESTING)
- [ ] 25. HR views proctoring report ⚠️ (NEEDS TESTING)

---

## 🔧 REQUIRED FIXES (Priority Order)

### HIGH PRIORITY (Breaks Core Flow)

**Fix #1: Remove Candidates from CreateInterview**
- File: src/pages/CreateInterview.tsx
- Remove: candidateEmails state, email input UI, handleAddCandidate, bulk import
- Remove: Invitation generation call during creation
- Keep: All interview configuration (topics, types, difficulty, proctoring)

**Fix #2: Add Invitation Dialog to InterviewDetail**
- File: src/pages/InterviewDetail.tsx
- Add: Dialog component for adding candidate emails
- Add: activateAndSendInvitations() function
- Replace: generateShareLink button with "Activate & Send Invitations"
- Add: Invitations table UI (already fetching data, just need display)

**Fix #3: Update Interview Status Flow**
- Interview should go: draft → active (only when invitations sent)
- Remove old share_link field usage
- Use invitation tokens exclusively

### MEDIUM PRIORITY (Integration Testing)

**Test #1: Proctoring with Invitations**
- Create test interview with proctoring enabled
- Add test candidate
- Take interview and verify:
  - PreInterviewChecks loads
  - Camera/mic permissions work
  - ProctoringMonitor tracks violations
  - Proctoring session saves correctly

**Test #2: Mix-and-Match Questions**
- Create interview with 50 question bank, 10 questions per attempt
- Add 3 test candidates
- Verify each candidate gets different 10 questions
- Verify questions are properly ordered

**Test #3: Email Validation**
- Add candidate with email candidate@test.com
- Try to start interview with different email
- Verify error message shows
- Verify cannot proceed

### LOW PRIORITY (Nice to Have)

**Enhancement #1: Invitation Status Updates**
- Update invitation status when candidate starts (accessed)
- Update when candidate completes (completed)
- Show status in invitations table

**Enhancement #2: Resend Invitation**
- Add button to resend email invitation
- Add button to regenerate expired invitation

---

## 🧪 TESTING SCRIPT

### Test Case 1: Full Happy Path
```
1. Login as HR (hr_recruiter role)
2. Create interview "Senior Developer"
   - Add job description
   - Extract skills (verify AI works)
   - Configure: 20 MCQ, 50 questions bank
   - Enable proctoring
3. Wait for questions to generate
4. Review questions in InterviewDetail
5. Click "Activate & Send Invitations"
6. Add candidates:
   - test1@example.com, John Doe
   - test2@example.com, Jane Smith
7. Choose "Generate links only" (no email)
8. Verify invitations table shows 2 invitations
9. Copy link for test1@example.com
10. Open link in incognito
11. Verify email shows test1@example.com (read-only)
12. Enter name "John Doe"
13. Start interview
14. Verify proctoring checks run
15. Grant permissions
16. Answer all questions
17. Submit
18. Verify submission succeeds
19. Back to HR: verify attempt shows in table
20. Trigger evaluation
21. Verify assessment generates
22. View proctoring report
```

### Test Case 2: Email Mismatch
```
1. Get invitation link for test1@example.com
2. Try to change email to test2@example.com
3. Verify error: "Email doesn't match invitation"
4. Cannot proceed
```

### Test Case 3: Expired Invitation
```
1. Create invitation
2. Manually update expires_at to past date
3. Try to open link
4. Verify error: "Invitation has expired"
```

---

## 📊 CURRENT STATUS SUMMARY

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | interview_invitations table with RLS |
| Edge Function | ✅ Complete | send-interview-invitations works |
| CreateInterview UI | ❌ Wrong | Needs candidates removed |
| InterviewDetail UI | ❌ Incomplete | Needs invitation dialog & table |
| TakeInterview | ✅ Complete | Validates invitations correctly |
| Proctoring Flow | ⚠️ Unknown | Needs integration testing |
| Question Selection | ⚠️ Unknown | Logic exists, needs testing |
| Evaluation Flow | ⚠️ Unknown | Needs end-to-end testing |

---

## 🎯 NEXT STEPS

1. **Fix CreateInterview.tsx** - Remove candidate collection
2. **Fix InterviewDetail.tsx** - Add invitation sending flow
3. **Integration Test** - Run complete flow with proctoring
4. **Verify RLS** - Test all candidate access paths
5. **Production Ready** - Only after all tests pass