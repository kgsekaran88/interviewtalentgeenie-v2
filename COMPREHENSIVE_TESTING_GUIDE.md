# Comprehensive Testing Guide - All Functionalities

## 🎯 Complete Application Testing

This guide provides step-by-step testing procedures for **ALL** application functionalities, including security, user flows, and edge cases.

---

## Table of Contents
1. [Test Environment Setup](#test-environment-setup)
2. [Authentication & User Management](#authentication--user-management)
3. [Interview Creation & Management](#interview-creation--management)
4. [Candidate Interview Flow](#candidate-interview-flow)
5. [AI Evaluation & Assessment](#ai-evaluation--assessment)
6. [Navigation & Routing](#navigation--routing)
7. [Edge Functions](#edge-functions)
8. [Database & RLS Testing](#database--rls-testing)
9. [Security Testing](#security-testing)
10. [Performance & Load Testing](#performance--load-testing)

---

## Test Environment Setup

### Required Test Accounts

Create the following test accounts:

| Account | Email | Role | Purpose |
|---------|-------|------|---------|
| Admin User | admin@test.com | admin | Full system access, user management |
| HR User | hr@test.com | hr | Create interviews, view all attempts |
| Interviewer | interviewer@test.com | interviewer | Create interviews |
| Regular Staff | staff@test.com | (none) | Limited access testing |
| Test Candidate 1 | - | anonymous | Take interview flow |
| Test Candidate 2 | - | anonymous | Parallel testing |

### Setup Steps

```bash
1. Clear browser cache and cookies
2. Open application in incognito/private mode
3. Have database access ready for verification
4. Keep DevTools open (Network + Console tabs)
```

---

## 1. Authentication & User Management

### Test 1.1: Staff Sign Up Flow

**Test Case:** New user registration with validation

**Steps:**
1. Navigate to `/auth`
2. Click "Sign Up" tab
3. Test invalid inputs:
   - Empty fields → Should show "Required" errors
   - Invalid email: `notanemail` → "Invalid email"
   - Weak password: `weak` → "Password must be at least 8 characters"
   - Password: `password` → "Must contain uppercase"
   - Password: `Password` → "Must contain number"
   - Password: `Password1` → "Must contain special character"
4. Enter valid credentials:
   - Email: `newuser@test.com`
   - Password: `Password1!`
   - Full Name: `Test User`
5. Click "Sign Up"

**Expected Results:**
- ✅ Form validation works for all fields
- ✅ Weak passwords are rejected with specific error messages
- ✅ Valid credentials create account
- ✅ Redirected to `/dashboard`
- ✅ User profile created in profiles table
- ✅ Session persists on page refresh

**Database Verification:**
```sql
-- Check user was created
SELECT email, created_at FROM auth.users 
WHERE email = 'newuser@test.com';

-- Check profile was created
SELECT * FROM profiles 
WHERE email = 'newuser@test.com';
```

---

### Test 1.2: Staff Sign In Flow

**Test Case:** Existing user login

**Steps:**
1. Sign out if logged in
2. Navigate to `/auth`
3. Test invalid login:
   - Wrong password → "Invalid credentials"
   - Non-existent email → "Invalid credentials"
4. Enter correct credentials
5. Click "Sign In"

**Expected Results:**
- ✅ Invalid credentials show error without revealing which field is wrong (security)
- ✅ Valid credentials authenticate user
- ✅ Redirected to `/dashboard`
- ✅ Session token stored in localStorage
- ✅ User state persists across navigation

**Debug Check:**
```javascript
// In browser console
localStorage.getItem('supabase.auth.token') // Should have JWT
```

---

### Test 1.3: Sign Out Flow

**Test Case:** User sign out

**Steps:**
1. Sign in as any user
2. Click "Sign Out" button
3. Try to navigate to protected routes

**Expected Results:**
- ✅ User signed out successfully
- ✅ Session cleared from localStorage
- ✅ Redirected to `/` (landing page)
- ✅ Attempting to access `/dashboard` redirects to `/auth`

---

### Test 1.4: Role Management (Admin Only)

**Test Case:** Assigning and removing user roles

**Prerequisites:** Sign in as admin user

**Steps:**
1. Navigate to `/users`
2. View all users in the system
3. Select a user (e.g., staff@test.com)
4. Assign role: `interviewer`
5. Verify role appears in user's badges
6. Remove the role
7. Try as non-admin user → Should get 403 or redirect

**Expected Results:**
- ✅ Admin can view `/users` page
- ✅ All users displayed with current roles
- ✅ Can assign roles: admin, hr, interviewer
- ✅ Role appears immediately after assignment
- ✅ Can remove roles
- ✅ Non-admin users cannot access `/users`

**Database Verification:**
```sql
-- Check role was assigned
SELECT u.email, ur.role 
FROM user_roles ur
JOIN profiles u ON u.id = ur.user_id
WHERE u.email = 'staff@test.com';
```

---

## 2. Interview Creation & Management

### Test 2.1: Create Interview - Full Flow

**Test Case:** Complete interview creation with AI question generation

**Prerequisites:** Sign in as user with interviewer/hr/admin role

**Steps:**
1. Navigate to `/create-interview`
2. Fill in interview details:
   - Title: `Senior Software Engineer Interview`
   - Job Description: (500+ characters describing role, requirements, etc.)
   - Question Count: `15`
   - Time Limit: `45` minutes
3. Adjust difficulty distribution:
   - Easy: 20%
   - Medium: 60%
   - Hard: 20%
4. Add topics:
   - `React` (30%)
   - `TypeScript` (30%)
   - `System Design` (40%)
5. Click "Generate Interview"
6. Wait for AI generation (check loading state)
7. Verify redirected to interview detail page

**Expected Results:**
- ✅ Form validates all required fields
- ✅ Difficulty percentages must sum to 100
- ✅ Topic percentages must sum to 100
- ✅ Loading indicator shows during generation
- ✅ 15 questions generated via AI
- ✅ Questions match specified topics and difficulties
- ✅ Redirected to `/interview/:id`
- ✅ Interview status is 'draft'

**Database Verification:**
```sql
-- Check interview was created
SELECT id, title, status, question_count, creator_id 
FROM interviews 
WHERE title = 'Senior Software Engineer Interview';

-- Check questions were generated
SELECT q.question_text, q.topic, q.difficulty, q.correct_answer
FROM questions q
JOIN interviews i ON i.id = q.interview_id
WHERE i.title = 'Senior Software Engineer Interview'
ORDER BY q.order_index;

-- Verify 15 questions exist
SELECT COUNT(*) FROM questions 
WHERE interview_id = (
  SELECT id FROM interviews 
  WHERE title = 'Senior Software Engineer Interview'
);
```

**Edge Function Log Check:**
```sql
-- Check generate-questions function logs
-- Look for successful AI API call and question parsing
```

---

### Test 2.2: Interview Detail Page

**Test Case:** View and manage interview

**Steps:**
1. Navigate to interview created in Test 2.1
2. Verify all interview details displayed:
   - Title
   - Job description
   - Question count
   - Difficulty distribution (pie chart)
   - Topic distribution
   - Status badge
   - Questions list
3. Click "Activate Interview"
4. Verify share link generated
5. Click "Copy Link"
6. Try archiving and deleting

**Expected Results:**
- ✅ All interview metadata displayed correctly
- ✅ Questions shown with correct order
- ✅ Can activate interview (status changes to 'active')
- ✅ Share link generated (unique random string)
- ✅ Link copied to clipboard
- ✅ Can archive interview
- ✅ Can delete interview (with confirmation)
- ✅ Only creator and admins can delete

---

### Test 2.3: Dashboard - Interview List

**Test Case:** View all interviews on dashboard

**Steps:**
1. Navigate to `/dashboard`
2. View list of interviews
3. Check interview cards show:
   - Title
   - Description
   - Status badge
   - Question count
   - Attempt count
   - Creation date
4. Click on an interview card

**Expected Results:**
- ✅ All user's interviews displayed
- ✅ HR/Admin see ALL interviews (not just their own)
- ✅ Cards show correct metadata
- ✅ Clicking card navigates to detail page
- ✅ Empty state shown when no interviews exist

---

## 3. Candidate Interview Flow

### Test 3.1: Access Interview via Share Link

**Test Case:** Candidate views interview details

**Prerequisites:** Have an active interview with share_link

**Steps:**
1. **In incognito window**, open: `http://localhost:3000/take-interview/{share_link}`
2. Verify interview information displayed:
   - Title
   - TRUNCATED job description (300 chars + "...")
   - Question count
   - Time limit
3. Check network tab for API calls

**Expected Results:**
- ✅ Page loads successfully without authentication
- ✅ Title displayed correctly
- ✅ Only 300 characters of job description shown
- ✅ Full job_description NOT visible
- ✅ Difficulty distribution NOT visible
- ✅ Topic distribution NOT visible
- ✅ Network call to `get_interview_for_candidate` RPC (NOT direct table query)

**Network Verification:**
```javascript
// In DevTools Network tab, find the RPC call
// Payload should be: { share_link_param: 'abc123' }
// Response should NOT include:
// - job_description (full)
// - difficulty_distribution
// - topic_distribution
// - creator_id
```

---

### Test 3.2: Start Interview - Validation

**Test Case:** Candidate info validation

**Steps:**
1. On interview landing page, try starting with invalid data:
   - Empty name → "Name is required"
   - Name: `A` → "At least 2 characters"
   - Empty email → "Email is required"
   - Invalid email: `notvalid` → "Invalid email"
2. Enter valid data:
   - Name: `John Doe`
   - Email: `john.doe@example.com`
3. Click "Start Interview"

**Expected Results:**
- ✅ All validation rules enforced
- ✅ Clear error messages shown
- ✅ Valid data allows proceeding
- ✅ Anonymous sign-in happens automatically
- ✅ Interview attempt created in database
- ✅ Session token generated and stored
- ✅ Questions loaded (without correct answers)
- ✅ Timer starts if time limit set

**Database Verification:**
```sql
-- Check attempt was created
SELECT * FROM interview_attempts 
WHERE candidate_email = 'john.doe@example.com'
ORDER BY created_at DESC
LIMIT 1;

-- Verify session token exists
SELECT session_token, status 
FROM interview_attempts 
WHERE candidate_email = 'john.doe@example.com';

-- Check questions were fetched via RPC (NOT direct SELECT)
-- Look for get_questions_for_candidate in logs
```

**Security Check:**
```sql
-- Verify correct_answer is NOT returned
-- Query via get_questions_for_candidate should NOT include correct_answer field
SELECT * FROM get_questions_for_candidate('interview-uuid-here');
-- Should not have correct_answer column
```

---

### Test 3.3: Answer Questions

**Test Case:** Complete interview with various question types

**Steps:**
1. Answer first question (multiple choice):
   - Select option B
   - Verify selection highlighted
2. Click "Next Question"
3. Answer second question (free text):
   - Enter: `This is my detailed answer explaining the solution...`
4. Navigate back to first question
5. Change answer to option C
6. Navigate through all questions
7. Verify progress bar updates

**Expected Results:**
- ✅ Can select multiple choice options
- ✅ Can enter free text answers
- ✅ Can navigate between questions
- ✅ Answers persist when navigating
- ✅ Can change answers
- ✅ Progress bar shows correct percentage
- ✅ "Previous" disabled on first question
- ✅ "Submit" shown only on last question

---

### Test 3.4: Time Limit Enforcement

**Test Case:** Interview auto-submits at time expiration

**Prerequisites:** Interview with 5-minute time limit

**Steps:**
1. Start interview
2. Note timer countdown in header
3. Answer a few questions
4. Wait for timer to reach 0:00 (or set short time limit for testing)

**Expected Results:**
- ✅ Timer counts down accurately
- ✅ Timer changes color when < 5 minutes remaining (red/warning)
- ✅ Auto-submits when timer reaches 0:00
- ✅ Cannot manually submit after time expires
- ✅ Time taken recorded accurately

---

### Test 3.5: Submit Interview

**Test Case:** Complete submission and evaluation

**Steps:**
1. Complete all questions (or most)
2. Navigate to last question
3. Click "Submit Interview"
4. Wait for submission (loading indicator)
5. Check network tab for edge function call

**Expected Results:**
- ✅ "Submit" button shown on last question
- ✅ Loading indicator during submission
- ✅ Answers saved via `update_attempt_with_session` RPC
- ✅ Status changed to 'submitted'
- ✅ AI evaluation triggered automatically
- ✅ Redirected to `/interview-complete/:attemptId`
- ✅ Completion page shows success message

**Network Verification:**
```javascript
// Should see two calls:
// 1. update_attempt_with_session RPC
// 2. evaluate-interview edge function invocation
```

**Database Verification:**
```sql
-- Check attempt was submitted
SELECT status, answers, time_taken, submitted_at 
FROM interview_attempts 
WHERE candidate_email = 'john.doe@example.com';

-- Check evaluation was created
SELECT * FROM assessments 
WHERE attempt_id = (
  SELECT id FROM interview_attempts 
  WHERE candidate_email = 'john.doe@example.com'
);
```

---

### Test 3.6: Interview Completion Page

**Test Case:** View completion confirmation

**Steps:**
1. After submitting interview, verify completion page
2. Check displayed information:
   - Success message
   - Interview title
   - Time taken
   - Next steps info

**Expected Results:**
- ✅ Success message displayed
- ✅ Interview title shown
- ✅ Time formatted correctly (e.g., "25:30")
- ✅ Next steps clearly explained
- ✅ Cannot navigate back to questions
- ✅ Session cleaned up

---

## 4. AI Evaluation & Assessment

### Test 4.1: AI Evaluation Process

**Test Case:** Automatic assessment generation

**Prerequisites:** Candidate submitted interview

**Steps:**
1. Immediately after submission, check edge function logs
2. Wait ~10-30 seconds for AI evaluation
3. Navigate to interview detail page as creator
4. Click on the attempt
5. View assessment report

**Expected Results:**
- ✅ `evaluate-interview` edge function triggered
- ✅ AI API call successful
- ✅ Assessment created in database
- ✅ Includes:
  - Overall score (0-100)
  - Hiring decision (strong_hire/hire/consider/reject)
  - Strengths array
  - Weaknesses array
  - Topic scores object
  - Detailed analysis paragraph

**Edge Function Logs:**
```sql
-- Check evaluate-interview logs
-- Should see:
-- 1. Fetched attempt with questions
-- 2. Called Lovable AI API
-- 3. Parsed JSON response
-- 4. Inserted assessment
```

**Database Verification:**
```sql
-- Check assessment was created
SELECT 
  a.overall_score,
  a.hiring_decision,
  a.strengths,
  a.weaknesses,
  a.topic_scores,
  a.detailed_analysis
FROM assessments a
JOIN interview_attempts ia ON ia.id = a.attempt_id
WHERE ia.candidate_email = 'john.doe@example.com';
```

---

### Test 4.2: Assessment Report Page

**Test Case:** View detailed assessment

**Prerequisites:** Assessment exists for an attempt

**Steps:**
1. As interview creator, navigate to `/assessment/:id`
2. Verify all assessment details displayed:
   - Overall score (large number)
   - Hiring decision badge
   - Strengths list
   - Weaknesses list
   - Topic-wise scores (chart)
   - Detailed analysis
   - Candidate information
   - Interview details

**Expected Results:**
- ✅ Score displayed prominently
- ✅ Hiring decision shown with appropriate color
- ✅ Strengths listed clearly
- ✅ Weaknesses listed clearly
- ✅ Topic scores shown as bar chart or similar
- ✅ Detailed analysis paragraph readable
- ✅ Candidate name and email shown
- ✅ Interview title shown
- ✅ Only creator/HR/Admin can access

**Authorization Test:**
```
// Try accessing as different candidate
// Should get 403 or redirect
```

---

## 5. Navigation & Routing

### Test 5.1: Landing Page

**Test Case:** Anonymous user landing

**Steps:**
1. Clear all auth data
2. Navigate to `/`
3. Verify content shown:
   - Hero section
   - Features
   - Call to action
4. Click "Get Started" or "Sign In"

**Expected Results:**
- ✅ Landing page loads without auth
- ✅ Professional hero section
- ✅ Clear value proposition
- ✅ "Get Started" navigates to `/auth`

---

### Test 5.2: Protected Routes

**Test Case:** Authentication required

**Routes to Test:**
- `/dashboard`
- `/create-interview`
- `/interview/:id`
- `/assessment/:id`
- `/profile`
- `/users` (admin only)

**Steps:**
1. Sign out completely
2. Try accessing each route directly

**Expected Results:**
- ✅ Redirected to `/auth` for all protected routes
- ✅ After login, redirected to intended destination (deep linking)

---

### Test 5.3: Navigation Bar

**Test Case:** AppNavigation component

**Steps:**
1. Sign in as each role type
2. Verify navigation items shown:
   - Logo (navigates to `/dashboard`)
   - Dashboard link
   - New Interview (if authorized)
   - Users (if admin)
   - Docs
   - User email display
   - Role badges
   - Profile link
   - Sign Out

**Expected Results:**
- ✅ Logo always visible
- ✅ Links shown based on user role
- ✅ Email displayed correctly
- ✅ Role badges visible
- ✅ Active route highlighted
- ✅ All links navigate correctly

---

## 6. Edge Functions

### Test 6.1: generate-questions Function

**Test Case:** AI question generation

**Trigger:** Creating a new interview

**Verify:**
1. Function receives correct payload:
   ```json
   {
     "jobDescription": "...",
     "questionCount": 15,
     "difficultyDistribution": {"easy": 20, "medium": 60, "hard": 20},
     "topicDistribution": {"React": 30, "TypeScript": 30, "System Design": 40}
   }
   ```
2. Calls Lovable AI API
3. Returns array of questions
4. Each question has:
   - question_text
   - topic
   - difficulty
   - options (if multiple choice)
   - correct_answer

**Check Logs:**
```sql
-- Look for:
-- 1. LOVABLE_API_KEY present
-- 2. AI API call successful
-- 3. JSON parsing successful
-- 4. Questions returned
```

---

### Test 6.2: evaluate-interview Function

**Test Case:** Assessment generation

**Trigger:** Interview submission

**Verify:**
1. Function receives `attemptId`
2. Fetches attempt with questions
3. Calls Lovable AI with evaluation prompt
4. Parses assessment JSON
5. Inserts into assessments table

**Check Logs:**
```sql
-- Look for:
-- 1. Attempt fetched successfully
-- 2. AI API call successful
-- 3. JSON parsing successful
-- 4. Assessment inserted
```

---

## 7. Database & RLS Testing

### Test 7.1: Row-Level Security

**Test Case:** Verify RLS policies enforce access control

**Tests:**

```sql
-- Anonymous user tries to view profiles
SET ROLE anon;
SELECT * FROM profiles; -- Should return 0 rows

-- Anonymous user tries to view questions
SELECT * FROM questions; -- Should return 0 rows

-- Anonymous user tries to view interviews directly
SELECT * FROM interviews; -- Should return 0 rows

-- Authenticated user tries to view others' profiles
SET ROLE authenticated;
SET request.jwt.claims.sub = 'user-a-uuid';
SELECT * FROM profiles WHERE id != 'user-a-uuid'; -- Should return 0 rows

-- User tries to view others' interviews
SELECT * FROM interviews WHERE creator_id != 'user-a-uuid'; -- Should return 0 rows (unless HR/admin)
```

---

### Test 7.2: Secure RPC Functions

**Test Case:** Functions enforce security

```sql
-- Test get_interview_for_candidate
-- Should return limited fields only
SELECT * FROM get_interview_for_candidate('valid-share-link');
-- Verify: NO job_description, NO difficulty_distribution, NO topic_distribution

-- Test get_questions_for_candidate
-- Should exclude correct_answer
SELECT * FROM get_questions_for_candidate('valid-interview-uuid');
-- Verify: NO correct_answer field

-- Test get_attempt_by_session
-- Should only return matching session
SELECT * FROM get_attempt_by_session('valid-token');
-- Verify: Returns exactly 1 row with matching token

-- Test with invalid token
SELECT * FROM get_attempt_by_session('invalid-token');
-- Verify: Returns 0 rows
```

---

## 8. Security Testing

### Test 8.1: SQL Injection

**Test Vectors:**
```
' OR '1'='1
'; DROP TABLE interviews; --
' UNION SELECT * FROM profiles --
```

**Apply to:**
- Email fields
- Name fields
- Interview title
- Job description
- Question text
- Answers

**Expected:** All inputs treated as strings, no SQL execution

---

### Test 8.2: XSS Prevention

**Test Vectors:**
```html
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
```

**Apply to:**
- All text inputs
- Rich text fields

**Expected:** Scripts don't execute, HTML escaped

---

### Test 8.3: Authentication Bypass

**Attempts:**
1. Modify JWT in localStorage
2. Access API with no auth header
3. Use expired JWT
4. Use someone else's JWT

**Expected:** All attempts rejected, redirect to auth

---

### Test 8.4: Session Token Security

**Tests:**
1. Generate multiple tokens, verify uniqueness
2. Modify token by 1 character
3. Try using another user's token

**Expected:** Only exact token match works

---

## 9. Performance & Load Testing

### Test 9.1: Large Interview

**Test Case:** Interview with 50 questions

**Steps:**
1. Create interview with 50 questions
2. Take interview as candidate
3. Measure load times
4. Answer all questions
5. Submit

**Metrics:**
- Initial load time < 2 seconds
- Question navigation instant (< 100ms)
- Submission < 5 seconds
- Evaluation complete < 30 seconds

---

### Test 9.2: Multiple Concurrent Candidates

**Test Case:** 10 candidates taking same interview

**Setup:**
1. Create interview
2. Open 10 incognito windows
3. All start interview simultaneously
4. All submit within 1 minute

**Verify:**
- No race conditions
- All attempts recorded
- All evaluations complete
- No data corruption

---

## 10. Regression Testing

### Checklist After Any Code Change

- [ ] Can sign up new user
- [ ] Can sign in existing user
- [ ] Can create interview
- [ ] AI generates questions
- [ ] Can activate interview
- [ ] Can copy share link
- [ ] Candidate can access via link
- [ ] Candidate can start interview
- [ ] Questions load without answers
- [ ] Can answer all question types
- [ ] Timer works correctly
- [ ] Can submit interview
- [ ] AI evaluation completes
- [ ] Can view assessment
- [ ] Can sign out
- [ ] RLS blocks unauthorized access
- [ ] No console errors
- [ ] No network errors

---

## Pass Criteria

### Critical (Must Pass All)
- ✅ Zero ERROR-level security issues
- ✅ All authentication flows work
- ✅ Interview creation succeeds
- ✅ Candidate flow completes
- ✅ AI evaluation generates assessment
- ✅ RLS policies enforce access control
- ✅ No data leaks

### Important (Should Pass Most)
- ✅ Zero WARN-level security issues (except documented exceptions)
- ✅ All navigation works
- ✅ No console errors
- ✅ Performance within acceptable range
- ✅ UI responsive on mobile

### Nice to Have
- ✅ Animations smooth
- ✅ Loading states clear
- ✅ Error messages helpful
- ✅ Empty states informative

---

**Testing Completed:** [Date]
**Tested By:** [Name]
**Environment:** [Development/Staging/Production]
**Pass/Fail:** [Status]
