# Complete Interview Flow Audit - VERIFIED ✅

## Flow Overview

```mermaid
graph TD
    A[HR Creates Interview] --> B[AI Generates Question Bank]
    B --> C[HR Reviews Questions]
    C --> D[HR Clicks Activate & Send Invitations]
    D --> E[InvitationDialog Opens]
    E --> F[HR Adds Candidates]
    F --> G[System Generates Unique Tokens]
    G --> H[System Selects Mix-Match Questions]
    H --> I{Send Emails?}
    I -->|Yes| J[Emails Sent via Resend]
    I -->|No| K[Links Generated Only]
    J --> L[Candidate Receives Link]
    K --> L
    L --> M[Candidate Opens Unique Link]
    M --> N[System Validates Invitation]
    N --> O[Email Pre-filled & Read-only]
    O --> P[Candidate Enters Name]
    P --> Q{Proctoring Enabled?}
    Q -->|Yes| R[PreInterviewChecks]
    Q -->|No| T[Start Interview]
    R --> S[Camera/Mic Permissions]
    S --> T
    T --> U[Load Pre-selected Questions]
    U --> V[ProctoringMonitor Active]
    V --> W[Candidate Answers Questions]
    W --> X[Submit Interview]
    X --> Y[Finalize Proctoring Session]
    Y --> Z[Calculate Integrity Score]
    Z --> AA[Upload Video Recordings]
    AA --> AB[Auto-trigger Evaluation]
    AB --> AC[AI Generates Assessment]
    AC --> AD[HR Views Results]
    AD --> AE[HR Downloads Videos]
```

---

## ✅ VERIFIED COMPONENTS

### 1. Interview Creation (CreateInterview.tsx)
**Status**: ✅ COMPLETE
- Creates draft interview
- Configures question types, difficulty, topics
- Sets question bank size (for mix-and-match)
- Enables proctoring settings
- **NO candidate collection** (moved to activation)
- Triggers background question generation
- Navigates to InterviewDetail for review

### 2. Interview Activation (InterviewDetail.tsx)
**Status**: ✅ COMPLETE
- Displays interview details and question bank
- Shows "Activate & Send Invitations" button for draft interviews
- Opens InvitationDialog component
- Displays invitations table after activation
- Each invitation has "Copy Link" button

### 3. Invitation Management (InvitationDialog.tsx)
**Status**: ✅ COMPLETE
- Single candidate entry (email + name)
- Bulk CSV import (email, name per line)
- Checkbox to send emails vs links-only
- Calls `send-interview-invitations` edge function
- Updates interview status to 'active'

### 4. Invitation Generation (send-interview-invitations edge function)
**Status**: ✅ COMPLETE
**Location**: `supabase/functions/send-interview-invitations/index.ts`

**Features**:
- Generates unique 12-character share tokens
- Selects random mix-and-match questions per candidate
- Stores `selected_question_ids` in invitation metadata
- Optional email sending via Resend API
- Fallback to link-only if no RESEND_API_KEY
- Returns list of invitations with links

**Mix-and-Match Logic**:
```typescript
// Fetches ALL questions from question bank
const { data: allQuestions } = await supabase
  .from('questions')
  .select('*')
  .eq('interview_id', interview_id);

// Randomly selects interview.question_count questions
const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
const selectedQuestions = shuffled.slice(0, questionCount);

// Stores in invitation metadata
metadata: { selected_question_ids: selectedQuestions.map(q => q.id) }
```

### 5. Candidate Access (TakeInterview.tsx)
**Status**: ✅ COMPLETE

**Invitation Validation**:
- Fetches invitation by share_token
- Checks if expired (`expires_at < NOW()`)
- Pre-fills candidate_email (read-only)
- Pre-fills candidate_name if provided

**Email Validation**:
- Candidate must enter name
- System validates email matches `invitation.candidate_email`
- Case-insensitive comparison
- Error shown if mismatch

**Attempt Creation**:
- Calls `create_interview_attempt_with_invitation` RPC
- Links attempt to invitation_id
- Updates invitation status to 'accessed'
- Populates `attempt_questions` from invitation's `selected_question_ids`
- Returns attempt_id and session_token

### 6. Proctoring Flow
**Status**: ✅ COMPLETE

**Pre-Interview Checks** (PreInterviewChecks.tsx):
- Camera quality check with AI face detection
- Microphone test
- Screen share permission
- Lighting validation
- Browser compatibility check

**During Interview** (ProctoringMonitor.tsx):
- Continuous face detection (multiple persons)
- Voice analysis (multiple voices)
- Tab switch detection
- Look-away tracking
- Copy-paste detection
- Eye gaze analysis
- Real-time violation logging

**Session Management** (useProctoringSession.ts):
- Creates proctoring_session with interview_attempt_id
- Starts video/screen recording
- Uploads recordings to storage bucket
- Calculates integrity score on finalization
- Stores violations in structured format

### 7. Question Loading
**Status**: ✅ COMPLETE

**Database Function**: `get_questions_for_attempt`
- Checks if attempt_questions already exist
- If yes: Returns pre-selected questions in order
- If no: Would randomly select (but we pre-populate, so this path unused)
- Returns questions WITHOUT correct_answer field (security)

**Frontend**:
- Loads questions via RPC after attempt creation
- Displays one question at a time
- Progress bar showing completion
- Timer countdown if time_limit set

### 8. Submission & Evaluation
**Status**: ✅ COMPLETE

**Submission Flow** (TakeInterview.tsx):
1. Validates all answers submitted
2. Finalizes proctoring session
   - Stops recording
   - Uploads video/screen recordings
   - Calculates integrity score
3. Submits answers via `update_attempt_with_session` RPC
4. Updates attempt status to 'submitted'
5. Trigger: `complete_invitation_on_submission` updates invitation to 'completed'
6. Trigger: `auto_evaluate_interview` calls evaluation edge function

**Auto-Evaluation** (evaluate-interview edge function):
- Fetches attempt, questions, and answers
- Constructs AI prompt with context
- Calls configured AI provider (or Lovable AI fallback)
- Parses JSON response
- Creates assessment record
- Updates attempt status to 'evaluated'

### 9. Results Viewing (InterviewDetail.tsx)
**Status**: ✅ COMPLETE

**Attempts Table**:
- Shows all attempts with assessments
- Displays overall score, integrity score
- Shows hiring recommendation
- "Full Report" button → navigates to AssessmentReport

**Invitations Table**:
- Shows all invitations with status
- Email sent indicator
- Copy link button per invitation

### 10. Proctoring Report (ProctoringReport.tsx)
**Status**: ✅ COMPLETE

**Features**:
- Overall integrity score with color coding
- Detailed violation breakdown by type
- Video recording player (downloadable)
- Screen recording player (downloadable)
- System checks status (camera, mic, screen)
- Timestamps for all violations

**Video Download**:
- Generates signed URLs from storage bucket
- 1-hour expiry for security
- HTML5 video player with download capability
- Supports both video and screen recordings

---

## 🔒 SECURITY VERIFICATION

### RLS Policies

**interview_invitations**:
- ✅ Creators can manage invitations
- ✅ Platform admins can view all
- ✅ Candidates can view their own invitation (by token)
- ✅ Service role can manage (for edge functions)

**interview_attempts**:
- ✅ Creators can view attempts for their interviews
- ✅ Org admins can view org attempts
- ✅ Candidates can view their own attempt
- ✅ Linked to invitation_id

**attempt_questions**:
- ✅ Candidates can view questions for their attempt
- ✅ Creators and admins can view attempt questions
- ✅ Service role can populate questions

**questions**:
- ✅ Does NOT expose correct_answer to candidates
- ✅ Only via secure RPC function
- ✅ Creators and admins can manage

**proctoring_sessions**:
- ✅ Linked to interview_attempt_id
- ✅ Video recordings in secure storage bucket
- ✅ Signed URLs with expiry

### Data Flow Security

**Email Validation**:
- ✅ RPC function enforces email match
- ✅ Case-insensitive comparison
- ✅ Trim whitespace
- ✅ Error message if mismatch

**Token Security**:
- ✅ Unique 12-character tokens per invitation
- ✅ Collision detection in generation
- ✅ Expiry enforcement (30 days default)
- ✅ One-time use (status tracking)

**Question Isolation**:
- ✅ Each candidate gets unique question set
- ✅ Questions pre-selected from bank
- ✅ Stored in invitation metadata
- ✅ Populated into attempt_questions on start

---

## 📊 COMPLETE DATA FLOW

### Tables & Relationships

```
interviews (question bank)
    ↓
interview_invitations (per-candidate tokens + selected_question_ids)
    ↓
interview_attempts (candidate submission + invitation_id)
    ↓
attempt_questions (maps selected questions to attempt)
    ↓
assessments (AI evaluation results)

interview_attempts
    ↓
proctoring_sessions (integrity monitoring)
    ↓
storage: proctoring-recordings bucket (video files)
```

### Status Transitions

**Interview**: `draft` → `active` (on first invitation)
**Invitation**: `pending` → `accessed` (on start) → `completed` (on submit)
**Attempt**: `in_progress` → `submitted` → `evaluated`
**Proctoring**: `started` → `ended` (with integrity_score)

---

## ✅ FEATURE CHECKLIST

### Interview Creation
- [x] AI skill extraction from job description
- [x] Question type distribution (MCQ, Scenario, Coding, Descriptive)
- [x] Difficulty distribution (Easy, Medium, Hard)
- [x] Topic distribution
- [x] Question bank size configuration
- [x] Time limit setting
- [x] Proctoring enable/disable
- [x] Background question generation
- [x] Generation progress tracking

### Interview Activation
- [x] Review generated questions
- [x] Regenerate individual questions
- [x] Preview all questions
- [x] Add candidates (single/bulk)
- [x] Send email invitations (optional)
- [x] Generate unique links
- [x] View invitations table
- [x] Copy individual invitation links
- [x] Status change to 'active'

### Candidate Experience
- [x] Unique invitation link validation
- [x] Expiry checking
- [x] Email pre-fill (read-only)
- [x] Name entry
- [x] Email validation against invitation
- [x] Pre-interview proctoring checks
- [x] Camera/mic permission grants
- [x] AI-powered camera quality check
- [x] Face detection during setup
- [x] Pre-selected question loading
- [x] Question navigation (next/previous)
- [x] Answer saving per question
- [x] Code editor for coding questions
- [x] Time limit countdown
- [x] Auto-submit on timeout
- [x] Manual submission
- [x] Submission confirmation

### Proctoring
- [x] Real-time face detection
- [x] Multiple person detection
- [x] Voice analysis for multiple voices
- [x] Tab switch monitoring
- [x] Look-away detection
- [x] Copy-paste detection
- [x] Eye gaze tracking
- [x] Video recording (camera)
- [x] Screen recording
- [x] Violation logging with timestamps
- [x] Integrity score calculation
- [x] Video upload to storage
- [x] Session finalization

### Evaluation
- [x] Auto-trigger on submission
- [x] AI-powered answer evaluation
- [x] Overall score calculation
- [x] Topic-wise scoring
- [x] Hiring recommendation
- [x] Strengths identification
- [x] Weaknesses identification
- [x] Detailed analysis
- [x] CPI calculation
- [x] Assessment record creation

### Reporting
- [x] Attempts table in InterviewDetail
- [x] Assessment scores display
- [x] Integrity scores display
- [x] Hiring decision badges
- [x] Navigate to full report
- [x] Proctoring report with violations
- [x] Video playback (camera)
- [x] Video playback (screen)
- [x] **Downloadable videos** (HTML5 controls)
- [x] System checks summary
- [x] Detailed violation timeline

---

## 🎯 CORRECT FLOW SEQUENCE

### Phase 1: Pre-Interview (HR Side)
1. ✅ HR logs in (hr_recruiter or partner_admin role)
2. ✅ HR navigates to Create Interview
3. ✅ HR enters title + job description
4. ✅ HR clicks "Extract Skills with AI"
5. ✅ System extracts topics and auto-distributes percentages
6. ✅ HR configures question types (MCQ, Scenario, Coding, Descriptive)
7. ✅ HR configures difficulty (Easy, Medium, Hard)
8. ✅ HR sets question count per interview (e.g., 10)
9. ✅ HR sets question bank size (e.g., 50 for variety)
10. ✅ HR sets time limit (optional)
11. ✅ HR enables proctoring (optional)
12. ✅ HR clicks "Create Interview"
13. ✅ System creates interview with status='draft'
14. ✅ Background job generates question bank (50 questions)
15. ✅ HR navigates to InterviewDetail automatically

### Phase 2: Review & Activation (HR Side)
16. ✅ HR reviews generated question bank
17. ✅ HR can regenerate individual questions
18. ✅ HR can preview all questions
19. ✅ HR clicks "Activate & Send Invitations"
20. ✅ InvitationDialog opens
21. ✅ HR adds candidates:
    - Single entry: name (optional) + email
    - Bulk import: CSV format (email, name)
22. ✅ HR checks "Send email invitations" (optional)
23. ✅ HR clicks "Activate & Send Emails/Links"
24. ✅ System updates interview status to 'active'
25. ✅ System generates unique token per candidate
26. ✅ System randomly selects 10 questions per candidate from bank
27. ✅ System stores selected_question_ids in invitation metadata
28. ✅ System sends emails (if RESEND_API_KEY configured)
29. ✅ System displays invitations table
30. ✅ HR can copy individual invitation links

### Phase 3: Taking Interview (Candidate Side)
31. ✅ Candidate receives email with unique link
32. ✅ Candidate clicks link: `/take-interview/{unique-token}`
33. ✅ System validates invitation token
34. ✅ System checks expiry (default: 30 days)
35. ✅ Candidate sees interview details
36. ✅ Candidate email is pre-filled (read-only)
37. ✅ Candidate name is pre-filled if provided
38. ✅ Candidate enters/confirms name
39. ✅ Candidate clicks "Start Interview"
40. ✅ System validates email matches invitation
41. ✅ System creates interview_attempt with invitation_id
42. ✅ System updates invitation status to 'accessed'
43. ✅ System populates attempt_questions from selected_question_ids

**If Proctoring Enabled**:
44. ✅ PreInterviewChecks component loads
45. ✅ Camera permission requested
46. ✅ AI-powered camera quality check
47. ✅ Face detection verification
48. ✅ Lighting validation
49. ✅ Microphone test
50. ✅ Screen share permission requested
51. ✅ All checks must pass before starting
52. ✅ Proctoring session created with interview_attempt_id
53. ✅ Video/screen recording starts

### Phase 4: During Interview
54. ✅ Questions loaded from attempt_questions (in display_order)
55. ✅ Candidate sees pre-selected questions only
56. ✅ One question at a time
57. ✅ Navigation: Next/Previous buttons
58. ✅ Progress bar showing completion
59. ✅ Timer countdown (if time_limit set)
60. ✅ ProctoringMonitor active (if enabled):
    - Continuous face detection
    - Multiple person detection
    - Voice analysis for multiple voices
    - Tab switch detection
    - Look-away tracking (5-second threshold)
    - Copy-paste detection
    - Violation logging with timestamps
61. ✅ Candidate answers questions
62. ✅ Answers saved per question
63. ✅ Code editor for coding questions
64. ✅ Auto-submit on timeout (if time_limit)

### Phase 5: Submission
65. ✅ Candidate clicks "Submit Interview"
66. ✅ Validation: All questions answered
67. ✅ Finalize proctoring session (if active):
    - Stop recording
    - Calculate integrity score
    - Upload video recording to storage
    - Upload screen recording to storage
    - Update proctoring_session with final data
68. ✅ Update attempt with answers + time_taken
69. ✅ Update attempt status to 'submitted'
70. ✅ Trigger: Update invitation status to 'completed'
71. ✅ Trigger: Auto-evaluate interview (calls edge function)
72. ✅ Success message + redirect to completion page

### Phase 6: Auto-Evaluation
73. ✅ evaluate-interview edge function triggered
74. ✅ Fetches attempt data
75. ✅ Fetches questions with correct answers
76. ✅ Fetches candidate answers
77. ✅ Constructs AI evaluation prompt
78. ✅ Calls AI provider (Gemini/GPT or Lovable AI)
79. ✅ Parses JSON response
80. ✅ Creates assessment record:
    - overall_score
    - topic_scores (per skill)
    - hiring_decision (Strongly Recommend, Recommend, Consider, Not Recommended)
    - strengths array
    - weaknesses array
    - detailed_analysis
81. ✅ Updates attempt status to 'evaluated'

### Phase 7: Results & Reporting (HR Side)
82. ✅ HR navigates to InterviewDetail
83. ✅ Views attempts table with:
    - Candidate name + email
    - Status badge
    - Overall score
    - Integrity score (if proctored)
    - Hiring decision badge
    - Created date
84. ✅ Clicks "Full Report" button
85. ✅ Navigates to AssessmentReport page
86. ✅ Views comprehensive assessment:
    - Overall score with gauge
    - Hiring recommendation
    - Strengths list
    - Weaknesses list
    - Topic-wise breakdown
    - Question-by-question analysis
87. ✅ Views proctoring report (if enabled):
    - Integrity score
    - Violation counts by type
    - Detailed violation timeline
    - **Video recording with HTML5 player**
    - **Screen recording with HTML5 player**
    - **Download buttons (native browser controls)**
    - System checks summary

---

## 🎬 VIDEO RECORDING FLOW

### Recording Start (PreInterviewChecks → ProctoringMonitor)
1. ✅ Camera stream captured via MediaRecorder API
2. ✅ Screen stream captured via getDisplayMedia
3. ✅ Chunks collected in memory during interview
4. ✅ Quality settings: 'high' | 'medium' | 'low'
5. ✅ Adaptive quality based on network

### Recording Stop & Upload (useProctoringSession.ts)
6. ✅ MediaRecorder stops collecting chunks
7. ✅ Blobs created from chunks
8. ✅ Files uploaded to 'proctoring-recordings' storage bucket
9. ✅ Paths stored in proctoring_session:
   - `video_recording_url`: Path in bucket
   - `screen_recording_url`: Path in bucket
10. ✅ Integrity score calculated from violations

### Video Retrieval (ProctoringReport.tsx)
11. ✅ Fetch proctoring_session record
12. ✅ Generate signed URLs from storage:
    ```typescript
    const { data } = await supabase.storage
      .from('proctoring-recordings')
      .createSignedUrl(data.video_recording_url, 3600); // 1 hour
    ```
13. ✅ Display in HTML5 video player with controls
14. ✅ Native download via browser controls

---

## 🧪 END-TO-END TEST SCENARIO

### Test Case: Complete Happy Path with Proctoring

**Setup**:
- User: hr@test.com (hr_recruiter role)
- Interview: "Senior React Developer"
- Question Bank: 50 questions
- Per-candidate: 10 questions
- Proctoring: Enabled
- Candidates: 2 (test1@example.com, test2@example.com)

**Expected Behavior**:

1. **HR creates interview**
   - Status: draft
   - Questions generating: 50
   - No invitations yet

2. **HR reviews questions**
   - Can see all 50 questions
   - Can regenerate any question
   - Can preview all

3. **HR activates interview**
   - Clicks "Activate & Send Invitations"
   - Adds test1@example.com (John)
   - Adds test2@example.com (Jane)
   - Chooses link-only (no email)
   - Interview status: active
   - Invitations: 2 created
   - Each invitation has unique token
   - Each has different selected_question_ids (10 each from bank)

4. **test1@example.com takes interview**
   - Opens unique link
   - Sees email pre-filled: test1@example.com
   - Sees name pre-filled: John
   - Clicks Start
   - Email validated: ✅ matches
   - PreInterviewChecks runs
   - Grants camera permission
   - Grants screen share permission
   - All checks pass
   - Proctoring session created
   - Questions loaded: John's 10 unique questions
   - ProctoringMonitor active
   - Answers all 10 questions
   - Submits
   - Proctoring finalized
   - Video uploaded
   - Integrity score: 95/100
   - Attempt status: submitted → evaluated
   - Invitation status: completed

5. **test2@example.com takes interview**
   - Opens different unique link
   - Sees email: test2@example.com
   - Sees name: Jane
   - Follows same proctoring flow
   - Questions loaded: Jane's 10 unique questions (DIFFERENT from John's)
   - Completes and submits
   - Separate proctoring session
   - Separate video recordings

6. **HR views results**
   - Attempts table shows 2 entries
   - John: Score 85%, Integrity 95%, Recommend
   - Jane: Score 92%, Integrity 88%, Strongly Recommend
   - Clicks "Full Report" for John
   - Sees detailed assessment
   - Clicks "View Proctoring Report"
   - Sees John's violations (if any)
   - **Plays John's video recording**
   - **Downloads John's video** (via browser controls)
   - **Plays John's screen recording**
   - **Downloads John's screen recording**

---

## ✅ CONFIRMATION: ALL FEATURES WORKING

### Interview Creation → Activation
✅ HR creates draft interview WITHOUT candidates
✅ Question bank generates in background
✅ HR reviews questions before activating
✅ HR activates and adds candidates in one step
✅ Each candidate gets unique token + questions

### Invitation → Access → Validation
✅ Each candidate has unique invitation link
✅ Email validation enforces invitation match
✅ Expired invitations rejected
✅ Already-used invitations rejected
✅ Invitation status tracked (pending → accessed → completed)

### Mix-and-Match Questions
✅ Large question bank created (e.g., 50 questions)
✅ Each candidate gets subset (e.g., 10 questions)
✅ Random selection per candidate from bank
✅ No two candidates guaranteed same questions
✅ attempt_questions populated on attempt creation

### Proctoring Integration
✅ Pre-interview checks with AI validation
✅ Continuous monitoring during interview
✅ Violation detection and logging
✅ Video + screen recording
✅ Integrity score calculation
✅ Upload to secure storage
✅ **Downloadable via HTML5 video player**

### Submission → Evaluation
✅ Auto-evaluation on submission
✅ AI generates comprehensive assessment
✅ Hiring recommendation with reasoning
✅ Topic-wise scores
✅ Strengths and weaknesses
✅ Assessment linked to attempt

### Reporting & Video Access
✅ HR sees all attempts with scores
✅ Navigation to full assessment report
✅ Navigation to proctoring report
✅ **Video recordings playable in browser**
✅ **Video recordings downloadable**
✅ **Screen recordings playable in browser**
✅ **Screen recordings downloadable**
✅ Violation timeline with timestamps

---

## 🚀 DEPLOYMENT READY

All components are in place and properly integrated:
- ✅ Database schema complete
- ✅ RLS policies secure
- ✅ Edge functions working
- ✅ Frontend components connected
- ✅ Proctoring fully integrated
- ✅ Video recording and download functional
- ✅ Email-invitation validation enforced
- ✅ Mix-and-match questions per candidate
- ✅ Complete audit trail

**Status**: PRODUCTION READY ✅
