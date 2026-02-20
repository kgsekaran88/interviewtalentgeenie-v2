# Proctoring Flow End-to-End Test Documentation

## Overview

This document details the comprehensive end-to-end testing procedures for the interview proctoring system, covering recording uploads, integrity score calculations, and violation detection.

---

## Test Environment Setup

### Prerequisites
- Active Supabase/Lovable Cloud connection
- Test user accounts (candidate, hr_recruiter roles)
- Sample interview data
- Browser with camera/microphone permissions
- Storage bucket: `proctoring-recordings` configured

### Test Data
```sql
-- Create test interview
INSERT INTO interviews (id, title, created_by, organization_id)
VALUES ('test-interview-001', 'Test Interview - Proctoring', 'test-user-id', 'test-org-id');

-- Create test candidate
INSERT INTO user_roles (user_id, role, organization_id)
VALUES ('test-candidate-id', 'candidate', 'test-org-id');
```

---

## Test Suite 1: Pre-Interview Checks

### Test Case: PROC-E2E-001 - Camera Setup
**Objective**: Verify camera detection and quality checks  
**Priority**: Critical

**Steps**:
1. Navigate to `/take-interview/test-interview-001`
2. Click "Start Interview"
3. Grant camera permissions when prompted
4. Observe camera feed in preview
5. System checks for:
   - Face detection ✓
   - Adequate lighting (brightness > 50) ✓
   - Single person detected ✓

**Expected Results**:
```javascript
{
  cameraStatus: 'ready',
  faceDetected: true,
  lightingAdequate: true,
  personCount: 1
}
```

**Pass Criteria**: All checks pass, "Continue" button enabled

**Failure Scenarios**:
- No camera: Display "Camera not detected" error
- Dark room: Display "Lighting too dim" warning
- Multiple faces: Display "Multiple persons detected" warning

---

### Test Case: PROC-E2E-002 - Microphone Setup
**Objective**: Verify microphone detection and audio capture  
**Priority**: Critical

**Steps**:
1. Grant microphone permissions
2. Record 3-second audio sample
3. Playback sample to candidate
4. System validates audio input level

**Expected Results**:
```javascript
{
  microphoneStatus: 'ready',
  audioLevelDetected: true,
  recordingSuccessful: true
}
```

**Pass Criteria**: Audio waveform visible, playback audible

---

## Test Suite 2: Recording Capture

### Test Case: PROC-E2E-003 - Video Recording Start
**Objective**: Verify video recording begins when interview starts  
**Priority**: Critical

**Steps**:
1. Complete pre-interview checks
2. Click "Start Interview"
3. Verify MediaRecorder initialized

**Technical Validation**:
```javascript
// In browser console during test
const proctoring = window.__proctoring_state__;
console.log(proctoring.isRecording); // Should be true
console.log(proctoring.streams.video); // MediaStream object
```

**Expected Results**:
- Video recording active
- Session created in `proctoring_sessions` table
- Session status: `active`

**Database Check**:
```sql
SELECT id, session_id, status, started_at
FROM proctoring_sessions
WHERE attempt_id = 'test-interview-001'
AND attempt_type = 'interview';
```

---

### Test Case: PROC-E2E-004 - Screen Recording Start
**Objective**: Verify screen recording captures browser tab  
**Priority**: High

**Steps**:
1. Grant screen sharing permission
2. Select browser tab to share
3. Confirm screen recording started

**Expected Results**:
```javascript
{
  screenRecording: true,
  screenStream: MediaStream { active: true }
}
```

**Visual Verification**: Screen preview shows captured tab

---

## Test Suite 3: Violation Detection

### Test Case: PROC-E2E-005 - Tab Switch Detection
**Objective**: Detect and log tab switching violations  
**Priority**: Critical

**Steps**:
1. Start interview
2. Switch to another browser tab
3. Wait 2 seconds
4. Switch back to interview tab
5. Repeat 3 times

**Expected Results**:
Each tab switch logs a violation:
```sql
SELECT violation_type, severity, COUNT(*)
FROM proctoring_violations
WHERE session_id = 'current-session-id'
GROUP BY violation_type, severity;

-- Expected Output:
-- violation_type | severity | count
-- TAB_SWITCH     | medium   | 3
```

**Frontend Notification**: Toast/warning displayed to candidate

---

### Test Case: PROC-E2E-006 - Look Away Detection
**Objective**: Detect when candidate looks away from screen  
**Priority**: High

**Setup**: Requires face detection enabled

**Steps**:
1. Start interview with camera active
2. Look away from screen for 15 seconds
3. Return gaze to screen

**Expected Results**:
```sql
SELECT violation_type, details->>'duration_seconds'
FROM proctoring_violations
WHERE violation_type = 'LOOK_AWAY';

-- Expected: duration_seconds >= 15
```

**Violation Logged**:
```json
{
  "violation_type": "LOOK_AWAY",
  "severity": "medium",
  "details": {
    "duration_seconds": 15,
    "timestamp": "2025-01-11T10:30:45Z"
  }
}
```

---

### Test Case: PROC-E2E-007 - Multiple Persons Detection
**Objective**: Detect multiple people in camera frame  
**Priority**: Critical

**Steps**:
1. Start interview with solo candidate
2. Have second person enter camera frame
3. Both faces visible for 5 seconds
4. Second person leaves frame

**Expected Results**:
```sql
SELECT violation_type, severity, details
FROM proctoring_violations
WHERE violation_type = 'MULTIPLE_PERSONS';
```

**Violation Details**:
```json
{
  "violation_type": "MULTIPLE_PERSONS",
  "severity": "high",
  "details": {
    "person_count": 2,
    "detection_timestamp": "2025-01-11T10:32:10Z"
  }
}
```

**UI Alert**: Red banner warning displayed

---

### Test Case: PROC-E2E-008 - Copy Attempt Detection
**Objective**: Detect clipboard copy attempts during interview  
**Priority**: Medium

**Steps**:
1. Start interview
2. Highlight interview question text
3. Press Ctrl+C (Windows) or Cmd+C (Mac)
4. Repeat with different content

**Expected Results**:
```sql
SELECT violation_type, COUNT(*)
FROM proctoring_violations
WHERE violation_type = 'COPY_ATTEMPT'
GROUP BY violation_type;

-- Expected: count = 2
```

**Logged Data**:
```json
{
  "violation_type": "COPY_ATTEMPT",
  "severity": "high",
  "details": {
    "copied_text_length": 45,
    "question_id": "q123"
  }
}
```

---

## Test Suite 4: Recording Upload

### Test Case: PROC-E2E-009 - Video Recording Upload
**Objective**: Verify video recording uploads via secure edge function  
**Priority**: Critical

**Flow**:
```
Interview Complete → stopRecording() → uploadRecordings() → Edge Function → Storage
```

**Steps**:
1. Complete interview (or click "Submit")
2. Wait for upload completion (progress indicator)
3. Verify edge function invocation

**Edge Function Call**:
```javascript
// Automatically triggered by useProctoring.ts
const formData = new FormData();
formData.append('sessionId', sessionId);
formData.append('recordingType', 'video');
formData.append('file', videoBlob);

await supabase.functions.invoke('upload-proctoring-recording', {
  body: formData
});
```

**Database Validation**:
```sql
SELECT 
  video_recording_url,
  screen_recording_url,
  recordings_uploaded,
  updated_at
FROM proctoring_sessions
WHERE id = 'test-session-id';

-- Expected:
-- video_recording_url: 'session-123/video-1736596200000.webm'
-- recordings_uploaded: true
```

**Storage Verification**:
```sql
-- Check Supabase Storage
SELECT name, metadata
FROM storage.objects
WHERE bucket_id = 'proctoring-recordings'
AND name LIKE 'test-session-id%';

-- Should return 2 files: video-*.webm, screen-*.webm
```

**File Validation**:
- File type: `video/webm`
- File size: > 0 bytes (not empty)
- Video duration matches interview duration ±10%

---

### Test Case: PROC-E2E-010 - Screen Recording Upload
**Objective**: Verify screen recording uploads separately  
**Priority**: High

**Similar to PROC-E2E-009 but for screen recording**

**Edge Function Call**:
```javascript
formData.append('recordingType', 'screen');
formData.append('file', screenBlob);
```

**Validation**:
```sql
SELECT screen_recording_url
FROM proctoring_sessions
WHERE id = 'test-session-id';

-- Expected: 'session-123/screen-1736596200000.webm'
```

---

### Test Case: PROC-E2E-011 - Upload Failure Handling
**Objective**: Verify graceful handling of upload failures  
**Priority**: Medium

**Scenarios**:
1. **Network Failure**: Disconnect internet before upload
2. **Large File**: Exceed max file size (if configured)
3. **Invalid Auth**: Expired JWT token

**Expected Behavior**:
- Retry logic (up to 3 attempts)
- Error logged to console
- User notified: "Recording upload failed, but your answers are saved"

**Database State**:
```sql
SELECT recordings_uploaded, upload_error
FROM proctoring_sessions
WHERE id = 'test-session-id';

-- Expected:
-- recordings_uploaded: false
-- upload_error: 'Network timeout after 30s'
```

---

## Test Suite 5: Integrity Score Calculation

### Test Case: PROC-E2E-012 - Perfect Score (No Violations)
**Objective**: Verify 100% integrity score with zero violations  
**Priority**: High

**Steps**:
1. Complete interview with NO violations:
   - No tab switches
   - No look-aways
   - No copy attempts
   - Single person throughout

**Expected Calculation**:
```javascript
integrity_score = 100 - (
  (0 * 5) +    // tab_switches
  (0 * 15) +   // multiple_persons
  (0 * 8) +    // look_away
  (0 * 20)     // copy_attempts
) = 100
```

**Database Validation**:
```sql
SELECT 
  integrity_score,
  tab_switches,
  multiple_persons_count,
  look_away_count,
  copy_attempts
FROM proctoring_sessions
WHERE id = 'test-session-id';

-- Expected: integrity_score = 100, all counts = 0
```

---

### Test Case: PROC-E2E-013 - Moderate Violations
**Objective**: Verify score calculation with mixed violations  
**Priority**: Critical

**Test Scenario**:
- 2 tab switches
- 1 look-away (12 seconds)
- 0 multiple persons
- 1 copy attempt

**Expected Calculation**:
```javascript
integrity_score = 100 - (
  (2 * 5) +    // 10 points
  (0 * 15) +   // 0 points
  (1 * 8) +    // 8 points
  (1 * 20)     // 20 points
) = 100 - 38 = 62
```

**Validation**:
```sql
SELECT integrity_score FROM proctoring_sessions WHERE id = 'test-session-id';
-- Expected: 62
```

---

### Test Case: PROC-E2E-014 - Severe Violations (Score Floor)
**Objective**: Verify integrity score never goes below 0  
**Priority**: High

**Test Scenario**:
- 10 tab switches (50 points)
- 3 multiple persons (45 points)
- 5 look-aways (40 points)
- 2 copy attempts (40 points)
- **Total deductions**: 175 points

**Expected Calculation**:
```javascript
integrity_score = Math.max(0, 100 - 175) = 0
```

**Validation**:
```sql
SELECT integrity_score FROM proctoring_sessions WHERE id = 'test-session-id';
-- Expected: 0 (not negative)
```

---

## Test Suite 6: Integration Tests

### Test Case: PROC-E2E-015 - Complete Interview Flow
**Objective**: Full end-to-end proctoring flow  
**Priority**: Critical  
**Duration**: ~10 minutes

**Complete Flow**:
1. **Pre-Interview Setup** (2 min)
   - Grant camera/mic permissions ✓
   - Complete quality checks ✓
   - Start recording ✓

2. **Interview Session** (5 min)
   - Answer 3 questions
   - Trigger 2 controlled violations (tab switch)
   - Verify real-time violation logging ✓

3. **Submit Interview** (1 min)
   - Click "Submit Interview"
   - Recordings stop ✓
   - Upload process begins ✓

4. **Post-Interview Validation** (2 min)
   - Verify uploads complete ✓
   - Check integrity score calculated ✓
   - Confirm session status = 'completed' ✓

**Database Final State**:
```sql
SELECT 
  ps.status,
  ps.integrity_score,
  ps.video_recording_url,
  ps.screen_recording_url,
  ps.recordings_uploaded,
  COUNT(pv.id) as violation_count
FROM proctoring_sessions ps
LEFT JOIN proctoring_violations pv ON ps.id = pv.session_id
WHERE ps.attempt_id = 'test-interview-001'
GROUP BY ps.id;

-- Expected Output:
-- status: completed
-- integrity_score: 90 (100 - 2*5 = 90)
-- video_recording_url: <valid path>
-- screen_recording_url: <valid path>
-- recordings_uploaded: true
-- violation_count: 2
```

**Pass Criteria**: All checkmarks (✓) complete without errors

---

## Test Suite 7: Edge Function Tests

### Test Case: PROC-E2E-016 - Edge Function Authentication
**Objective**: Verify edge function requires valid JWT  
**Priority**: Critical

**Test 1: No Auth Header**
```bash
curl -X POST 'https://interviewai.talentgeenie.com/functions/v1/upload-proctoring-recording' \
  -F 'sessionId=test-123' \
  -F 'recordingType=video' \
  -F 'file=@test-video.webm'

# Expected: 401 Unauthorized
```

**Test 2: Valid Auth Header**
```javascript
const { data, error } = await supabase.functions.invoke(
  'upload-proctoring-recording',
  {
    body: formData,
    headers: {
      Authorization: `Bearer ${validJWT}`
    }
  }
);

// Expected: 200 OK
```

---

### Test Case: PROC-E2E-017 - File Type Validation
**Objective**: Verify edge function rejects invalid file types  
**Priority**: High

**Test Invalid Types**:
```javascript
// Test 1: Upload .txt file as video
const invalidFile = new File(['test'], 'fake.webm', { type: 'text/plain' });
// Expected: 400 "Invalid file type"

// Test 2: Upload .mp4 (unsupported format)
const mp4File = new File([videoData], 'video.mp4', { type: 'video/mp4' });
// Expected: 400 "Invalid file type"

// Test 3: Upload .webm (valid)
const validFile = new File([videoData], 'video.webm', { type: 'video/webm' });
// Expected: 200 OK
```

---

### Test Case: PROC-E2E-018 - File Size Validation
**Objective**: Verify edge function enforces max file size  
**Priority**: Medium

**Limits** (from edge function):
- Video: 100MB max
- Screen: 200MB max

**Tests**:
```javascript
// Test 1: 50MB video (valid)
const video50MB = generateMockVideo(50 * 1024 * 1024);
// Expected: 200 OK

// Test 2: 150MB video (exceeds limit)
const video150MB = generateMockVideo(150 * 1024 * 1024);
// Expected: 400 "File too large"
```

---

## Test Suite 8: Performance Tests

### Test Case: PROC-E2E-019 - Recording Performance
**Objective**: Ensure recording doesn't degrade interview performance  
**Priority**: Medium

**Metrics to Monitor**:
1. CPU usage < 50%
2. Memory usage < 200MB
3. Frame rate maintained at 15-30 FPS
4. No UI lag during typing

**Tools**: Chrome DevTools Performance Monitor

**Pass Criteria**: No performance warnings, smooth UI interaction

---

### Test Case: PROC-E2E-020 - Upload Performance
**Objective**: Verify upload completes in reasonable time  
**Priority**: Medium

**Test Scenarios**:
| File Size | Network | Expected Time |
|-----------|---------|---------------|
| 10MB | Fast 4G | < 30s |
| 50MB | Fast 4G | < 2min |
| 100MB | Slow 3G | < 5min |

**Monitoring**:
```javascript
const startTime = performance.now();
await uploadRecordings();
const duration = performance.now() - startTime;
console.log(`Upload took ${duration}ms`);
```

---

## Test Suite 9: Security Tests

### Test Case: PROC-E2E-021 - Direct Storage Access Prevention
**Objective**: Verify candidates cannot upload directly to storage  
**Priority**: Critical

**Attack Attempt**:
```javascript
// Try to bypass edge function and upload directly
const { error } = await supabase.storage
  .from('proctoring-recordings')
  .upload('malicious-upload.webm', maliciousFile);

// Expected: Error - RLS policy blocks direct upload
console.log(error); // "new row violates row-level security policy"
```

**Pass Criteria**: Upload blocked by RLS policy

---

### Test Case: PROC-E2E-022 - Cross-Session Data Access
**Objective**: Verify users cannot access other sessions' recordings  
**Priority**: Critical

**Test**:
1. UserA completes interview, creates session-A
2. UserB attempts to access session-A data

```sql
-- As UserB
SELECT video_recording_url
FROM proctoring_sessions
WHERE id = 'session-A-id';

-- Expected: Empty result (RLS blocks)
```

**Storage Access Test**:
```javascript
// UserB tries to download UserA's recording
const { data, error } = await supabase.storage
  .from('proctoring-recordings')
  .download('session-A/video.webm');

// Expected: Error - Permission denied
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Supabase project accessible
- [ ] Test user accounts created
- [ ] Sample interview data seeded
- [ ] Storage bucket configured
- [ ] Edge functions deployed

### Manual Test Execution
- [ ] Run PROC-E2E-001 through PROC-E2E-022
- [ ] Document results in test report
- [ ] Capture screenshots for failures
- [ ] Log console errors

### Automated Test Execution
- [ ] Run automated test suite
- [ ] Generate test report
- [ ] Review coverage metrics

### Post-Test Validation
- [ ] All critical tests passed
- [ ] No security vulnerabilities found
- [ ] Performance within acceptable range
- [ ] Database cleanup completed

---

## Test Report Template

```markdown
# Proctoring E2E Test Report

**Date**: 2025-01-11
**Tester**: QA Team
**Environment**: Staging
**Browser**: Chrome 120

## Summary
- **Total Tests**: 22
- **Passed**: 20
- **Failed**: 2
- **Skipped**: 0

## Failed Tests

### PROC-E2E-007 - Multiple Persons Detection
**Status**: Failed  
**Reason**: Face detection not triggering for second person  
**Steps to Reproduce**: See test case details  
**Expected**: 1 violation logged  
**Actual**: 0 violations logged  
**Screenshot**: [attached]  
**Priority**: High - Fix required

## Pass Rate: 90.9%

## Recommendations
1. Investigate face detection algorithm
2. Add unit tests for violation detection
3. Increase coverage for edge cases
```

---

## Continuous Monitoring

### Daily Checks
- Review proctoring session error logs
- Monitor upload success rate (target: >99%)
- Check integrity score distribution

### Weekly Metrics
```sql
-- Weekly integrity score report
SELECT 
  DATE_TRUNC('week', created_at) as week,
  AVG(integrity_score) as avg_score,
  COUNT(*) as sessions,
  COUNT(CASE WHEN integrity_score < 50 THEN 1 END) as flagged_sessions
FROM proctoring_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY week
ORDER BY week DESC;
```

---

**Document Version**: 1.0  
**Last Updated**: January 11, 2025  
**Next Review**: February 11, 2025
