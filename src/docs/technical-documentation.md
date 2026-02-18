# TalentGeenie Technical Documentation

## Table of Contents
1. [Technology Stack](#technology-stack)
2. [Database Schema](#database-schema)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Endpoints](#api-endpoints)
5. [Edge Functions](#edge-functions)
6. [Storage System](#storage-system)
7. [Security Implementation](#security-implementation)
8. [Performance Optimization](#performance-optimization)

## Technology Stack

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite
- **Language**: TypeScript
- **Routing**: React Router DOM 6.30.1
  - Root path (/) displays Landing page for all users
  - Protected routes require authentication
  - Logo and Home button navigate to Landing page
- **Styling**: Tailwind CSS 3.x with custom design system
- **UI Components**: Shadcn UI + Radix UI primitives
- **State Management**: React Query (TanStack Query 5.x)
- **Forms**: React Hook Form 7.61.1 with Zod validation
- **Icons**: Lucide React 0.462.0

### Backend
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Serverless Functions**: Supabase Edge Functions (Deno runtime)
- **AI Integration**: Lovable AI API

### Development Tools
- **Package Manager**: npm/bun
- **TypeScript**: 5.x
- **Linting**: ESLint
- **Code Quality**: Prettier (via Lovable)

## Database Schema

### Core Tables

#### `profiles`
User profile information linked to auth.users
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```
**Relationships**: 
- One-to-one with auth.users
- One-to-many with user_roles

#### `user_roles`
Role-based access control
```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);
```
**Enum**: app_role (admin, hr, interviewer, contributor, candidate, guest)

#### `interviews`
Interview configuration and metadata
```sql
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  job_description TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 10,
  time_limit INTEGER, -- in minutes, NULL = no limit
  difficulty_distribution JSONB DEFAULT '{"easy": 30, "medium": 50, "hard": 20}',
  topic_distribution JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- draft, active, archived
  share_link TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `questions`
AI-generated interview questions
```sql
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL, -- easy, medium, hard
  correct_answer TEXT, -- for evaluation
  options JSONB, -- for multiple choice
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `interview_attempts`
Candidate attempt tracking
```sql
CREATE TABLE public.interview_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  time_taken INTEGER, -- in seconds
  status TEXT DEFAULT 'in_progress', -- in_progress, submitted, evaluated
  session_token TEXT UNIQUE, -- for candidate authentication
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `assessments`
AI-generated evaluation results
```sql
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES interview_attempts(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER NOT NULL,
  topic_scores JSONB DEFAULT '{}',
  strengths TEXT[],
  weaknesses TEXT[],
  detailed_analysis TEXT,
  hiring_decision TEXT NOT NULL, -- strong_hire, hire, consider, reject
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Important**: This table has a **one-to-one** relationship with `interview_attempts`. When joining in queries, Supabase returns the assessment as an **object**, not an array:

```typescript
// ✅ CORRECT: Access as object
const { data } = await supabase
  .from("interview_attempts")
  .select("*, assessments(*)");

// data[0].assessments.id
// data[0].assessments.overall_score

// ❌ WRONG: Don't access as array
// data[0].assessments[0].id  // This will fail!
```

#### `documentation`
Documentation metadata
```sql
CREATE TABLE public.documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

### Database Functions

#### `has_role(_user_id UUID, _role app_role)`
Security definer function to check user roles
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

#### `has_any_role(_user_id UUID, _roles app_role[])`
Check if user has any of multiple roles
```sql
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;
```

#### `get_user_roles(_user_id UUID)`
Retrieve all roles for a user
```sql
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
$$;
```

#### `get_questions_for_candidate(interview_uuid UUID)`
Secure question retrieval excluding correct answers
```sql
CREATE OR REPLACE FUNCTION public.get_questions_for_candidate(interview_uuid UUID)
RETURNS TABLE(...)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$...$$;
```

#### `create_interview_attempt(p_interview_id UUID, p_candidate_name TEXT, p_candidate_email TEXT)`
Secure attempt creation with validation
```sql
CREATE OR REPLACE FUNCTION public.create_interview_attempt(...)
RETURNS TABLE(attempt_id UUID, session_token TEXT, success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$...$$;
```
**Features**:
- Validates interview exists and is active
- Checks for duplicate attempts by email
- Generates cryptographically secure session token (64-char base64)
- Returns structured success/error response

#### `update_attempt_with_session(token TEXT, attempt_answers JSONB, seconds_taken INTEGER)`
Secure attempt update with session validation and PII protection
```sql
CREATE OR REPLACE FUNCTION public.update_attempt_with_session(...)
RETURNS TABLE(success BOOLEAN, attempt_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$...$$;
```
**Security**:
- Validates session token
- Verifies attempt status is 'in_progress'
- Prevents modification of candidate_email and candidate_name
- Updates answers and time_taken only

#### `get_attempt_by_session(token TEXT)`
Retrieve attempt using session token
```sql
CREATE OR REPLACE FUNCTION public.get_attempt_by_session(token TEXT)
RETURNS SETOF interview_attempts
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$...$$;
```

## Authentication & Authorization

### Authentication Flow

1. **Sign Up**
   ```typescript
   const { data, error } = await supabase.auth.signUp({
     email,
     password,
     options: {
       data: { full_name: validatedData.fullName },
       emailRedirectTo: `${window.location.origin}/interview-management`
     }
   });
   
   // Automatically assign candidate role to new users
   if (data.user) {
     await supabase
       .from('user_roles')
       .insert({
         user_id: data.user.id,
         role: 'candidate',
       });
   }
   ```
   **Note**: Role assignment is handled at the application level in `Auth.tsx` to avoid modifying Supabase-reserved auth schema.

2. **Sign In**
   ```typescript
   const { error } = await supabase.auth.signInWithPassword({
     email,
     password
   });
   ```

3. **Anonymous Sign In** (for candidates)
   ```typescript
   const { data: { user }, error } = await supabase.auth.signInAnonymously();
   ```

4. **Session Management**
   ```typescript
   useEffect(() => {
     const { data: { subscription } } = supabase.auth.onAuthStateChange(
       (event, session) => {
         setSession(session);
         setUser(session?.user ?? null);
       }
     );
     return () => subscription.unsubscribe();
   }, []);
   ```

### Authorization (RBAC)

Role hierarchy:
- **Admin**: Full system access
- **HR**: View all + create interviews
- **Interviewer**: Manage own interviews
- **Contributor**: Read-only access
- **Candidate**: Full platform access with Interview Management page
- **Guest**: Link-only assessment access

Implementation:
```typescript
// Check role client-side
const { data: roles } = await supabase
  .rpc('get_user_roles', { _user_id: user.id });
const isAdmin = roles?.includes('admin');

// RLS policies enforce server-side
CREATE POLICY "Admins can manage all"
  ON table_name FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

## API Endpoints

All data access through Supabase client SDK:

### Interviews
```typescript
// Create
await supabase.from('interviews').insert({ ... });

// Read (with RLS filtering)
await supabase.from('interviews').select('*');

// Update
await supabase.from('interviews').update({ ... }).eq('id', id);

// Delete
await supabase.from('interviews').delete().eq('id', id);
```

### Questions
```typescript
// Secure retrieval for candidates
await supabase.rpc('get_questions_for_candidate', { 
  interview_uuid: id 
});

// Full access for creators
await supabase.from('questions').select('*').eq('interview_id', id);
```

### Attempts
```typescript
// Create attempt
await supabase.from('interview_attempts').insert({
  interview_id,
  candidate_name,
  candidate_email
}).select().single();

// Update with session
await supabase.rpc('update_attempt_with_session', {
  token: sessionToken,
  attempt_answers: answers,
  seconds_taken: timeElapsed
});

// Fetch attempts with assessments (one-to-one join)
const { data } = await supabase
  .from('interview_attempts')
  .select('*, assessments(*)')
  .eq('interview_id', interviewId);

// Access assessment as object (not array!)
const assessmentId = data[0].assessments?.id;
const score = data[0].assessments?.overall_score;
```

## Edge Functions

### extract-skills
Extracts relevant skills from job title and description using AI

**Endpoint**: `/functions/v1/extract-skills`  
**Auth**: Required (JWT verification enabled)  
**Method**: POST

**Request Body**:
```json
{
  "jobTitle": "Senior Data Engineer",
  "jobDescription": "We are looking for a Senior Data Engineer with expertise in..."
}
```

**Response**:
```json
{
  "skills": [
    "SQL",
    "Python",
    "Data Warehousing",
    "ETL Pipelines",
    "Cloud Platforms (AWS/GCP/Azure)",
    "Apache Spark",
    "Data Modeling",
    "Problem Solving",
    "Team Collaboration",
    "Agile Methodologies"
  ]
}
```

**AI Processing**:
- Analyzes job title for role-specific requirements
- Extracts technical skills, tools, and frameworks from job description
- Identifies soft skills and methodologies mentioned or implied
- Generates 10-15 comprehensive, relevant skills
- Prioritizes skills from job description when available
- Falls back to role-based suggestions if description is minimal

**Implementation**:
```typescript
Deno.serve(async (req) => {
  const { jobTitle, jobDescription } = await req.json();
  
  const systemPrompt = "You are a technical recruiter...";
  const prompt = `Extract 10-15 key skills for: ${jobTitle}\n\nJob Description:\n${jobDescription}`;
  
  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    })
  });
  
  return new Response(JSON.stringify({ skills }));
});
```

### generate-questions
Generates interview questions using AI with precise MCQ/descriptive distribution

**Endpoint**: `/functions/v1/generate-questions`  
**Auth**: Required (JWT verification enabled)  
**Method**: POST

**Request Body**:
```json
{
  "jobDescription": "string",
  "questionCount": 10,
  "mcqPercentage": 70,
  "difficultyDistribution": {
    "easy": 30,
    "medium": 50,
    "hard": 20
  },
  "topicDistribution": {
    "SQL": 40,
    "Python": 30,
    "Snowflake": 30
  }
}
```

**Response**:
```json
{
  "questions": [
    {
      "question_text": "string",
      "topic": "string",
      "difficulty": "easy|medium|hard",
      "question_type": "MCQ|Descriptive",
      "correct_answer": "string",
      "options": ["A", "B", "C", "D"] // null for descriptive
    }
  ]
}
```

**MCQ Distribution Logic**:
- 100% MCQ: All questions are multiple choice, distributed by difficulty
- 0% MCQ: All questions are descriptive, distributed by difficulty  
- Mixed: MCQs and descriptive proportionally distributed within each difficulty level
- Example: 10 questions, 70% MCQ, 30% easy, 50% medium, 20% hard
  - Easy: 2 MCQ + 1 descriptive = 3 questions
  - Medium: 4 MCQ + 1 descriptive = 5 questions
  - Hard: 1 MCQ + 1 descriptive = 2 questions

**Implementation**:
```typescript
Deno.serve(async (req) => {
  const { jobDescription, questionCount, ... } = await req.json();
  
  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  return new Response(JSON.stringify({ questions }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### evaluate-interview
Evaluates candidate responses using AI with strict scoring rules

**Endpoint**: `/functions/v1/evaluate-interview`  
**Auth**: Not required (called server-side, uses verify_jwt = false)  
**Method**: POST

**Request Body**:
```json
{
  "attemptId": "uuid"
}
```

**Response**:
```json
{
  "assessment": {
    "overall_score": 85,
    "topic_scores": { "SQL": 90, "Python": 80 },
    "strengths": ["Strong SQL knowledge"],
    "weaknesses": ["Limited Python experience"],
    "detailed_analysis": "...",
    "hiring_decision": "hire"
  }
}
```

**Scoring System**:
- **Point Values**:
  - Easy questions: 10 points
  - Medium questions: 15 points
  - Hard questions: 20 points
- **MCQ Scoring**: Binary (exact match = full points, wrong = 0 points)
- **Descriptive Scoring**: 
  - Correctness: 40%
  - Completeness: 30%
  - Clarity: 30%
- **Overall Score**: (total_points_earned / total_possible_points) × 100
- **Hiring Thresholds**:
  - Strong Hire: 85-100%
  - Hire: 70-84%
  - Consider: 50-69%
  - Reject: 0-49%

**Flow**:
1. Fetch attempt with questions and answers
2. Construct evaluation prompt with strict scoring instructions
3. Include question type (MCQ vs Descriptive) for proper evaluation
4. Call Lovable AI API (gemini-2.5-flash)
5. Parse JSON response
6. Insert assessment into database
7. Update attempt status to 'evaluated'

## Storage System

### Buckets

#### documentation
- **Purpose**: Store documentation PDFs
- **Public**: false (admin-only access)
- **Size Limit**: 10MB
- **Allowed Types**: application/pdf

**Upload**:
```typescript
const { data, error } = await supabase.storage
  .from('documentation')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  });
```

**Download**:
```typescript
const { data, error } = await supabase.storage
  .from('documentation')
  .download(filePath);
```

**Get URL**:
```typescript
const { data } = supabase.storage
  .from('documentation')
  .getPublicUrl(filePath);
// Note: Only works if user has RLS permission
```

## Security Implementation

### Row Level Security (RLS)

All tables have RLS enabled with specific policies:

**Pattern for user-owned resources**:
```sql
CREATE POLICY "Users can manage own resources"
  ON table_name
  FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());
```

**Pattern for role-based access**:
```sql
CREATE POLICY "Admins have full access"
  ON table_name
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

**Pattern for anonymous candidate access**:
```sql
CREATE POLICY "Candidates can update via session"
  ON interview_attempts
  FOR UPDATE
  USING (
    session_token IS NOT NULL 
    AND LENGTH(session_token) > 0
    AND status = 'in_progress'
  );
```

### Session Token Security

Candidates use session tokens instead of full authentication:

1. **Generation**: Auto-generated on attempt creation
   ```sql
   CREATE TRIGGER set_session_token
     BEFORE INSERT ON interview_attempts
     FOR EACH ROW
     EXECUTE FUNCTION set_session_token();
   ```

2. **Validation**: Exact match required
   ```sql
   WHERE session_token = token
   AND session_token IS NOT NULL
   AND LENGTH(session_token) > 0
   ```

3. **Storage**: Client-side in sessionStorage
   ```typescript
   sessionStorage.setItem('interview_session_token', data.session_token);
   ```

4. **Cleanup**: Removed on completion
   ```typescript
   sessionStorage.removeItem('interview_session_token');
   supabase.auth.signOut(); // for anonymous users
   ```

### Input Validation

All user inputs validated using Zod:

```typescript
const interviewSchema = z.object({
  title: z.string().min(1).max(200),
  jobDescription: z.string().min(10).max(5000),
  questionCount: z.number().min(5).max(100),
  timeLimit: z.number().nullable()
});

const validated = interviewSchema.parse(formData);
```

### CORS Configuration

Edge functions include proper CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

## Performance Optimization

### Database Optimization

1. **Indexes**
   ```sql
   CREATE INDEX idx_interviews_creator ON interviews(creator_id);
   CREATE INDEX idx_questions_interview ON questions(interview_id);
   CREATE INDEX idx_attempts_interview ON interview_attempts(interview_id);
   CREATE INDEX idx_attempts_session ON interview_attempts(session_token);
   ```

2. **Query Optimization**
   - Use `.select()` with specific columns
   - Implement pagination for large lists
   - Use `.single()` when expecting one result
   - Minimize joined queries

### Frontend Optimization

1. **Code Splitting**
   - Route-based code splitting via React Router
   - Lazy loading for heavy components

2. **State Management**
   - React Query for server state caching
   - Automatic background refetching
   - Optimistic updates where appropriate

3. **Asset Optimization**
   - Tailwind CSS purging
   - Image optimization via Vite
   - Tree-shaking for unused code

### Caching Strategy

1. **React Query Configuration**
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
         cacheTime: 10 * 60 * 1000, // 10 minutes
       },
     },
   });
   ```

2. **Storage Caching**
   ```typescript
   cacheControl: '3600' // 1 hour
   ```

---

**Version**: 1.0  
**Last Updated**: 2025  
**Document Type**: Technical Documentation
