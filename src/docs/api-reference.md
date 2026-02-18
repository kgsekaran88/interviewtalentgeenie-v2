# TalentGeenie - API Reference

## Overview

This document provides complete API reference for all backend endpoints, database functions, and edge functions in TalentGeenie.

## Base URLs

**Frontend**: Your deployed application URL
**Backend API**: `https://your-project.supabase.co`
**Edge Functions**: `https://your-project.supabase.co/functions/v1`

## Authentication

All authenticated requests require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

**Getting JWT Token**:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

## Database Tables API (via Supabase Client)

### Profiles

**Get Current User Profile**:
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();
```

**Update Profile**:
```typescript
const { data, error } = await supabase
  .from('profiles')
  .update({ full_name: 'New Name' })
  .eq('id', userId);
```

### User Roles

**Get User Roles**:
```typescript
const { data, error } = await supabase
  .rpc('get_user_roles', { _user_id: userId });
```

**Check Specific Role**:
```typescript
const { data, error } = await supabase
  .rpc('has_role', { _user_id: userId, _role: 'admin' });
```

**Check Any Role**:
```typescript
const { data, error } = await supabase
  .rpc('has_any_role', { 
    _user_id: userId, 
    _roles: ['admin', 'hr'] 
  });
```

### Interviews

**List All Interviews**:
```typescript
const { data, error } = await supabase
  .from('interviews')
  .select(`
    *,
    interview_attempts (count)
  `)
  .order('created_at', { ascending: false });
```

**Create Interview**:
```typescript
const { data, error } = await supabase
  .from('interviews')
  .insert({
    creator_id: userId,
    title: 'Interview Title',
    job_description: 'Full job description...',
    question_count: 10,
    time_limit: 30,
    difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
    topic_distribution: { SQL: 40, Python: 60 },
    status: 'draft'
  })
  .select()
  .single();
```

**Get Interview Details**:
```typescript
const { data, error } = await supabase
  .from('interviews')
  .select('*')
  .eq('id', interviewId)
  .single();
```

**Update Interview**:
```typescript
const { data, error } = await supabase
  .from('interviews')
  .update({ 
    share_link: shareToken,
    status: 'active'
  })
  .eq('id', interviewId);
```

**Delete Interview**:
```typescript
const { data, error } = await supabase
  .from('interviews')
  .delete()
  .eq('id', interviewId);
```

**Get Interview for Candidate** (No Auth):
```typescript
const { data, error } = await supabase
  .rpc('get_interview_for_candidate', { 
    share_link_param: shareLink 
  });

// Returns:
// {
//   id: UUID,
//   title: string,
//   question_count: number,
//   time_limit: number | null,
//   status: string,
//   share_link: string,
//   job_description_preview: string (300 chars)
// }
```

### Questions

**Get Questions for Interview**:
```typescript
const { data, error } = await supabase
  .from('questions')
  .select('*')
  .eq('interview_id', interviewId)
  .order('order_index');
```

**Get Questions for Candidate** (No Auth, No Answers):
```typescript
const { data, error } = await supabase
  .rpc('get_questions_for_candidate', { 
    interview_uuid: interviewId 
  });

// Returns questions WITHOUT correct_answer field
```

**Insert Questions**:
```typescript
const { data, error } = await supabase
  .from('questions')
  .insert([
    {
      interview_id: interviewId,
      question_text: 'What is SQL?',
      topic: 'SQL',
      difficulty: 'easy',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      order_index: 0
    }
  ]);
```

### Interview Attempts

**Create Attempt** (No Auth):
```typescript
const { data, error } = await supabase
  .from('interview_attempts')
  .insert({
    interview_id: interviewId,
    candidate_name: 'John Doe',
    candidate_email: 'john@example.com',
    status: 'in_progress'
  })
  .select()
  .maybeSingle();

// Returns attempt with auto-generated session_token
```

**Check Existing Attempt**:
```typescript
const { data, error } = await supabase
  .from('interview_attempts')
  .select('id')
  .eq('interview_id', interviewId)
  .eq('candidate_email', email)
  .maybeSingle();
```

**Get Attempt by Session Token**:
```typescript
const { data, error } = await supabase
  .rpc('get_attempt_by_session', { token: sessionToken });
```

**Update Attempt with Session**:
```typescript
const { data, error } = await supabase
  .rpc('update_attempt_with_session', {
    token: sessionToken,
    attempt_answers: answersObject,
    seconds_taken: timeInSeconds
  });

// Returns: { success: boolean, attempt_id: UUID }
```

**List Attempts for Interview**:
```typescript
const { data, error } = await supabase
  .from('interview_attempts')
  .select(`
    *,
    assessments (*)
  `)
  .eq('interview_id', interviewId)
  .order('created_at', { ascending: false });
```

### Assessments

**Get Assessment**:
```typescript
const { data, error } = await supabase
  .from('assessments')
  .select('*')
  .eq('id', assessmentId)
  .maybeSingle();
```

**Get Assessment with Attempt Details**:
```typescript
const { data, error } = await supabase
  .from('assessments')
  .select('*')
  .eq('id', assessmentId)
  .maybeSingle();

// Then fetch attempt separately
const { data: attemptData } = await supabase
  .from('interview_attempts')
  .select('*, interviews(*)')
  .eq('id', assessmentData.attempt_id)
  .single();
```

### Audit Logs

**View Audit Logs** (Admin Only):
```typescript
const { data, error } = await supabase
  .from('audit_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(100);
```

## Edge Functions

### 1. Extract Skills

**Endpoint**: `POST /functions/v1/extract-skills`

**Authentication**: Required

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "jobTitle": "Senior Data Engineer",
  "jobDescription": "We are looking for a Senior Data Engineer with expertise in SQL, Python, and Snowflake..."
}
```

**Response Success** (200):
```json
{
  "skills": [
    "SQL",
    "Python",
    "Snowflake",
    "Data Warehousing",
    "ETL Pipelines",
    "Apache Spark",
    "Cloud Platforms (AWS/GCP)",
    "Data Modeling",
    "Problem Solving",
    "Team Collaboration",
    "Agile Methodologies"
  ]
}
```

**Response Error** (429):
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

**Response Error** (500):
```json
{
  "error": "Failed to extract skills"
}
```

**Example Call**:
```typescript
const { data, error } = await supabase.functions.invoke(
  'extract-skills',
  {
    body: {
      jobTitle: title,
      jobDescription: description
    }
  }
);

if (data?.skills) {
  // Skills array available: data.skills
  // Each skill is a string
}
```

**AI Processing**:
- Analyzes job title for role-specific requirements
- Extracts technical skills from job description
- Identifies soft skills and methodologies
- Returns 10-15 comprehensive, relevant skills
- Prioritizes skills mentioned in job description
- Falls back to role-based suggestions if description is minimal

### 2. Generate Questions

**Endpoint**: `POST /functions/v1/generate-questions`

**Authentication**: Required

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "jobDescription": "Full job description text...",
  "questionCount": 10,
  "difficultyDistribution": {
    "easy": 30,
    "medium": 50,
    "hard": 20
  },
  "topicDistribution": {
    "SQL": 40,
    "Python": 30,
    "AWS": 30
  },
  "mcqPercentage": 70
}
```

**Response Success** (200):
```json
{
  "questions": [
    {
      "question_text": "What is a primary key in SQL?",
      "topic": "SQL",
      "difficulty": "easy",
      "options": [
        "A unique identifier for a row",
        "A foreign key reference",
        "An index",
        "A constraint"
      ],
      "correct_answer": "A unique identifier for a row"
    },
    {
      "question_text": "Explain database normalization",
      "topic": "SQL",
      "difficulty": "hard",
      "options": [],
      "correct_answer": "Process of organizing data to reduce redundancy..."
    }
  ]
}
```

**Response Error** (429):
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

**Response Error** (402):
```json
{
  "error": "Credits exhausted. Please add funds to continue."
}
```

**Response Error** (500):
```json
{
  "error": "Failed to generate questions"
}
```

**Example Call**:
```typescript
const { data, error } = await supabase.functions.invoke(
  'generate-questions',
  {
    body: {
      jobDescription: jobDesc,
      questionCount: 10,
      difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
      topicDistribution: { SQL: 50, Python: 50 },
      mcqPercentage: 70
    }
  }
);
```

### 3. Evaluate Interview

**Endpoint**: `POST /functions/v1/evaluate-interview`

**Authentication**: Required

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "attemptId": "uuid-of-interview-attempt"
}
```

**Response Success** (200):
```json
{
  "assessment": {
    "overall_score": 85,
    "hiring_decision": "hire",
    "strengths": [
      "Strong SQL knowledge",
      "Good understanding of database normalization",
      "Clear communication in answers"
    ],
    "weaknesses": [
      "Limited AWS experience",
      "Could improve on optimization techniques"
    ],
    "topic_scores": {
      "SQL": 90,
      "Python": 80,
      "AWS": 75
    },
    "detailed_analysis": "The candidate demonstrated solid technical knowledge..."
  }
}
```

**Hiring Decision Values**:
- `strong_hire`: Score > 90%
- `hire`: Score 70-90%
- `consider`: Score 50-70%
- `reject`: Score < 50%

**Response Error** (429):
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

**Response Error** (402):
```json
{
  "error": "Credits exhausted. Please add funds to continue."
}
```

**Response Error** (500):
```json
{
  "error": "Interview attempt not found"
}
```

**Example Call**:
```typescript
const { data, error } = await supabase.functions.invoke(
  'evaluate-interview',
  {
    body: { attemptId: attemptId }
  }
);
```

## Database Functions

### Authentication Functions

#### has_role
```sql
SELECT public.has_role(user_id UUID, role app_role) 
RETURNS boolean
```

**Example**:
```sql
SELECT public.has_role('user-uuid-here', 'admin');
```

#### has_any_role
```sql
SELECT public.has_any_role(user_id UUID, roles app_role[])
RETURNS boolean
```

**Example**:
```sql
SELECT public.has_any_role('user-uuid-here', ARRAY['admin', 'hr']::app_role[]);
```

#### get_user_roles
```sql
SELECT * FROM public.get_user_roles(user_id UUID)
RETURNS SETOF app_role
```

**Example**:
```sql
SELECT * FROM public.get_user_roles('user-uuid-here');
```

### Interview Functions

#### get_interview_for_candidate
```sql
SELECT * FROM public.get_interview_for_candidate(share_link TEXT)
RETURNS TABLE(...)
```

**Returns**: Limited interview information (no creator details)

#### get_questions_for_candidate
```sql
SELECT * FROM public.get_questions_for_candidate(interview_uuid UUID)
RETURNS TABLE(...)
```

**Returns**: Questions WITHOUT correct_answer field

#### can_view_interview_attempts
```sql
SELECT public.can_view_interview_attempts(attempt_id UUID)
RETURNS boolean
```

### Session Management Functions

#### generate_session_token
```sql
SELECT public.generate_session_token()
RETURNS TEXT
```

**Returns**: Base64 encoded random token

#### get_attempt_by_session
```sql
SELECT * FROM public.get_attempt_by_session(token TEXT)
RETURNS SETOF interview_attempts
```

#### update_attempt_with_session
```sql
SELECT * FROM public.update_attempt_with_session(
  token TEXT,
  attempt_answers JSONB,
  seconds_taken INTEGER
)
RETURNS TABLE(success boolean, attempt_id UUID)
```

## Error Codes

### HTTP Status Codes

- **200**: Success
- **400**: Bad Request - Invalid input
- **401**: Unauthorized - Missing or invalid auth token
- **402**: Payment Required - AI credits exhausted
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource doesn't exist
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error

### Custom Error Messages

**Authentication**:
- "You must be logged in"
- "Invalid credentials"
- "Session expired"

**Authorization**:
- "Insufficient permissions"
- "Access denied"
- "Admin privileges required"

**Validation**:
- "Invalid input data"
- "Required field missing"
- "Invalid format"

**Business Logic**:
- "Interview not found or not active"
- "Already attempted this interview"
- "Questions not found for interview"
- "Assessment already exists"

**AI Service**:
- "Rate limit exceeded"
- "Credits exhausted"
- "Failed to generate questions"
- "Failed to evaluate interview"

## Rate Limits

### AI Gateway Limits

**Free Tier**:
- Requests per minute: 10
- Requests per hour: 100
- Requests per day: 1000

**Paid Tier**:
- Higher limits based on plan
- Contact support for custom limits

### Database Limits

**Free Tier**:
- Max connections: 50
- Max storage: 500MB
- Max file size: 50MB

**Pro Tier**:
- Max connections: 200+
- Max storage: Unlimited
- Max file size: 5GB

## Webhooks

Currently not implemented. Future consideration for:
- Interview completion notifications
- Assessment ready notifications
- User registration events
- System alerts

## SDK Examples

### Complete Interview Creation Flow

```typescript
// 1. Create interview
const { data: interview, error: interviewError } = await supabase
  .from('interviews')
  .insert({
    creator_id: userId,
    title: 'Senior Developer Interview',
    job_description: fullJobDescription,
    question_count: 20,
    time_limit: 60,
    difficulty_distribution: { easy: 20, medium: 50, hard: 30 },
    topic_distribution: { JavaScript: 40, React: 30, Node: 30 },
    status: 'draft'
  })
  .select()
  .single();

// 2. Generate questions
const { data: questionsData, error: questionsError } = 
  await supabase.functions.invoke('generate-questions', {
    body: {
      jobDescription: fullJobDescription,
      questionCount: 20,
      difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
      topicDistribution: { JavaScript: 40, React: 30, Node: 30 },
      mcqPercentage: 60
    }
  });

// 3. Insert questions
const questionsToInsert = questionsData.questions.map((q, index) => ({
  interview_id: interview.id,
  question_text: q.question_text,
  topic: q.topic,
  difficulty: q.difficulty,
  options: q.options,
  correct_answer: q.correct_answer,
  order_index: index
}));

const { error: insertError } = await supabase
  .from('questions')
  .insert(questionsToInsert);

// 4. Activate interview
const shareToken = Math.random().toString(36).substring(2, 15);
const { error: updateError } = await supabase
  .from('interviews')
  .update({ 
    share_link: shareToken,
    status: 'active'
  })
  .eq('id', interview.id);
```

### Complete Candidate Flow

```typescript
// 1. Get interview details (no auth)
const { data: interviewData } = await supabase
  .rpc('get_interview_for_candidate', { 
    share_link_param: shareLink 
  });

const interview = interviewData[0];

// 2. Check existing attempt
const { data: existingAttempt } = await supabase
  .from('interview_attempts')
  .select('id')
  .eq('interview_id', interview.id)
  .eq('candidate_email', candidateEmail)
  .maybeSingle();

if (existingAttempt) {
  // Already attempted
  return;
}

// 3. Create attempt
const { data: attempt } = await supabase
  .from('interview_attempts')
  .insert({
    interview_id: interview.id,
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    status: 'in_progress'
  })
  .select()
  .maybeSingle();

// Store session token
sessionStorage.setItem('interview_session_token', attempt.session_token);

// 4. Get questions (no answers)
const { data: questions } = await supabase
  .rpc('get_questions_for_candidate', { 
    interview_uuid: interview.id 
  });

// 5. Submit answers
const { data: updateResult } = await supabase
  .rpc('update_attempt_with_session', {
    token: attempt.session_token,
    attempt_answers: answersObject,
    seconds_taken: timeElapsed
  });

// 6. Evaluate (by staff only)
const { data: assessment } = await supabase.functions.invoke(
  'evaluate-interview',
  { body: { attemptId: attempt.id } }
);
```

## Changelog

### Version 1.0.0 (2025)
- Initial API release
- Complete CRUD operations for all entities
- AI-powered question generation
- AI-powered interview evaluation
- Session-based candidate access
- Role-based access control

Version: 1.0
Last Updated: 2025
