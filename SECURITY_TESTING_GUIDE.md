# Security Testing Guide

## 🧪 Complete Security Testing Procedure

This guide provides step-by-step instructions for testing all security features of the TalentGeenie application.

---

## Test Environment Setup

### Prerequisites
1. Two different browsers (e.g., Chrome and Firefox) or use incognito/private mode
2. At least two test user accounts
3. Database access to verify RLS policies

### Test Accounts Needed
1. **Admin User** - Full system access
2. **HR User** - Can create interviews, view attempts
3. **Interviewer User** - Can create interviews
4. **Regular Staff User** - Limited access
5. **Test Candidate** - Anonymous (no account needed)

---

## Test Suite 1: Authentication & Authorization

### Test 1.1: Staff Sign Up Security
**Purpose:** Verify password complexity requirements

**Steps:**
1. Navigate to `/auth`
2. Switch to "Sign Up" tab
3. Try these invalid passwords:
   - `weak` - Too short
   - `password` - No uppercase/numbers/special chars
   - `Password` - No numbers/special chars
   - `Password1` - No special chars

**Expected Results:**
- ❌ All attempts should fail with validation errors
- ✅ Only `Password1!` (or similar strong password) should succeed

**Pass Criteria:** Weak passwords are rejected with clear error messages

---

### Test 1.2: Staff Sign In Security
**Purpose:** Verify authentication flow

**Steps:**
1. Try signing in with incorrect password
2. Try signing in with non-existent email
3. Sign in with correct credentials

**Expected Results:**
- ❌ Invalid credentials show error message
- ✅ Valid credentials redirect to `/dashboard`
- ✅ User session persists on page refresh

**Pass Criteria:** Only valid credentials allow access

---

### Test 1.3: Role-Based Access Control
**Purpose:** Verify users can only access authorized resources

**Setup:** Create interviews as Admin, HR, and Interviewer users

**Test Matrix:**
| User Role | Create Interview | View Own | View All | Delete Others | Manage Users |
|-----------|-----------------|----------|----------|---------------|--------------|
| Admin     | ✅              | ✅       | ✅       | ✅            | ✅           |
| HR        | ✅              | ✅       | ✅       | ❌            | ❌           |
| Interviewer| ✅             | ✅       | ❌       | ❌            | ❌           |
| Regular   | ❌              | N/A      | ❌       | ❌            | ❌           |

**Steps:**
1. Sign in as each user type
2. Try accessing:
   - `/create-interview`
   - `/dashboard` (check what interviews are visible)
   - `/interview/:id` of another user's interview
   - `/users` (user management page)

**Pass Criteria:** Each role can only access authorized resources

---

## Test Suite 2: Data Exposure Protection

### Test 2.1: Interview Data Exposure via Share Link
**Purpose:** Verify candidates only see limited interview data

**Steps:**
1. Create an interview with detailed job description (1000+ characters)
2. Set difficulty and topic distributions
3. Activate the interview and copy share link
4. **In incognito window**, open the share link

**Expected Results:**
- ✅ Page loads successfully
- ✅ Shows: Title, question count, time limit
- ✅ Shows: ONLY first 300 characters of job description with "..."
- ❌ Does NOT show: Full job description
- ❌ Does NOT show: Difficulty distribution
- ❌ Does NOT show: Topic distribution
- ❌ Does NOT show: Creator information

**Verification Query:**
```sql
-- Check what data is exposed
SELECT * FROM get_interview_for_candidate('your-share-link-here');
```

**Pass Criteria:** Strategic hiring information remains hidden from candidates

---

### Test 2.2: Question Answer Keys Protection
**Purpose:** Verify candidates never see correct answers

**Steps:**
1. Create interview with multiple-choice questions
2. Open share link as candidate
3. Start the interview
4. **Open browser DevTools > Network tab**
5. Look for any API calls containing question data
6. Inspect response payloads

**Expected Results:**
- ✅ Questions are loaded via RPC call: `get_questions_for_candidate`
- ✅ Response contains: question_text, options, topic, difficulty
- ❌ Response does NOT contain: `correct_answer` field

**Verification Query:**
```sql
-- Verify RPC function excludes correct_answer
SELECT * FROM get_questions_for_candidate('interview-uuid-here');
-- Should return questions WITHOUT correct_answer column
```

**Pass Criteria:** Correct answers are never transmitted to frontend

---

### Test 2.3: Candidate PII Protection
**Purpose:** Verify candidate personal information is protected

**Steps:**
1. Candidate A completes an interview
2. Note the session_token from sessionStorage
3. Try accessing candidate data as:
   - Anonymous user (no auth)
   - Different candidate (Candidate B)
   - Staff user (not interview creator)
   - Interview creator (should succeed)

**Expected Results:**
- ❌ Anonymous users cannot query `interview_attempts` directly
- ❌ Other candidates cannot access Candidate A's data
- ❌ Unrelated staff cannot view candidate data
- ✅ Interview creator can view attempt via secure function
- ✅ HR/Admin can view attempts for interviews they're authorized for

**Verification Query:**
```sql
-- This should fail for anonymous users
SELECT * FROM interview_attempts;

-- This should only work with valid session token
SELECT * FROM get_attempt_by_session('session-token-here');
```

**Pass Criteria:** Candidate PII only accessible via secure functions with proper authorization

---

### Test 2.4: Profile Enumeration Protection
**Purpose:** Verify users cannot enumerate other users' profiles

**Steps:**
1. Sign in as User A
2. Try to query profiles table:
   - Direct query (should fail due to RLS)
   - API call to list all profiles
3. Try to access User B's profile by UUID

**Expected Results:**
- ❌ Cannot list all profiles
- ❌ Cannot view other users' profiles
- ✅ Can only view own profile
- ❌ Anonymous users cannot access any profiles

**Verification Query:**
```sql
-- As authenticated user, try to see all profiles
SELECT * FROM profiles;
-- Should only return the current user's profile

-- As anonymous, try to access profiles
-- Should return 0 rows due to RLS policy
```

**Pass Criteria:** Users can only access their own profile data

---

## Test Suite 3: Input Validation & Injection Prevention

### Test 3.1: SQL Injection Prevention
**Purpose:** Verify all inputs are properly sanitized

**Test Vectors:**
```sql
' OR '1'='1
'; DROP TABLE interviews; --
' UNION SELECT * FROM profiles --
admin'--
```

**Steps:**
1. Try these inputs in:
   - Email fields
   - Name fields
   - Job description
   - Question text
   - Answer text

**Expected Results:**
- ✅ All inputs are treated as strings
- ✅ No database errors
- ✅ No unintended data access
- ✅ Inputs are properly escaped

**Pass Criteria:** No SQL injection vulnerabilities

---

### Test 3.2: XSS Prevention
**Purpose:** Verify HTML/JS injection is prevented

**Test Vectors:**
```html
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
javascript:alert('XSS')
<iframe src="javascript:alert('XSS')">
```

**Steps:**
1. Try these inputs in:
   - Interview titles
   - Job descriptions
   - Candidate names
   - Question text
   - Answers

2. View the rendered content

**Expected Results:**
- ✅ Scripts do not execute
- ✅ Content is rendered as text
- ✅ No popups or alerts
- ✅ HTML is properly escaped

**Pass Criteria:** No XSS vulnerabilities

---

### Test 3.3: Input Length Validation
**Purpose:** Verify length limits are enforced

**Test Cases:**
| Field | Min Length | Max Length | Test String |
|-------|-----------|-----------|-------------|
| Email | 3 | 255 | Generate 256 char email |
| Password | 8 | 100 | Generate 101 char password |
| Candidate Name | 2 | 100 | Generate 101 char name |
| Interview Title | 3 | 200 | Generate 201 char title |
| Job Description | 10 | 5000 | Generate 5001 char description |

**Expected Results:**
- ❌ Too short: Validation error
- ❌ Too long: Validation error
- ✅ Within limits: Accepted

**Pass Criteria:** All length limits enforced client and server-side

---

## Test Suite 4: Session & Token Security

### Test 4.1: Session Token Uniqueness
**Purpose:** Verify session tokens are cryptographically secure

**Steps:**
1. Start 10 different interview attempts
2. Collect all session_token values
3. Analyze tokens

**Expected Results:**
- ✅ All tokens are unique
- ✅ Tokens are 32+ characters long
- ✅ Tokens are base64 encoded
- ✅ No predictable patterns

**Verification Query:**
```sql
-- Check token uniqueness and format
SELECT 
  session_token,
  LENGTH(session_token) as token_length,
  id
FROM interview_attempts 
WHERE session_token IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

**Pass Criteria:** All tokens are unique and unpredictable

---

### Test 4.2: Session Token Validation
**Purpose:** Verify only valid tokens grant access

**Steps:**
1. Complete an interview and get session_token
2. Try modifying the token:
   - Change one character
   - Truncate the token
   - Use empty string
   - Use NULL
3. Try using the modified token to:
   - View attempt
   - Update attempt

**Expected Results:**
- ❌ Modified tokens are rejected
- ❌ Invalid tokens return no data
- ✅ Only exact token match works

**Pass Criteria:** Token validation is strict and secure

---

### Test 4.3: Session Cleanup
**Purpose:** Verify sessions are properly cleaned up

**Steps:**
1. Start an interview as candidate
2. Note session data in sessionStorage
3. Complete the interview
4. Navigate away from interview page
5. Check sessionStorage

**Expected Results:**
- ✅ Session token stored during interview
- ✅ Session token removed after completion
- ✅ Anonymous user signed out after completion

**Pass Criteria:** No session data leakage

---

## Test Suite 5: Audit Logging

### Test 5.1: Sensitive Data Access Logging
**Purpose:** Verify audit logs capture sensitive operations

**Steps:**
1. Sign in as Admin
2. View another user's interview attempts
3. View an assessment report
4. Assign a role to a user
5. Check audit logs

**Verification Query:**
```sql
-- Check audit logs
SELECT 
  al.created_at,
  al.action,
  al.table_name,
  p.email as user_email,
  al.metadata
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 20;
```

**Expected Results:**
- ✅ VIEW_CANDIDATE_DATA logged
- ✅ VIEW_ASSESSMENT logged
- ✅ User ID captured
- ✅ Metadata includes relevant details

**Pass Criteria:** All sensitive operations are logged

---

### Test 5.2: Audit Log Access Control
**Purpose:** Verify only admins can view audit logs

**Steps:**
1. Sign in as non-admin user
2. Try to query audit_logs table
3. Sign in as admin
4. Query audit_logs table

**Expected Results:**
- ❌ Non-admins cannot view audit logs
- ✅ Admins can view all audit logs

**Pass Criteria:** Audit logs are admin-only

---

## Test Suite 6: Edge Function Security

### Test 6.1: CORS Configuration
**Purpose:** Verify CORS is properly configured

**Steps:**
1. Make OPTIONS request to edge functions
2. Check CORS headers in response
3. Try calling from unauthorized origin (if applicable)

**Expected Results:**
- ✅ OPTIONS requests handled
- ✅ Proper CORS headers present
- ✅ Authorized origins allowed

**Pass Criteria:** CORS properly configured

---

### Test 6.2: Error Handling
**Purpose:** Verify errors don't expose sensitive info

**Steps:**
1. Trigger various errors in edge functions:
   - Missing API key
   - Invalid input
   - Database errors
2. Check error responses

**Expected Results:**
- ✅ Generic error messages to client
- ✅ Detailed errors in server logs only
- ❌ No stack traces exposed
- ❌ No internal details exposed

**Pass Criteria:** Error handling is secure

---

## Test Suite 7: Business Logic Security

### Test 7.1: Interview Status Transitions
**Purpose:** Verify interview state machine is secure

**Test Cases:**
1. Try to activate draft without questions
2. Try to take interview in 'draft' status
3. Try to take interview in 'archived' status
4. Try to submit answers after time limit

**Expected Results:**
- ❌ Cannot take draft interviews
- ❌ Cannot take archived interviews
- ✅ Can only take 'active' interviews
- ✅ Auto-submit when time expires

**Pass Criteria:** Interview status transitions are enforced

---

### Test 7.2: Time Limit Enforcement
**Purpose:** Verify time limits are enforced

**Steps:**
1. Create interview with 5-minute time limit
2. Start interview
3. Wait for timer to expire
4. Try to submit after expiration

**Expected Results:**
- ✅ Timer counts down
- ✅ Auto-submits at 0:00
- ✅ Cannot manually submit after time
- ✅ Time taken recorded accurately

**Pass Criteria:** Time limits enforced correctly

---

## Test Suite 8: Integration Security

### Test 8.1: End-to-End Security Flow
**Purpose:** Verify complete secure workflow

**Steps:**
1. **Staff:** Create interview with sensitive data
2. **Staff:** Activate and share link
3. **Candidate:** Access via share link
4. **Candidate:** Complete interview
5. **Staff:** View assessment
6. **Admin:** Check audit logs

**Verify At Each Step:**
- Proper authentication
- Data minimization
- Authorization checks
- Audit logging

**Pass Criteria:** Complete secure workflow from creation to assessment

---

## Security Scan Checklist

### Before Production Deployment

- [ ] All ERROR-level security issues resolved
- [ ] All WARN-level issues reviewed and mitigated
- [ ] Leaked password protection enabled
- [ ] Rate limiting implemented
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] Database encryption at rest enabled
- [ ] Backup and recovery tested
- [ ] Security audit completed
- [ ] Penetration testing completed

---

## Continuous Security Testing

### Daily
- [ ] Monitor audit logs for suspicious activity
- [ ] Check for failed authentication attempts

### Weekly
- [ ] Review RLS policies for new tables
- [ ] Check for exposed API keys in code
- [ ] Review edge function logs

### Monthly
- [ ] Run full security test suite
- [ ] Review and update security policies
- [ ] Check for dependency vulnerabilities
- [ ] Review access logs

### Quarterly
- [ ] External security audit
- [ ] Penetration testing
- [ ] Update security documentation
- [ ] Train team on security best practices

---

**Last Updated:** 2025-10-08
**Test Coverage:** Comprehensive
**Risk Level:** Production-Ready
