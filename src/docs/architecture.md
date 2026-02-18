# TalentGeenie Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Scalability Design](#scalability-design)
7. [Technology Decisions](#technology-decisions)

## System Overview

TalentGeenie is a modern, cloud-native web application designed to streamline the technical interview process using AI-powered question generation and assessment. The system follows a serverless architecture pattern with clear separation of concerns between presentation, business logic, and data layers.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          React SPA (TypeScript + Vite)               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │  │
│  │  │   Pages    │  │ Components │  │    Hooks     │  │  │
│  │  └────────────┘  └────────────┘  └──────────────┘  │  │
│  │         │              │                 │           │  │
│  │         └──────────────┴─────────────────┘           │  │
│  │                        │                              │  │
│  │              ┌─────────▼─────────┐                   │  │
│  │              │  Supabase Client  │                   │  │
│  │              └─────────┬─────────┘                   │  │
│  └────────────────────────┼──────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
┌───────────▼──────┐  ┌──────▼──────┐  ┌────▼─────────┐
│  Supabase Auth   │  │  Edge Funcs │  │   Storage    │
│  - JWT Tokens    │  │  - AI APIs  │  │  - Docs PDFs │
│  - RLS Policies  │  │  - Deno RT  │  │  - RLS       │
└──────────────────┘  └─────────────┘  └──────────────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   - User Data   │
                    │   - Interviews  │
                    │   - Assessments │
                    └─────────────────┘
```

## Architecture Diagram

### Layer Architecture

```
┌─────────────────────────────────────────────────┐
│           PRESENTATION LAYER                     │
│  ┌──────────────────────────────────────────┐  │
│  │  React Components                         │  │
│  │  - Pages (Interview Management, Create, Detail) │  │
│  │  - Layouts (AppNavigation)               │  │
│  │  - UI Components (shadcn/ui)             │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                     │
                     │ Props, Events, Routing
                     ▼
┌─────────────────────────────────────────────────┐
│            APPLICATION LAYER                     │
│  ┌──────────────────────────────────────────┐  │
│  │  State Management                         │  │
│  │  - React Query (Server State)            │  │
│  │  - React Hooks (Local State)             │  │
│  │                                           │  │
│  │  Business Logic                           │  │
│  │  - Form Validation (Zod)                 │  │
│  │  - Data Transformation                    │  │
│  │  - Error Handling                         │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                     │
                     │ API Calls
                     ▼
┌─────────────────────────────────────────────────┐
│             INTEGRATION LAYER                    │
│  ┌──────────────────────────────────────────┐  │
│  │  Supabase Client SDK                      │  │
│  │  - Auto-generated Types                   │  │
│  │  - Real-time Subscriptions                │  │
│  │  - Storage API                            │  │
│  │  - Auth Client                            │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────┐
│          BACKEND SERVICES LAYER                  │
│  ┌──────────────┐  ┌──────────────────────┐    │
│  │   PostgREST  │  │   Edge Functions     │    │
│  │   - REST API │  │   - AI Integration   │    │
│  │   - RLS      │  │   - Business Logic   │    │
│  └──────────────┘  └──────────────────────┘    │
│  ┌──────────────┐  ┌──────────────────────┐    │
│  │   Auth       │  │   Storage            │    │
│  │   - JWT      │  │   - File Management  │    │
│  │   - Sessions │  │   - Access Control   │    │
│  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────┘
                     │
                     │ SQL
                     ▼
┌─────────────────────────────────────────────────┐
│             DATA LAYER                           │
│  ┌──────────────────────────────────────────┐  │
│  │  PostgreSQL Database                      │  │
│  │  - Tables                                 │  │
│  │  - Functions                              │  │
│  │  - Triggers                               │  │
│  │  - RLS Policies                           │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Component Hierarchy

```
App
├── Routes
│   ├── Landing (/)
│   │   └── Simple Home Page
│   │       ├── Navigation Bar
│   │       │   ├── Logo (navigates to /)
│   │       │   └── Dynamic Actions:
│   │       │       ├── Authenticated: My Interviews + Create Interview
│   │       │       └── Unauthenticated: Sign In + Get Started Free
│   │       ├── Hero Section
│   │       │   ├── Platform Overview
│   │       │   └── Primary CTA:
│   │       │       ├── Authenticated: Create Interview (navigates to /create-interview)
│   │       │       └── Unauthenticated: Get Started Free + Sign In
│   │       └── Features Grid (4 cards)
│   │           ├── AI Question Generation
│   │           ├── Custom Difficulty
│   │           ├── Instant Assessment
│   │           └── Easy Sharing
│   │
│   ├── Auth (/auth)
│   │   ├── Sign In Form
│   │   └── Sign Up Form
│   │
│   ├── Interview Management (/interview-management) [Protected]
│   │   ├── AppNavigation
│   │   │   ├── Logo (navigates to /)
│   │   │   ├── Home Button
│   │   │   ├── Interview Management Button
│   │   │   ├── Learning Dropdown
│   │   │   └── Admin Dropdown (role-based)
│   │   ├── Page Header "Interview Management"
│   │   ├── Interview Cards Grid
│   │   └── Create Interview CTA
│   │
│   ├── CreateInterview (/create-interview) [Protected, Admin/HR/Interviewer Only]
│   │   ├── AppNavigation
│   │   ├── Interview Form
│   │   │   ├── Title Input
│   │   │   ├── Job Description Textarea
│   │   │   ├── AI-Powered Key Skills Section
│   │   │   │   ├── Extracted Skills (AI-generated badges)
│   │   │   │   ├── Skill Input with Autocomplete
│   │   │   │   └── Skill Percentage Sliders
│   │   │   ├── Question Count Slider
│   │   │   ├── MCQ Percentage Slider
│   │   │   ├── Time Limit Slider
│   │   │   └── Difficulty Sliders
│   │   └── AI Generation Trigger
│   │
│   ├── InterviewDetail (/interview/:id) [Protected]
│   │   ├── AppNavigation
│   │   ├── Interview Header
│   │   │   ├── Title & Status Badge
│   │   │   └── Statistics Cards
│   │   ├── Action Buttons
│   │   │   ├── Activate & Generate Link
│   │   │   ├── Copy Share Link
│   │   │   ├── Preview Questions Dialog
│   │   │   ├── Archive
│   │   │   └── Delete
│   │   └── Attempts Table
│   │       └── Assessment Links
│   │
│   ├── TakeInterview (/take-interview/:shareLink) [Public]
│   │   ├── Interview Info Screen
│   │   │   ├── Candidate Form
│   │   │   │   ├── Name Input
│   │   │   │   └── Email Input
│   │   │   └── Interview Details
│   │   └── Interview Screen
│   │       ├── Progress Bar
│   │       ├── Timer Display
│   │       ├── Question Card
│   │       │   ├── Multiple Choice Options
│   │       │   └── Free Text Textarea
│   │       └── Navigation Controls
│   │
│   ├── AssessmentReport (/assessment/:id) [Protected]
│   │   ├── AppNavigation
│   │   ├── Candidate Info Card
│   │   ├── Overall Score Card
│   │   │   ├── Score Progress
│   │   │   └── Hiring Decision Badge
│   │   ├── Topic Scores Grid
│   │   ├── Strengths List
│   │   ├── Weaknesses List
│   │   ├── Detailed Analysis
│   │   └── Download Report Button
│   │
│   ├── Profile (/profile) [Protected]
│   │   ├── AppNavigation
│   │   ├── Personal Info Card
│   │   │   └── Name Update Form
│   │   └── Account Info Card
│   │       ├── Email Display
│   │       └── Member Since
│   │
│   ├── UserManagement (/users) [Admin Only]
│   │   ├── AppNavigation
│   │   ├── Header with Action Buttons
│   │   │   ├── Create User Dialog
│   │   │   └── Assign Role Dialog
│   │   ├── Role Descriptions Card
│   │   ├── Create User Dialog
│   │   │   ├── Full Name Input
│   │   │   ├── Email Input
│   │   │   ├── Password Input
│   │   │   └── Email Validation
│   │   ├── Assign Role Dialog
│   │   │   ├── User Select
│   │   │   └── Role Select
│   │   ├── User List Cards
│   │   │   ├── Role Badges
│   │   │   ├── Remove Role Button
│   │   │   └── Delete User Button
│   │   └── Delete Confirmation Dialog
│   │
│   └── Documentation (/docs) [Admin Only]
│       ├── AppNavigation
│       ├── Upload Documentation Form
│       └── Documentation List
│           └── Download Links
```

### Shared Components

```
components/
├── ui/ (shadcn components)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── select.tsx
│   ├── badge.tsx
│   ├── progress.tsx
│   └── ... (40+ components)
│
└── AppNavigation.tsx
    ├── Logo & Brand (navigates to /)
    ├── Navigation Links
    │   ├── Home (navigates to /)
    │   ├── Interview Management
    │   ├── Learning Dropdown
    │   │   ├── Practice Assessments
    │   │   └── My Learning Plan
    │   └── Admin Dropdown (role-based)
    │       ├── Create Interview (Admin/HR/Interviewer)
    │       ├── User Management (Admin)
    │       ├── Training Management (Admin)
    │       └── Documentation (Admin)
    └── User Menu
        ├── Role Badges
        ├── Profile Link
        └── Sign Out
```

## Data Flow

### Interview Creation Flow

```
User Action: Click "Create Interview"
    │
    ▼
Component: CreateInterview.tsx
    │ User fills form
    │ - Title, Description
    │ - AI extracts 10-15 skills automatically (debounced)
    │ - User clicks suggested skills or adds custom ones
    │ - Question count, MCQ percentage, Time limit
    │ - Difficulty distribution
    │ - Skill distribution (percentages)
    │
    ▼
Edge Function: extract-skills
    │ POST /functions/v1/extract-skills
    │ - Analyzes job title and description
    │ - Returns 10-15 relevant skills
    │ - Includes technical, soft, tools, methodologies
    │
    ▼
Validation: Zod Schema
    │ Validates all inputs
    │ Checks difficulty sums to 100%
    │
    ▼
API Call: supabase.from('interviews').insert()
    │ Creates interview record (status: draft)
    │ Returns interview ID
    │
    ▼
Edge Function: generate-questions
    │ Receives job description & config
    │ Constructs AI prompt
    │ Calls Lovable AI API
    │ Parses JSON response
    │ Returns questions array
    │
    ▼
API Call: supabase.from('questions').insert()
    │ Bulk inserts all questions
    │ Links to interview ID
    │ Sets order_index
    │
    ▼
Navigation: Redirect to /interview/:id
    │
    ▼
Component: InterviewDetail.tsx
    │ Displays new interview
    │ Shows all questions
    │ Enables activation
```

### Candidate Interview Flow

```
Candidate: Opens share link
    │
    ▼
Component: TakeInterview.tsx
    │ Fetches interview by share_link
    │ Validates interview is active
    │
    ▼
Check Authentication: supabase.auth.getUser()
    │ Determines if candidate is logged in
    │
    ▼
If Not Authenticated: Show Registration Form
    │ Candidate enters name & email
    │ Email format validation
    │
    ▼
Auth: Sign up with auto-confirm
    │ Creates permanent auth account
    │ Sets user metadata (full_name)
    │
    ▼
Role Assignment: Application-level assignment
    │ Auth.tsx component assigns 'candidate' role
    │ Inserts into user_roles table after successful signup
    │ No database triggers on auth schema (follows Supabase best practices)
    │ Prevents duplicate role assignments via UNIQUE constraint
    │
    ▼
RPC: get_questions_for_candidate()
    │ Returns questions WITHOUT correct_answer
    │ Security definer function
    │
    ▼
Candidate: Clicks "Start Interview"
    │ Checks for duplicate attempts by email
    │
    ▼
API: Create interview_attempt
    │ Inserts attempt record
    │ Status: 'in_progress'
    │ Uses authenticated user's profile data
    │ Generates session_token (trigger)
    │
    ▼
Session Storage: Store token
    │ sessionStorage.setItem('interview_session_token', token)
    │
    ▼
Candidate: Answers questions
    │ State managed in React
    │ Timer running
    │ Progress tracked
    │
    ▼
Submit: Click "Submit Interview" or Time expires
    │
    ▼
RPC: update_attempt_with_session()
    │ Validates session_token
    │ Updates answers & time_taken
    │ Changes status to 'submitted'
    │
    ▼
Edge Function: evaluate-interview
    │ Fetches attempt with questions
    │ Constructs evaluation prompt
    │ Calls Lovable AI API
    │ Parses assessment JSON
    │
    ▼
API: Insert assessment
    │ Stores scores & analysis
    │ Updates attempt status to 'evaluated'
    │
    ▼
Navigation: Redirect to completion page
    │
    ▼
Session Cleanup: Clear storage
```

### Assessment Viewing Flow

```
User: Clicks "View Report"
    │
    ▼
Component: InterviewDetail.tsx
    │ Fetches attempts with assessments join
    │ .select('*, assessments(*)')
    │
    ▼
Data Structure: One-to-one relationship
    │ assessments returned as OBJECT (not array)
    │ Access: attempt.assessments.id
    │ NOT: attempt.assessments[0].id
    │
    ▼
Button Render: Conditional display
    │ IF attempt.status === 'evaluated'
    │ AND attempt.assessments?.id exists
    │ THEN show "View Report" button
    │
    ▼
Navigation: Click "View Report"
    │ Navigate to /assessment/:assessmentId
    │
    ▼
Component: AssessmentReport.tsx
    │
    ▼
API: Fetch assessment with joins
    │ SELECT assessments.*,
    │        interview_attempts.*,
    │        interviews.*
    │
    ▼
RLS: Verify access
    │ Check if user has permission:
    │ - Is interview creator
    │ - Has 'admin' or 'hr' role
    │
    ▼
Render: Display assessment
    │ - Candidate info
    │ - Overall score
    │ - Topic breakdown
    │ - Strengths & weaknesses
    │ - Detailed analysis
    │ - Hiring decision
    │
    ▼
Download: Generate PDF
    │ Convert HTML to PDF
    │ Trigger browser download
```

## Error Handling Architecture

### Error Message Security

The application implements comprehensive error message sanitization to prevent information disclosure:

**Error Handler Utilities** (`src/lib/error-handler.ts`):
- `getUserFriendlyErrorMessage()`: Converts technical errors to user-friendly messages
- `getAuthErrorMessage()`: Specialized handler for authentication errors
- `getInterviewErrorMessage()`: Specialized handler for interview operations

**Security Features**:
- Masks PostgreSQL/RLS policy violations
- Prevents exposure of database schema information
- Sanitizes error messages containing JSON, arrays, or technical details
- Provides context-appropriate error messages

**Implementation**:
```typescript
// Before (exposed technical details)
description: error.message  // Could show: "new row violates RLS policy..."

// After (user-friendly)
description: getUserFriendlyErrorMessage(error, "Unable to complete operation")
// Shows: "Access denied. You do not have permission to perform this action"
```

## Security Architecture

### Multi-Layer Security Model

```
┌───────────────────────────────────────────────┐
│         CLIENT-SIDE SECURITY                  │
│  - Input validation (Zod)                     │
│  - XSS prevention (React auto-escaping)       │
│  - CSRF protection (SameSite cookies)         │
│  - Secure session storage                     │
└──────────────┬────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────┐
│      AUTHENTICATION LAYER                      │
│  - JWT tokens (Supabase Auth)                 │
│  - Candidate registration (auto-confirm)      │
│  - Session tokens (interview attempts)        │
│  - Automatic token refresh                    │
│  - Email validation for candidates            │
└──────────────┬────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────┐
│       AUTHORIZATION LAYER (RBAC)              │
│  - Role-based access control                  │
│  - Security definer functions                 │
│  - has_role(), has_any_role()                 │
│  - Separate user_roles table                  │
│  - 5 Roles: Admin, HR, Interviewer,           │
│    Contributor, Candidate                     │
└──────────────┬────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────┐
│    ROW LEVEL SECURITY (RLS)                   │
│  - Table-level policies                       │
│  - Column-level filtering                     │
│  - Tenant isolation                           │
│  - Resource ownership checks                  │
└──────────────┬────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────┐
│        DATABASE SECURITY                       │
│  - Encrypted at rest                          │
│  - SSL/TLS for connections                    │
│  - Parameterized queries                      │
│  - No SQL injection vectors                   │
└───────────────────────────────────────────────┘
```

### RLS Policy Examples

#### Interview Access Control
```sql
-- Creators can manage their own
CREATE POLICY "Users can manage own interviews"
  ON interviews FOR ALL
  USING (creator_id = auth.uid());

-- HR and Admin can view all
CREATE POLICY "HR and Admin can view all"
  ON interviews FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['admin', 'hr']));
```

#### Session Token Security
```sql
-- Candidates can only update their attempt
CREATE POLICY "Session token validation"
  ON interview_attempts FOR UPDATE
  USING (
    session_token IS NOT NULL
    AND LENGTH(session_token) > 0
    AND status = 'in_progress'
  )
  WITH CHECK (
    status IN ('in_progress', 'submitted')
    AND session_token = (
      SELECT session_token 
      FROM interview_attempts 
      WHERE id = interview_attempts.id
    )
  );
```

#### Admin-Only Resources
```sql
-- User profiles: Users see own, Admins see all
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- This dual-policy approach enables:
-- 1. Regular users to access their own data
-- 2. Admins to manage all users and assign roles
-- 3. Maintains separation of concerns
```
```sql
-- Documentation access
CREATE POLICY "Only admins"
  ON documentation FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

## Scalability Design

### Horizontal Scalability

The application is designed to scale horizontally:

1. **Stateless Frontend**
   - No server-side sessions
   - All state in database or client
   - Can deploy multiple instances
   - CDN for static assets

2. **Serverless Backend**
   - Edge functions auto-scale
   - No server management
   - Pay-per-execution model
   - Global distribution

3. **Managed Database**
   - Supabase handles scaling
   - Read replicas for performance
   - Connection pooling
   - Automatic backups

### Performance Optimizations

```
┌────────────────────────────────────────┐
│         CLIENT OPTIMIZATIONS           │
│  - Code splitting by route             │
│  - Lazy loading components             │
│  - React Query caching                 │
│  - Tailwind CSS purging                │
│  - Asset optimization                  │
└────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│       DATABASE OPTIMIZATIONS           │
│  - Indexed columns                     │
│  - Efficient queries                   │
│  - Selective column fetching           │
│  - Batch operations                    │
│  - Query result caching                │
└────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│         AI OPTIMIZATIONS               │
│  - Model selection per use case        │
│  - Prompt optimization                 │
│  - Response caching                    │
│  - Timeout handling                    │
│  - Fallback strategies                 │
└────────────────────────────────────────┘
```

### Load Handling

Expected load patterns:

- **Interview Creation**: Low frequency, high compute
- **Question Generation**: Burst traffic, AI-intensive
- **Candidate Access**: High concurrency, read-heavy
- **Assessment View**: Moderate frequency, join-heavy

Scaling strategies:
- Interview creation: Queue system for AI generation
- Candidate access: Read replicas, aggressive caching
- Assessment view: Pre-computed aggregations

## Technology Decisions

### Why React?
- Component reusability
- Large ecosystem
- TypeScript support
- Excellent tooling
- Industry standard

### Why Supabase?
- PostgreSQL (proven, reliable)
- Built-in auth & RLS
- Real-time capabilities
- Serverless functions
- Storage integration
- No infrastructure management

### Why Tailwind CSS?
- Utility-first approach
- Consistent design system
- Small bundle size (purged)
- No CSS-in-JS overhead
- Excellent DX

### Why TypeScript?
- Type safety prevents bugs
- Better IDE support
- Self-documenting code
- Refactoring confidence
- Industry best practice

### Why Edge Functions?
- Serverless (no servers to manage)
- Auto-scaling
- Global distribution
- Pay-per-use
- Deno runtime (modern, secure)

### Why Lovable AI?
- No API key management
- Multiple models supported
- Built-in rate limiting
- Simplified integration
- Cost-effective

---

**Version**: 1.0  
**Last Updated**: 2025  
**Document Type**: Architecture Documentation
