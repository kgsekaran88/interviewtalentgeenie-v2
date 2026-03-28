# TalentGeenie — Low-Level Design (LLD)

**Document Version:** 2.0  
**Date:** March 5, 2026  
**Product:** TalentGeenie — AI-Powered Interview & Learning Platform  
**Classification:** Internal / Confidential  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Frontend Architecture Detail](#2-frontend-architecture-detail)
3. [Backend Service Detail](#3-backend-service-detail)
4. [Database Schema Detail](#4-database-schema-detail)
5. [API Design](#5-api-design)
6. [Core Flow Sequence Diagrams](#6-core-flow-sequence-diagrams)
7. [State Management Detail](#7-state-management-detail)
8. [Component Design](#8-component-design)
9. [Security Implementation Detail](#9-security-implementation-detail)
10. [Error Handling Architecture](#10-error-handling-architecture)
11. [Proctoring Engine Detail](#11-proctoring-engine-detail)
12. [File Upload Architecture](#12-file-upload-architecture)
13. [Configuration Management](#13-configuration-management)
14. [Testing Architecture](#14-testing-architecture)

---

## 1. Introduction

### 1.1 Purpose

This Low-Level Design (LLD) document provides the detailed technical design for every component of the TalentGeenie platform. It covers class-level design, data structures, algorithms, API contracts, sequence diagrams, and implementation details.

### 1.2 References

| Document | Location |
|----------|----------|
| Requirements (SRS) | `docs/REQUIREMENTS_DOCUMENT.md` |
| High-Level Design (HLD) | `docs/HIGH_LEVEL_DESIGN.md` |

---

## 2. Frontend Architecture Detail

### 2.1 Application Entry Point & Provider Hierarchy

```
index.html
  └── main.tsx
        └── <React.StrictMode>
              └── <BrowserRouter>
                    └── App.tsx
                          ├── <QueryClientProvider>
                          │     └── TanStack React Query (cache, retry, devtools)
                          ├── <AuthProvider>
                          │     └── AuthContext (user, session, roles)
                          ├── <OrganizationProvider>
                          │     └── OrgContext (selectedOrg, impersonation)
                          ├── <Toaster />           (Sonner notifications)
                          ├── <ErrorBoundary>       (Sentry reporting)
                          └── <Routes>              (React Router v6)
                                ├── Public routes
                                ├── Protected routes
                                │     ├── AdminLayout  → /admin/*
                                │     ├── PartnerLayout → /partner/*
                                │     └── Common pages
                                └── Catch-all (404)
```

### 2.2 Routing Architecture

```
src/App.tsx — Route Definitions
│
├─── PUBLIC ROUTES (No authentication)
│    ├── /                          → Landing
│    ├── /auth                      → Auth (login/register)
│    ├── /auth/verify               → AuthVerify
│    ├── /auth/verify-email         → VerifyEmail
│    ├── /reset-password            → ResetPassword
│    ├── /reset-password/confirm    → ResetPasswordConfirm
│    ├── /take-interview/:shareLink → TakeInterview (lazy)
│    ├── /i/:orgSlug/:slug/:token   → TakeInterview (lazy)
│    ├── /interview-complete/:id    → InterviewComplete
│    ├── /pricing                   → Pricing
│    ├── /learning                  → Certifications
│    ├── /certifications            → Certifications
│    ├── /verify-certificate        → VerifyCertificate
│    └── /partner/onboarding        → PartnerOnboarding
│
├─── PROTECTED ROUTES (Authentication required)
│    ├── /dashboard                 → RoleBasedRedirect
│    ├── /profile                   → Profile
│    ├── /notifications             → Notifications
│    ├── /settings                  → Settings
│    ├── /my-applications           → MyApplications
│    ├── /learning-dashboard        → LearningDashboard
│    ├── /my-learning-plan          → MyLearningPlan
│    └── /my-certificates           → MyCertificates
│
├─── ADMIN ROUTES (/admin/*)
│    │   Wrapper: <AdminLayout> (platform_admin only)
│    │
│    ├── /admin                            → PlatformAdminHub
│    ├── /admin/organizations              → OrganizationsList
│    ├── /admin/user-management            → UnifiedUserManagement
│    ├── /admin/applications               → PartnerApplicationsReview
│    ├── /admin/role-assignment            → RoleAssignment
│    ├── /admin/role-permissions           → RolePermissionsManagement
│    ├── /admin/analytics                  → AdvancedAnalytics
│    ├── /admin/settings                   → Settings
│    ├── /admin/billing                    → BillingManagement
│    ├── /admin/training                   → AdminTraining
│    ├── /admin/learning-management        → PlatformAdminLearning
│    ├── /admin/certification-admin        → CertificationAdmin
│    ├── /admin/certification-analytics    → CertificationAnalytics
│    ├── /admin/certification-configuration→ CertificationConfiguration
│    ├── /admin/ai-configuration           → AIConfiguration
│    ├── /admin/chatbot-management         → ChatbotManagement
│    ├── /admin/testing-hub                → TestingHub
│    ├── /admin/deploy                     → DeploymentConfigurator
│    ├── /admin/plan-management            → PlanManagement
│    ├── /admin/promotions                 → PromotionManagement
│    ├── /admin/learning-plan-management   → LearningPlanManagement
│    ├── /admin/payment-gateways           → PaymentGatewayManagement
│    ├── /admin/email-configuration        → EmailConfiguration
│    ├── /admin/preinterview-logs          → PreInterviewCheckLogs
│    ├── /admin/operation-logs             → InterviewOperationLogs
│    ├── /admin/log-analysis               → LogAnalysis
│    ├── /admin/cost-monitoring            → PartnerCostMonitoring
│    ├── /admin/scheduled-jobs             → ScheduledJobsAdmin
│    ├── /admin/ai-usage-monitoring        → AIUsageMonitoring
│    └── /admin/system-monitoring          → SystemMonitoring
│
├─── PARTNER ROUTES (/partner/*)
│    │   Wrapper: <PartnerLayout>
│    │   Roles: partner_admin, platform_admin, hr_recruiter,
│    │          tech_spoc, billing_contact
│    │
│    ├── /partner                          → PartnerPortal
│    ├── /partner/portal                   → PartnerPortal
│    ├── /partner/dashboard                → UnifiedDashboard
│    ├── /partner/settings                 → OrganizationSettings
│    ├── /partner/analytics                → OrganizationAnalytics
│    ├── /partner/users                    → UnifiedUserManagement
│    ├── /partner/billing                  → PartnerBilling
│    └── /partner/reports                  → PartnerReports
│
└─── RECRUITING ROUTES (/partner/recruiting/*)
     │   Wrapper: <PartnerLayout>
     │   Roles: hr_recruiter, tech_spoc, partner_admin, platform_admin
     │
     ├── /partner/recruiting/jd-builder           → JDBuilderWizard
     ├── /partner/recruiting/create-interview      → CreateInterview
     ├── /partner/recruiting/quick-create          → QuickCreatePreview
     ├── /partner/recruiting/interviews            → Dashboard
     ├── /partner/recruiting/interview/:id         → InterviewDetail
     ├── /partner/recruiting/assessment/:id        → AssessmentReport
     ├── /partner/recruiting/proctoring            → ProctoringDashboard
     ├── /partner/recruiting/proctoring-settings   → ProctoringSettings
     ├── /partner/recruiting/question-repository   → QuestionRepository
     ├── /partner/recruiting/templates             → TemplatesLibrary
     └── /partner/recruiting/report-builder        → ReportBuilder
```

### 2.3 Layout Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ AppLayout                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ AppNavbar (data-component="app-navbar")                     │ │
│ │ ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐  │ │
│ │ │   Logo   │ │  Navigation  │ │  Search  │ │  Profile  │  │ │
│ │ │          │ │  (Role-based)│ │  (Cmd+K) │ │  Menu     │  │ │
│ │ └──────────┘ └──────────────┘ └──────────┘ └──────────┘  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ImpersonationBanner (shown when admin impersonates org)    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ RoleBreadcrumbs (context-aware path)                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                    <Outlet />                                │ │
│ │                 (Page Content)                               │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

AdminLayout extends AppLayout:
  - Checks: user.hasRole('platform_admin')
  - Redirects non-admin to /dashboard

PartnerLayout extends AppLayout:
  - Checks: user.hasAnyRole(['partner_admin', 'hr_recruiter', 
            'tech_spoc', 'billing_contact', 'platform_admin'])
  - Loads organization context
```

### 2.4 ProtectedRoute Component Design

```typescript
// src/components/ProtectedRoute.tsx

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  requiredPermissions?: Permission[];
  redirectTo?: string;
}

// Decision tree:
//
// Is user authenticated?
//   NO  → redirect to /auth
//   YES → Is email verified? (if required)
//           NO  → show VerifyEmail
//           YES → Has required role?
//                   NO  → show AccessDenied / redirect
//                   YES → Has required permission?
//                           NO  → show AccessDenied
//                           YES → render children
```

### 2.5 Lazy Loading Strategy

```
Heavy components loaded via React.lazy():

┌─────────────────────────────────────────────────────────┐
│  EAGERLY LOADED (in main bundle)                        │
│                                                         │
│  • Landing, Auth, Profile, Dashboard                    │
│  • Navigation, Layout components                        │
│  • All UI primitives (shadcn/ui)                        │
│  • Contexts, Hooks, Utils                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  LAZILY LOADED (code-split chunks)                      │
│                                                         │
│  • TakeInterview (MediaPipe, recording, timer)          │
│  • TakeLearningAssessment (similar to TakeInterview)    │
│  • TakeCertification (proctoring + exam engine)         │
│  • ProctoringDashboard (video players, reports)         │
│  • ProctoringSettings (configuration UI)                │
│  • ProctoringTestPage (testing tools)                   │
│                                                         │
│  Wrapped in: <Suspense fallback={<PageLoader />}>       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Backend Service Detail

### 3.1 Supabase Services Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SUPABASE SERVICE TOPOLOGY                            │
│                                                                        │
│  External Traffic                                                      │
│       │                                                                │
│       ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  KONG API GATEWAY (Port 8000)                                    │ │
│  │                                                                   │ │
│  │  Route Config:                                                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │  /auth/v1/*    → GoTrue    (Port 9999)                    │  │ │
│  │  │  /rest/v1/*    → PostgREST (Port 3000)                    │  │ │
│  │  │  /functions/v1/* → Functions (Port 9000)                   │  │ │
│  │  │  /realtime/v1/* → Realtime  (Port 4000)                   │  │ │
│  │  │  /storage/v1/*  → Storage   (Port 5000)                   │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                   │ │
│  │  Auth header:  Authorization: Bearer <JWT>                       │ │
│  │  API key:      apikey: <anon_key | service_role_key>             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────┐  ┌────────────────────┐                        │
│  │  GoTrue (Auth)    │  │  PostgREST (REST)  │                        │
│  │                   │  │                    │                         │
│  │  Endpoints:       │  │  Auto-generated    │                         │
│  │  POST /signup     │  │  REST from schema: │                         │
│  │  POST /token      │  │                    │                         │
│  │  POST /recover    │  │  GET  /table       │                         │
│  │  POST /verify     │  │  POST /table       │                         │
│  │  POST /logout     │  │  PATCH /table      │                         │
│  │  GET  /user       │  │  DELETE /table     │                         │
│  │  PUT  /user       │  │  POST /rpc/fn      │                         │
│  │                   │  │                    │                         │
│  │  Config:          │  │  Uses RLS for all  │                         │
│  │  • JWT secret     │  │  queries          │                         │
│  │  • SMTP settings  │  │                    │                         │
│  │  • Auto-confirm   │  │  Connects via      │                         │
│  │  • Email templates│  │  PgBouncer         │                         │
│  └────────┬──────────┘  └──────────┬─────────┘                        │
│           │                         │                                  │
│  ┌────────┴─────────────────────────┴────────────────────┐            │
│  │                    PgBouncer                           │            │
│  │                                                        │            │
│  │  Mode: transaction                                     │            │
│  │  Pool Size: 20 (per user)                             │            │
│  │  Max Client Connections: 1000                         │            │
│  │  Port: 6432                                           │            │
│  │                                                        │            │
│  │  CRITICAL: "prepared statement" errors require         │            │
│  │  container restart when stale connections accumulate   │            │
│  └────────────────────────┬──────────────────────────────┘            │
│                            │                                           │
│  ┌─────────────────────────┴─────────────────────────────┐            │
│  │                  PostgreSQL 15.8                        │            │
│  │                                                        │            │
│  │  Port: 54322                                           │            │
│  │  Database: postgres                                    │            │
│  │  Schemas: public, auth, storage, extensions           │            │
│  │                                                        │            │
│  │  Key Settings:                                         │            │
│  │  • max_connections: 200                               │            │
│  │  • shared_buffers: 256MB                              │            │
│  │  • effective_cache_size: 1GB                          │            │
│  │  • wal_level: replica                                 │            │
│  └────────────────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Edge Function Architecture

```
supabase/functions/
│
├── _shared/                     # Shared utilities
│   ├── cors.ts                  # CORS headers
│   ├── supabase-client.ts       # Service role client
│   └── validation.ts            # Input validation
│
├── generate-questions/          # AI question generation
│   └── index.ts
│       ├── Input:  { interviewId, config }
│       ├── Process:
│       │   1. Fetch interview from DB
│       │   2. Build prompt from JD + config
│       │   3. Call Gemini 2.5 Flash API
│       │   4. Parse structured JSON response
│       │   5. Validate question count/types/difficulty
│       │   6. Insert questions into DB
│       └── Output: { questions: Question[], count }
│
├── evaluate-interview/          # AI candidate evaluation
│   └── index.ts
│       ├── Input:  { attemptId }
│       ├── Process:
│       │   1. Fetch attempt + questions + answers
│       │   2. Build evaluation prompt
│       │   3. Call Gemini 2.5 Flash API
│       │   4. Parse scores per question
│       │   5. Calculate overall score + CPI
│       │   6. Determine hiring decision
│       │   7. Insert assessment record
│       └── Output: { assessment: Assessment }
│
├── complete-user-signup/        # Post-auth setup
│   └── index.ts
│       ├── Input:  { userId, email }
│       ├── Process:
│       │   1. Check if profile exists
│       │   2. Create profile (email_verified: false)
│       │   3. Insert guest role into user_roles
│       │   4. Initialize onboarding_progress
│       │   5. Send welcome email
│       └── Output: { success: boolean }
│
├── init-proctoring-session/     # Start proctoring
│   └── index.ts
│       ├── Input:  { attemptId, checks }
│       ├── Process:
│       │   1. Create proctoring_session record
│       │   2. Store pre-interview check results
│       │   3. Generate signed upload URLs
│       └── Output: { sessionId, uploadUrls }
│
├── send-interview-invitations/  # Email invitations
│   └── index.ts
│       ├── Input:  { interviewId, candidates[] }
│       ├── Process:
│       │   1. Generate share tokens per candidate
│       │   2. Create invitation records
│       │   3. Build invitation emails
│       │   4. Send via SMTP
│       └── Output: { sent: number, failed: number }
│
└── [100+ more functions...]
```

### 3.3 Edge Function Invocation Pattern

```
Frontend                    supabaseFunctions.ts           Edge Function
   │                              │                            │
   │  invokeFunction('name',      │                            │
   │    { data })                 │                            │
   ├─────────────────────────────>│                            │
   │                              │  1. Get current session    │
   │                              │  2. Check JWT expiry       │
   │                              │     (60s buffer)           │
   │                              │  3. Auto-refresh if needed │
   │                              │  4. Attach Authorization   │
   │                              │     header                 │
   │                              │                            │
   │                              │  supabase.functions.invoke │
   │                              ├───────────────────────────>│
   │                              │                            │
   │                              │  Response { data, error }  │
   │                              │<───────────────────────────│
   │                              │                            │
   │  { data } or throw error     │                            │
   │<─────────────────────────────│                            │
```

---

## 4. Database Schema Detail

### 4.1 Core Tables — Column-Level Design

#### `profiles` Table

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,                -- 2-100 chars, letters/spaces/hyphens/apostrophes
  avatar_url  TEXT,
  phone       TEXT,
  bio         TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  
  -- Email verification
  email_verified BOOLEAN DEFAULT false,
  
  CONSTRAINT profiles_email_check CHECK (length(email) <= 255),
  CONSTRAINT profiles_name_check CHECK (
    full_name IS NULL OR (
      length(full_name) >= 2 AND 
      length(full_name) <= 100 AND 
      full_name ~ '^[a-zA-Z\s''-]+$'
    )
  )
);

-- RLS Policies:
-- SELECT: Users can read own profile; platform_admin reads all
-- UPDATE: Users can update own profile only
-- INSERT: Triggered by complete-user-signup edge function
```

#### `user_roles` Table

```sql
CREATE TABLE user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        app_role NOT NULL,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  is_active   BOOLEAN DEFAULT true,
  
  UNIQUE(user_id, role)
);

-- app_role enum values:
-- 'platform_admin', 'partner_admin', 'hr_recruiter',
-- 'tech_spoc', 'billing_contact', 'guest',
-- Legacy: 'admin', 'hr', 'interviewer', 'contributor',
--         'candidate', 'ta_creator'
```

#### `organizations` Table

```sql
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  logo_url      TEXT,
  industry      TEXT,
  size          TEXT,            -- 'startup', 'small', 'medium', 'large', 'enterprise'
  pricing_model TEXT,
  settings      JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES profiles(id)
);
```

#### `interviews` Table

```sql
CREATE TABLE interviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,       -- 5-200 chars
  job_title             TEXT,
  job_description       TEXT NOT NULL,       -- 50-10,000 chars
  status                TEXT DEFAULT 'active',  -- 'draft', 'active', 'archived'
  question_count        INTEGER NOT NULL,    -- 5-100
  time_limit            INTEGER,             -- 0-180 minutes
  share_link            TEXT UNIQUE,
  skills                TEXT[],              -- Extracted skills array
  difficulty_distribution JSONB,             -- {easy: %, medium: %, hard: %}
  question_type_config  JSONB,               -- {mcq: n, scenario: n, coding: n, descriptive: n}
  topic_distribution    JSONB,               -- {topic: percentage, ...}
  proctoring_enabled    BOOLEAN DEFAULT false,
  expires_at            TIMESTAMPTZ,
  organization_id       UUID REFERENCES organizations(id),
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT interviews_title_length CHECK (length(title) >= 5 AND length(title) <= 200),
  CONSTRAINT interviews_jd_length CHECK (length(job_description) >= 50),
  CONSTRAINT interviews_question_count CHECK (question_count >= 5 AND question_count <= 100)
);
```

#### `questions` Table

```sql
CREATE TABLE questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL,      -- 'mcq', 'scenario', 'coding', 'descriptive'
  difficulty      TEXT NOT NULL,      -- 'easy', 'medium', 'hard'
  topic           TEXT,
  options         JSONB,              -- MCQ: [{label, value}]
  correct_answer  TEXT,               -- HIDDEN from candidates via RLS
  explanation     TEXT,
  code_template   TEXT,               -- For coding questions
  test_cases      JSONB,              -- For coding questions
  is_approved     BOOLEAN DEFAULT true,
  display_order   INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: correct_answer column hidden from candidates
-- Only visible to interview creator / org members with view access
```

#### `interview_attempts` Table

```sql
CREATE TABLE interview_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    UUID NOT NULL REFERENCES interviews(id),
  candidate_email TEXT NOT NULL,       -- IMMUTABLE after creation
  candidate_name  TEXT NOT NULL,       -- IMMUTABLE after creation
  session_token   TEXT NOT NULL,       -- 64-char base64, stored in sessionStorage
  answers         JSONB DEFAULT '{}',  -- {question_uuid: "answer text"}
  status          TEXT DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'timed_out'
  time_taken      INTEGER,             -- seconds (0-86,400)
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  
  -- Prevents duplicate attempts
  UNIQUE(interview_id, candidate_email),
  
  -- PII immutability enforced by WITH CHECK:
  -- UPDATE cannot change candidate_email or candidate_name
);
```

#### `assessments` Table

```sql
CREATE TABLE assessments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL REFERENCES interview_attempts(id),
  overall_score    NUMERIC(5,2),       -- 0.00-100.00
  hiring_decision  TEXT,               -- 'strong_hire', 'hire', 'lean_hire', 'no_hire'
  strengths        TEXT[],
  weaknesses       TEXT[],
  topic_scores     JSONB,              -- {topic: {score, analysis}}
  detailed_analysis JSONB,             -- Per-question analysis
  cpi_technical    NUMERIC(5,2),
  cpi_problem_solving NUMERIC(5,2),
  cpi_communication NUMERIC(5,2),
  cpi_integrity    NUMERIC(5,2),
  created_at       TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(attempt_id)
);
```

### 4.2 Proctoring Tables

#### `proctoring_sessions` Table

```sql
CREATE TABLE proctoring_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id           UUID NOT NULL REFERENCES interview_attempts(id),
  video_url            TEXT,
  screen_recording_url TEXT,
  violations           JSONB DEFAULT '[]',
  integrity_score      NUMERIC(5,2),    -- 0-100
  tab_switch_count     INTEGER DEFAULT 0,
  look_away_count      INTEGER DEFAULT 0,
  face_detection_data  JSONB,
  eye_tracking_data    JSONB,
  voice_analysis_data  JSONB,
  review_status        TEXT DEFAULT 'pending',  -- 'pending', 'reviewed', 'flagged'
  upload_status        TEXT DEFAULT 'pending',  -- 'pending', 'uploading', 'complete', 'failed'
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 Billing Tables

```sql
-- subscription_plans
CREATE TABLE subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  price_monthly_cents INTEGER NOT NULL,    -- In cents (e.g., 9900 = $99.00)
  max_interviews      INTEGER,
  max_users           INTEGER,
  max_ai_usage        INTEGER,             -- AI tokens/month
  features            JSONB DEFAULT '{}',
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- organization_subscriptions
CREATE TABLE organization_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id),
  plan_id           UUID REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status            TEXT DEFAULT 'active',  -- 'active', 'past_due', 'cancelled'
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  interviews_used   INTEGER DEFAULT 0,
  ai_tokens_used    INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Learning Tables

```sql
-- certification_topics
CREATE TABLE certification_topics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  provider       TEXT,              -- 'azure', 'aws', 'gcp', 'databricks', 'snowflake'
  difficulty     TEXT DEFAULT 'intermediate',
  passing_score  INTEGER DEFAULT 70,
  syllabus       JSONB,
  time_limit     INTEGER DEFAULT 60,  -- minutes
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- user_certificates
CREATE TABLE user_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES profiles(id),
  certification_id  UUID REFERENCES certification_topics(id),
  attempt_id        UUID REFERENCES certification_attempts(id),
  verification_code TEXT UNIQUE NOT NULL,
  score             NUMERIC(5,2),
  issued_at         TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ
);
```

### 4.5 Database Functions

```sql
-- Role checking (SECURITY DEFINER, SET search_path = public)
CREATE FUNCTION has_role(uid UUID, required_role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = uid AND role = required_role AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Secure interview creation for candidate
CREATE FUNCTION create_interview_attempt(
  p_interview_id UUID,
  p_candidate_email TEXT,
  p_candidate_name TEXT
) RETURNS TABLE(attempt_id UUID, session_token TEXT) AS $$
DECLARE
  v_token TEXT;
  v_attempt_id UUID;
BEGIN
  -- Generate 64-char base64 session token
  v_token := encode(gen_random_bytes(48), 'base64');
  
  INSERT INTO interview_attempts (interview_id, candidate_email, candidate_name, session_token)
  VALUES (p_interview_id, p_candidate_email, p_candidate_name, v_token)
  RETURNING id INTO v_attempt_id;
  
  RETURN QUERY SELECT v_attempt_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Questions retrieval (hides correct_answer)
CREATE FUNCTION get_questions_for_candidate(p_attempt_id UUID)
RETURNS TABLE(
  id UUID, question_text TEXT, question_type TEXT, 
  difficulty TEXT, topic TEXT, options JSONB,
  code_template TEXT, display_order INTEGER
) AS $$
  SELECT q.id, q.question_text, q.question_type,
         q.difficulty, q.topic, q.options,
         q.code_template, aq.display_order
  FROM attempt_questions aq
  JOIN questions q ON q.id = aq.question_id
  WHERE aq.attempt_id = p_attempt_id
  ORDER BY aq.display_order;
  -- NOTE: correct_answer is NOT returned
$$ LANGUAGE sql SECURITY DEFINER;

-- API key encryption
CREATE FUNCTION encrypt_api_key(plain_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
  SELECT encode(
    encrypt(plain_key::bytea, encryption_key::bytea, 'aes'),
    'base64'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 4.6 Entity Relationship Diagram (Detailed)

```
┌──────────────┐     ┌──────────────┐
│ auth.users   │────>│  profiles    │
│              │ 1:1 │  id (PK/FK)  │
│ id           │     │  email       │
│ email        │     │  full_name   │
│ encrypted_pw │     │  avatar_url  │
└──────────────┘     │  phone, bio  │
                     │  email_verified
                     └──────┬───────┘
                            │
              ┌─────────────┼──────────────┐
              │ 1:N         │ N:M          │ 1:N
              │             │              │
     ┌────────┴───┐   ┌────┴──────┐  ┌────┴─────────────┐
     │ user_roles │   │  org_     │  │ notifications    │
     │            │   │ members   │  │                  │
     │ role (enum)│   │ org_id    │  │ title, body      │
     │ is_active  │   │ user_id   │  │ is_read          │
     └────────────┘   │ status    │  │ type             │
                      └────┬──────┘  └──────────────────┘
                           │ N:1
                  ┌────────┴──────────┐
                  │  organizations    │
                  │                   │
                  │  name, slug       │
                  │  industry, size   │
                  │  settings (JSONB) │
                  │  is_active        │
                  └────────┬──────────┘
                           │ 1:N
          ┌────────────────┼──────────────────┐
          │                │                  │
   ┌──────┴──────┐  ┌─────┴──────────┐  ┌───┴──────────────┐
   │ interviews  │  │ org_subscriptions│  │ usage_tracking  │
   │             │  │                 │  │                  │
   │ title, JD   │  │ plan_id         │  │ interviews_used  │
   │ status      │  │ stripe_sub_id   │  │ ai_tokens_used  │
   │ question_cnt│  │ status          │  │ period           │
   │ time_limit  │  └────┬────────────┘  └──────────────────┘
   │ proctoring  │       │ N:1
   │ skills[]    │  ┌────┴────────────┐
   │ org_id      │  │subscription_plans│
   │ created_by  │  │                 │
   └──────┬──────┘  │ name, price     │
          │         │ max_interviews  │
          │ 1:N     │ max_users       │
  ┌───────┼──────┐  └─────────────────┘
  │       │      │
  │  ┌────┴───┐  │
  │  │questions│  │
  │  │        │  │
  │  │ text   │  │
  │  │ type   │  │
  │  │ diff.  │  │
  │  │ topic  │  │
  │  │ options│  │
  │  │ answer │  │ (hidden via RLS)
  │  └────────┘  │
  │              │
  │  ┌───────────┴──┐     ┌──────────────┐
  │  │ invitations  │     │              │
  │  │              │     │              │
  │  │ candidate_   │     │              │
  │  │ email        │     │              │
  │  │ share_token  │     │              │
  │  │ status       │     │              │
  │  │ expires_at   │     │              │
  │  └──────────────┘     │              │
  │                       │              │
  │  ┌───────────────────┐│              │
  │  │   attempts        ││              │
  │  │                   ││              │
  │  │ candidate_email   ││              │
  │  │ candidate_name    ││              │
  │  │ session_token     ││              │
  │  │ answers (JSONB)   ││              │
  │  │ status            ││              │
  │  │ time_taken        ││              │
  │  └────────┬──────────┘│              │
  │           │ 1:1       │              │
  │  ┌────────┴──────┐    │              │
  │  │  assessments  │    │              │
  │  │               │    │              │
  │  │ overall_score │    │              │
  │  │ hiring_decision│   │              │
  │  │ strengths[]   │    │              │
  │  │ weaknesses[]  │    │              │
  │  │ topic_scores  │    │              │
  │  │ cpi_*         │    │              │
  │  └───────────────┘    │              │
  │           │ 1:1       │              │
  │  ┌────────┴──────────┐│              │
  │  │proctoring_sessions││              │
  │  │                   ││              │
  │  │ video_url         ││              │
  │  │ violations (JSONB)││              │
  │  │ integrity_score   ││              │
  │  │ tab_switch_count  ││              │
  │  │ review_status     ││              │
  │  └───────────────────┘│              │
  └───────────────────────┘              │
```

---

## 5. API Design

### 5.1 REST API (PostgREST — Auto-generated)

All tables are exposed via PostgREST with RLS filtering:

```
BASE: http://localhost:8000/rest/v1

Headers:
  apikey: <anon_key>
  Authorization: Bearer <jwt>
  Content-Type: application/json
  Prefer: return=representation (for INSERT/UPDATE)

GET    /interviews?organization_id=eq.<uuid>&status=eq.active&order=created_at.desc
GET    /interviews?id=eq.<uuid>&select=*,questions(*),interview_invitations(*)
POST   /interviews              { title, job_description, ... }
PATCH  /interviews?id=eq.<uuid>  { status: 'archived' }
DELETE /interviews?id=eq.<uuid>

GET    /profiles?id=eq.<uuid>
PATCH  /profiles?id=eq.<uuid>    { full_name, phone, bio }

GET    /notifications?select=*&order=created_at.desc&is_read=eq.false
PATCH  /notifications?id=eq.<uuid>  { is_read: true }

POST   /rpc/create_interview_attempt        { p_interview_id, p_email, p_name }
POST   /rpc/get_questions_for_candidate      { p_attempt_id }
POST   /rpc/update_attempt_with_session      { p_attempt_id, p_session_token, p_answers }
POST   /rpc/has_role                         { uid, required_role }
POST   /rpc/can_user_retake_certification    { user_id, cert_id }
```

### 5.2 Edge Function API

```
BASE: http://localhost:8000/functions/v1

Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

POST /generate-questions
  Body: { interviewId: string, config?: object }
  Response: { questions: Question[], count: number }

POST /evaluate-interview
  Body: { attemptId: string }
  Response: { assessment: Assessment }

POST /send-interview-invitations
  Body: { interviewId: string, candidates: [{email, name}] }
  Response: { sent: number, failed: number }

POST /init-proctoring-session
  Body: { attemptId: string, checks: PreInterviewChecks }
  Response: { sessionId: string, uploadUrls: {...} }

POST /generate-job-description
  Body: { jobTitle: string, industry?: string, requirements?: string[] }
  Response: { description: string, skills: string[] }

POST /complete-user-signup
  Body: { userId: string, email: string }
  Response: { success: boolean }

POST /generate-certificate-pdf
  Body: { certificateId: string }
  Response: { pdfUrl: string }
```

### 5.3 Realtime Subscriptions

```typescript
// Notification subscription
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Show toast notification
  })
  .subscribe();

// Interview attempt status
supabase
  .channel(`attempt-${attemptId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'interview_attempts',
    filter: `id=eq.${attemptId}`
  }, (payload) => {
    // Update UI on status change
  })
  .subscribe();
```

---

## 6. Core Flow Sequence Diagrams

### 6.1 Interview Creation & Question Generation Flow

```
HR Recruiter         CreateInterview        Edge Function        Gemini AI       Database
     │                    │                      │                   │              │
     │  Fill form:        │                      │                   │              │
     │  title, JD,        │                      │                   │              │
     │  questions config  │                      │                   │              │
     ├───────────────────>│                      │                   │              │
     │                    │                      │                   │              │
     │                    │  Validate (Zod):     │                   │              │
     │                    │  title 5-200 chars   │                   │              │
     │                    │  JD 50-10k chars     │                   │              │
     │                    │  questionCount 5-100 │                   │              │
     │                    │  types sum = total   │                   │              │
     │                    │  topics sum = 100%   │                   │              │
     │                    │                      │                   │              │
     │                    │  INSERT interview    │                   │              │
     │                    ├──────────────────────┼───────────────────┼─────────────>│
     │                    │<─────────────────────┼───────────────────┼──────────────│
     │                    │  interview.id        │                   │              │
     │                    │                      │                   │              │
     │                    │  POST /functions/v1/ │                   │              │
     │                    │  generate-questions  │                   │              │
     │                    ├─────────────────────>│                   │              │
     │                    │                      │                   │              │
     │                    │                      │  Build prompt:    │              │
     │                    │                      │  JD + config +    │              │
     │                    │                      │  type distribution│              │
     │                    │                      │                   │              │
     │                    │                      │  POST /v1/models/ │              │
     │                    │                      │  gemini-2.5-flash │              │
     │                    │                      ├──────────────────>│              │
     │                    │                      │                   │              │
     │                    │                      │  Structured JSON  │              │
     │                    │                      │  questions array  │              │
     │                    │                      │<──────────────────│              │
     │                    │                      │                   │              │
     │                    │                      │  Validate & parse │              │
     │                    │                      │  INSERT questions │              │
     │                    │                      ├───────────────────┼─────────────>│
     │                    │                      │<──────────────────┼──────────────│
     │                    │                      │                   │              │
     │                    │  { questions, count }│                   │              │
     │                    │<─────────────────────│                   │              │
     │                    │                      │                   │              │
     │  Show questions    │                      │                   │              │
     │  for review        │                      │                   │              │
     │<───────────────────│                      │                   │              │
```

### 6.2 Candidate Interview Taking Flow

```
Candidate        TakeInterview         Edge Functions         Database        Proctoring
    │                 │                      │                   │                │
    │  Open share     │                      │                   │                │
    │  link           │                      │                   │                │
    ├────────────────>│                      │                   │                │
    │                 │  resolve-invitation   │                   │                │
    │                 ├─────────────────────>│                   │                │
    │                 │  (3 retries, 1.5s    │                   │                │
    │                 │   backoff)           │                   │                │
    │                 │                      │  Verify token     │                │
    │                 │                      ├──────────────────>│                │
    │                 │                      │<─────────────────│                │
    │                 │  { invitation,       │                   │                │
    │                 │    interview }       │                   │                │
    │                 │<─────────────────────│                   │                │
    │                 │                      │                   │                │
    │  Enter name +   │                      │                   │                │
    │  email          │                      │                   │                │
    ├────────────────>│                      │                   │                │
    │                 │  Validate:           │                   │                │
    │                 │  name 2-100 letters  │                   │                │
    │                 │  email matches invite│                   │                │
    │                 │                      │                   │                │
    │                 │  [If proctoring enabled]                 │                │
    │                 │                      │                   │                │
    │  Pre-interview  │                      │                   │                │
    │  checks         │                      │                   │                │
    │<───────────────>│ PreInterviewChecks   │                   │                │
    │  1. Instructions│                      │                   │                │
    │  2. Consent     │                      │                   │                │
    │  3. Setup:      │                      │                   │                │
    │     Camera ✓    │                      │                   │                │
    │     Mic    ✓    │                      │                   │                │
    │     Network ✓   │                      │                   │                │
    │     Lighting ✓  │                      │                   │                │
    │     Person  ✓   │                      │                   │                │
    │  4. Ready       │                      │                   │                │
    │                 │                      │                   │                │
    │                 │  RPC: create_        │                   │                │
    │                 │  interview_attempt   │                   │                │
    │                 ├──────────────────────┼──────────────────>│                │
    │                 │  { attempt_id,       │                   │                │
    │                 │    session_token }   │   64-char token   │                │
    │                 │<─────────────────────┼──────────────────│                │
    │                 │                      │                   │                │
    │                 │  init-proctoring     │                   │                │
    │                 ├─────────────────────>│                   │                │
    │                 │<─────────────────────│                   │                │
    │                 │                      │                   │ Start monitor  │
    │                 ├──────────────────────┼───────────────────┼───────────────>│
    │                 │                      │                   │                │
    │                 │  RPC: get_questions_  │                   │                │
    │                 │  for_candidate       │                   │                │
    │                 ├──────────────────────┼──────────────────>│                │
    │                 │  Questions (no       │                   │                │
    │                 │  correct answers!)   │                   │                │
    │                 │<─────────────────────┼──────────────────│                │
    │                 │                      │                   │                │
    │  ╔═══════════╗ │                      │                   │                │
    │  ║ TIMER ON  ║ │                      │                   │                │
    │  ╚═══════════╝ │                      │                   │                │
    │                 │                      │                   │                │
    │  Answer         │                      │                   │                │
    │  questions      │                      │                   │   Monitoring:  │
    │  (MCQ, coding,  │                      │                   │   tab switch,  │
    │   scenario,     │                      │                   │   copy detect, │
    │   descriptive)  │                      │                   │   typing       │
    │                 │                      │                   │   patterns     │
    │                 │                      │                   │                │
    │  Submit /       │                      │                   │                │
    │  Timer expires  │                      │                   │                │
    ├────────────────>│                      │                   │                │
    │                 │  Validate:           │                   │                │
    │                 │  sessionToken ≥32ch  │                   │                │
    │                 │  answers valid       │                   │                │
    │                 │  timeTaken 0-86400   │                   │                │
    │                 │                      │                   │                │
    │                 │  RPC: update_attempt │                   │                │
    │                 │  _with_session       │                   │                │
    │                 ├──────────────────────┼──────────────────>│                │
    │                 │<─────────────────────┼──────────────────│                │
    │                 │                      │                   │                │
    │                 │  auto-evaluate-      │                   │                │
    │                 │  trigger             │                   │                │
    │                 ├─────────────────────>│                   │                │
    │                 │                      │  evaluate-        │                │
    │                 │                      │  interview        │                │
    │                 │                      │  (async)          │                │
    │                 │                      │                   │                │
    │  Redirect to    │                      │                   │                │
    │  /interview-    │                      │                   │                │
    │  complete/:id   │                      │                   │                │
    │<────────────────│                      │                   │                │
```

### 6.3 Authentication Flow (Detailed)

```
User              Auth Page            GoTrue            Edge Function         Database
  │                  │                    │                    │                  │
  │  Enter email     │                    │                    │                  │
  ├─────────────────>│                    │                    │                  │
  │                  │  RPC: check_user   │                    │                  │
  │                  │  _exists           │                    │                  │
  │                  ├────────────────────┼────────────────────┼────────────────>│
  │                  │<───────────────────┼────────────────────┼─────────────────│
  │                  │                    │                    │                  │
  │                  │  EXISTS?           │                    │                  │
  │                  │  ┌─── YES ──────── │ ───────────────┐   │                  │
  │  Show password   │  │  Show sign-in  │                │   │                  │
  │  field           │  │  form          │                │   │                  │
  │<─────────────────│  │                │                │   │                  │
  │                  │  │                │                │   │                  │
  │  Enter password  │  │                │                │   │                  │
  ├─────────────────>│  │                │                │   │                  │
  │                  │  │ POST /auth/v1/ │                │   │                  │
  │                  │  │ token?grant_type│               │   │                  │
  │                  │  │ =password      │                │   │                  │
  │                  │  ├───────────────>│                │   │                  │
  │                  │  │                │ Verify bcrypt  │   │                  │
  │                  │  │                │ Generate JWT   │   │                  │
  │                  │  │  JWT + session │                │   │                  │
  │                  │  │<───────────────│                │   │                  │
  │                  │  └────────────────┘                │   │                  │
  │                  │                                     │   │                  │
  │                  │  ┌─── NO (new user) ───────────────┘   │                  │
  │  Show signup     │  │                │                    │                  │
  │  form            │  │                │                    │                  │
  │<─────────────────│  │                │                    │                  │
  │                  │  │                │                    │                  │
  │  Enter name +    │  │                │                    │                  │
  │  password        │  │                │                    │                  │
  ├─────────────────>│  │                │                    │                  │
  │                  │  │ POST /auth/v1/ │                    │                  │
  │                  │  │ signup         │                    │                  │
  │                  │  ├───────────────>│                    │                  │
  │                  │  │                │ Create auth.user   │                  │
  │                  │  │                │ Send verify email  │                  │
  │                  │  │<───────────────│                    │                  │
  │                  │  │                │                    │                  │
  │                  │  │ complete-user- │                    │                  │
  │                  │  │ signup         │                    │                  │
  │                  │  ├────────────────┼───────────────────>│                  │
  │                  │  │                │                    │ Create profile   │
  │                  │  │                │                    ├─────────────────>│
  │                  │  │                │                    │ Assign guest role│
  │                  │  │                │                    ├─────────────────>│
  │                  │  │                │                    │ Init onboarding  │
  │                  │  │                │                    ├─────────────────>│
  │                  │  │                │                    │ Send welcome     │
  │                  │  │                │                    │<─────────────────│
  │                  │  │<───────────────┼────────────────────│                  │
  │                  │  └────────────────┘                    │                  │
  │                  │                                        │                  │
  │  "Check your     │                                        │                  │
  │   email"         │                                        │                  │
  │<─────────────────│                                        │                  │
```

### 6.4 Learning Assessment Flow

```
User              LearningDash        TakeCertification      Edge Function       Database
  │                  │                      │                      │               │
  │  Select cert     │                      │                      │               │
  ├─────────────────>│                      │                      │               │
  │                  │  can_user_retake_    │                      │               │
  │                  │  certification       │                      │               │
  │                  ├──────────────────────┼──────────────────────┼──────────────>│
  │                  │<─────────────────────┼──────────────────────┼───────────────│
  │                  │  allowed: true       │                      │               │
  │                  │                      │                      │               │
  │  Navigate to     │                      │                      │               │
  │  /take-cert/:id  │                      │                      │               │
  │<─────────────────│                      │                      │               │
  │                  │                      │                      │               │
  │  ─────── PreInterviewChecks ──────     │                      │               │
  │  Instructions → Consent → Setup →      │                      │               │
  │  Camera/Mic/Network/Lighting/Person    │                      │               │
  │  ─────────────────────────────────     │                      │               │
  │                  │                      │                      │               │
  │                  │  Create attempt      │                      │               │
  │                  │  ┌──────────────────>├──────────────────────┼──────────────>│
  │                  │  │                   │<─────────────────────┼───────────────│
  │                  │  │                   │                      │               │
  │                  │  │                   │  generate-cert-      │               │
  │                  │  │                   │  questions            │               │
  │                  │  │                   ├─────────────────────>│               │
  │                  │  │                   │   Call Gemini AI     │               │
  │                  │  │                   │<─────────────────────│               │
  │                  │  │                   │                      │               │
  │  Show questions  │  │                   │                      │               │
  │  + timer         │  │                   │                      │               │
  │<─────────────────────────────────────── │                      │               │
  │                  │  │                   │                      │               │
  │  Answer MCQ +    │  │                   │                      │               │
  │  coding +        │  │                   │                      │               │
  │  descriptive     │  │                   │                      │               │
  │                  │  │                   │                      │               │
  │  Submit          │  │                   │                      │               │
  ├────────────────────────────────────────>│                      │               │
  │                  │  │                   │  evaluate-cert        │               │
  │                  │  │                   ├─────────────────────>│               │
  │                  │  │                   │  score ≥ passing_score│              │
  │                  │  │                   │  → issue certificate │               │
  │                  │  │                   │<─────────────────────│               │
  │                  │  │                   │                      │               │
  │  Show result     │  │                   │                      │               │
  │  (/cert-result)  │  │                   │                      │               │
  │<────────────────────────────────────────│                      │               │
```

---

## 7. State Management Detail

### 7.1 AuthContext Implementation

```typescript
// src/contexts/AuthContext.tsx

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

// State machine:
//
// INITIAL → loading=true, user=null
//   ↓ onAuthStateChange fires
// SIGNED_IN → loading=false, user=User, session=Session
//   ↓ ensureUserSetup()
//     ↓ fetchUserRoles() (setTimeout 0 to avoid deadlock)
// READY → roles populated, redirects active
//   
// SIGNED_OUT → loading=false, user=null, roles=[]

// God mode: hasAnyRole() returns true if user is platform_admin
// regardless of the requested roles
```

### 7.2 OrganizationContext Implementation

```typescript
// src/contexts/OrganizationContext.tsx

interface OrgContextValue {
  selectedOrgId: string | null;
  selectedOrg: Organization | null;
  availableOrgs: Organization[];
  isImpersonating: boolean;          // platform_admin viewing another org
  selectOrganization: (id: string) => void;
  clearImpersonation: () => void;
}

// Behavior:
// - platform_admin: Can select any org (OrganizationSelector component)
// - partner_admin: Locked to their org (auto-selected from org_members)
// - other roles: Linked to org via organization_members
```

### 7.3 React Query Usage Patterns

```typescript
// Data fetching pattern (used across all pages)

// List query with filters
const { data: interviews, isLoading } = useQuery({
  queryKey: ['interviews', orgId, status, page],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(page * 10, (page + 1) * 10 - 1);
    if (error) throw error;
    return data;
  },
  enabled: !!orgId,  // Only fetch when org is selected
});

// Mutation with optimistic update
const updateMutation = useMutation({
  mutationFn: async (data: Partial<Interview>) => {
    const { error } = await supabase
      .from('interviews')
      .update(data)
      .eq('id', interviewId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['interviews'] });
    toast.success('Interview updated');
  },
  onError: (error) => {
    toast.error(getUserFriendlyErrorMessage(error));
  },
});

// Edge function invocation
const generateMutation = useMutation({
  mutationFn: async () => {
    return invokeFunction('generate-questions', {
      interviewId,
      config: formData,
    });
  },
});
```

### 7.4 Custom Hooks Design

```typescript
// src/hooks/useUserRoles.ts
interface UseUserRolesReturn {
  roles: AppRole[];
  loading: boolean;
  isPlatformAdmin: boolean;
  isPartnerAdmin: boolean;
  isHRRecruiter: boolean;
  isTechSpoc: boolean;
  isBillingContact: boolean;
  isGuest: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refetchRoles: () => Promise<void>;
}

// src/hooks/usePermissions.ts
interface UsePermissionsReturn {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  userPermissions: Permission[];
}
// Maps roles → permissions via ROLE_PERMISSIONS constant in permissions.ts

// src/hooks/useProctoring.ts
interface UseProctoringReturn {
  isActive: boolean;
  violations: Violation[];
  tabSwitchCount: number;
  lookAwayCount: number;
  integrityScore: number;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  logViolation: (type: ViolationType, data?: object) => void;
  getReport: () => ProctoringReport;
}
```

---

## 8. Component Design

### 8.1 Interview Creation Form Architecture

```
CreateInterview (Page)
│
├── InterviewBasicInfo
│   ├── Input: title (5-200 chars)
│   ├── Textarea: jobDescription (50-10,000 chars)
│   ├── Input: questionCount (5-100)
│   └── Input: timeLimit (0-180 min)
│
├── QuestionTypeInputs
│   ├── Input: mcqCount
│   ├── Input: scenarioCount
│   ├── Input: codingCount
│   ├── Input: descriptiveCount
│   └── Validation: sum must equal questionCount
│
├── CategoryDifficultyInputs
│   ├── Per-type difficulty sliders
│   │   ├── Easy %
│   │   ├── Medium %
│   │   └── Hard %
│   └── Validation: each must sum to 100%
│
├── TopicDistribution
│   ├── Extracted skills (from JD via AI)
│   ├── Percentage per topic slider
│   └── Validation: must sum to 100%
│
├── RequiredQuestionRules
│   └── Rule builder: "at least N {difficulty} {type} on {topic}"
│
├── ProctoringToggle
│   └── Switch: proctoring_enabled
│
└── ActionButtons
    ├── Save Draft
    ├── Generate Questions (disabled when form invalid)
    └── Cancel
```

### 8.2 Proctoring Component Architecture

```
PreInterviewChecks
│
├── Step 1: InstructionsStep
│   └── Rules list, continue button
│
├── Step 2: ConsentStep
│   ├── Checkbox: Allow proctoring
│   ├── Checkbox: Allow recording
│   ├── Checkbox: Allow data usage
│   ├── Checkbox: Allow AI analysis
│   └── All required to proceed
│
├── Step 3: SetupStep
│   ├── NetworkCheck
│   │   └── 5 × 1MB samples → median bandwidth
│   │       Pass: ≥1 Mbps, Warn: <5 Mbps
│   ├── CameraCheck
│   │   └── getUserMedia(640×480) → validate stream
│   ├── MicrophoneCheck
│   │   └── Audio track presence check
│   ├── LightingCheck
│   │   └── checkCameraQuality() + brightness analysis
│   └── PersonCheck
│       └── detectFaces() → exactly 1 person required
│
└── Step 4: ReadyStep
    └── Confirmation to start

ProctoringMonitor (runs during assessment)
│
├── useCandidateBroadcast → live stream to proctors
├── FaceDetection → personCount, confidence
├── GazeTracking → eye gaze coordinates
├── VoiceAnalysis → voice count, anomalies
│
├── TabSwitchDetector → visibilitychange API
├── CopyPasteDetector → clipboard event intercept
├── PrintScreenBlocker → keyboard event intercept
├── MultiMonitorDetector → screen enumeration
├── VMDetector → browser fingerprint (single check)
├── TypingPatternAnalyzer → keystroke dynamics
│
├── ScreenShareBlockingOverlay → blocks if share stopped
├── StreamHealthGuard → auto-recovery for broken streams
├── NetworkStatusBanner → connection quality indicator
│
└── ChunkUploader → periodic video chunk uploads
```

### 8.3 UI Component Library (shadcn/ui)

```
src/components/ui/
│
├── Layout & Container
│   ├── card.tsx          (Card, CardHeader, CardContent, CardFooter)
│   ├── dialog.tsx        (Dialog, DialogContent, DialogHeader, DialogFooter)
│   ├── sheet.tsx         (Sheet — slide-over panel)
│   ├── tabs.tsx          (Tabs, TabsList, TabsTrigger, TabsContent)
│   ├── accordion.tsx     (Accordion, AccordionItem, AccordionContent)
│   └── separator.tsx     (Visual separator)
│
├── Form Controls
│   ├── button.tsx        (variant: default|destructive|outline|secondary|ghost|link)
│   ├── input.tsx         (text, email, password, number)
│   ├── textarea.tsx      (multi-line text)
│   ├── select.tsx        (single-select dropdown)
│   ├── checkbox.tsx      (boolean toggle)
│   ├── switch.tsx        (toggle switch)
│   ├── slider.tsx        (range slider)
│   ├── calendar.tsx      (date picker)
│   ├── form.tsx          (React Hook Form integration)
│   └── command.tsx       (command palette/search)
│
├── Display
│   ├── table.tsx         (Table, TableHeader, TableBody, TableRow, TableCell)
│   ├── badge.tsx         (status/tag badges)
│   ├── avatar.tsx        (user avatars)
│   ├── alert.tsx         (info/warning/error alerts)
│   ├── progress.tsx      (progress bar)
│   ├── skeleton.tsx      (loading placeholder)
│   └── tooltip.tsx       (hover tooltip)
│
├── Navigation
│   ├── dropdown-menu.tsx (context menus)
│   ├── popover.tsx       (positioned popover)
│   ├── sidebar.tsx       (collapsible sidebar)
│   └── breadcrumb.tsx    (nav breadcrumbs)
│
└── Feedback
    ├── toast.tsx          (Sonner-based toasts)
    └── sonner.tsx         (toast provider)
```

---

## 9. Security Implementation Detail

### 9.1 RLS Policy Patterns

```sql
-- Pattern 1: User owns the resource
CREATE POLICY "users_own_data" ON profiles
  FOR ALL USING (id = auth.uid());

-- Pattern 2: Organization-scoped access
CREATE POLICY "org_member_access" ON interviews
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR has_role(auth.uid(), 'platform_admin')
  );

-- Pattern 3: Role-restricted write
CREATE POLICY "hr_can_create" ON interviews
  FOR INSERT WITH CHECK (
    has_any_role(auth.uid(), ARRAY['platform_admin', 'partner_admin', 'hr_recruiter', 'tech_spoc'])
  );

-- Pattern 4: Candidate-only access (no auth required)
CREATE POLICY "candidate_read_attempt" ON interview_attempts
  FOR SELECT USING (
    session_token IS NOT NULL
    -- Validated in SECURITY DEFINER function
  );

-- Pattern 5: Immutable fields
CREATE POLICY "attempt_update_restrict" ON interview_attempts
  FOR UPDATE WITH CHECK (
    candidate_email = (SELECT candidate_email FROM interview_attempts WHERE id = id)
    AND candidate_name = (SELECT candidate_name FROM interview_attempts WHERE id = id)
  );
```

### 9.2 Error Sanitization Pipeline

```
PostgreSQL Error
      │
      ▼
┌─────────────────────────────────────────────┐
│  error-handler.ts                           │
│                                             │
│  PostgreSQL Code Mapping:                   │
│  ┌──────────────────────────────────────┐  │
│  │ 23505 → "This record already exists" │  │
│  │ 42501 → "Permission denied"          │  │
│  │ PGRST116 → "Record not found"        │  │
│  │ PGRST301 → "No rows returned"        │  │
│  │ 57P01 → "Service temporarily down"  │  │
│  │ 42P01 → "Configuration error"       │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Context-specific handlers:                 │
│  ┌──────────────────────────────────────┐  │
│  │ getAuthErrorMessage(error)           │  │
│  │ getInterviewErrorMessage(error)      │  │
│  │ getUserFriendlyErrorMessage(error)   │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  NEVER expose: table names, column names,  │
│  SQL queries, stack traces, internal IPs   │
└─────────────────────────────────────────────┘
      │
      ▼
User-Friendly Toast Message
```

### 9.3 Token Flow

```
┌──── Session JWT ──────────────────────────────────────┐
│                                                        │
│  Created: GoTrue on sign-in                           │
│  Storage: Browser (managed by Supabase client)        │
│  Lifetime: Configurable (default 1 hour)              │
│  Refresh: Auto-refresh with 60s buffer                │
│                                                        │
│  Claims: { sub: user_id, role: 'authenticated',       │
│            email, iat, exp }                           │
│                                                        │
│  Used by: All PostgREST queries, edge function calls  │
│  RLS reads: auth.uid() extracts sub from JWT          │
└────────────────────────────────────────────────────────┘

┌──── Interview Session Token ──────────────────────────┐
│                                                        │
│  Created: create_interview_attempt() PG function      │
│  Value: 64-char base64 (gen_random_bytes(48))         │
│  Storage: Browser sessionStorage (not localStorage)   │
│  Lifetime: Duration of interview attempt              │
│                                                        │
│  Used by: update_attempt_with_session() to validate   │
│  Purpose: Prevents unauthorized answer submission     │
│  Cannot: Be guessed or enumerated                     │
└────────────────────────────────────────────────────────┘

┌──── API Keys (AI Providers) ──────────────────────────┐
│                                                        │
│  Storage: ai_provider_credentials table                │
│  Encryption: AES via encrypt_api_key() function       │
│  Decryption: Only in SECURITY DEFINER functions       │
│  Access: Edge functions only (service role)            │
│  Never: Sent to client or exposed in API responses    │
└────────────────────────────────────────────────────────┘
```

---

## 10. Error Handling Architecture

### 10.1 Error Boundary Hierarchy

```
<App>
  <ErrorBoundary section="root" fallback={<RootErrorPage />}>
    │
    ├─ <AdminLayout>
    │    <ErrorBoundary section="admin" fallback={<AdminErrorPage />}>
    │      <Route component={...} />
    │    </ErrorBoundary>
    │
    ├─ <PartnerLayout>
    │    <ErrorBoundary section="partner" fallback={<PartnerErrorPage />}>
    │      <Route component={...} />
    │    </ErrorBoundary>
    │
    ├─ Recruiting routes
    │    <ErrorBoundary section="recruiting" fallback={<RecruitingErrorPage />}>
    │      <Route component={...} />
    │    </ErrorBoundary>
    │
    └─ Assessment routes
         <ErrorBoundary section="assessment" fallback={<AssessmentErrorPage />}>
           <Route component={...} />
         </ErrorBoundary>

Each ErrorBoundary:
  1. Catches React render errors
  2. Reports to Sentry with section tag
  3. Shows fallback UI with retry option
  4. Logs to console in development
```

### 10.2 Retry Strategy

```typescript
// src/lib/retryUtils.ts

interface RetryConfig {
  maxAttempts: number;      // Default: 3
  initialDelay: number;     // Default: 1000ms
  maxDelay: number;         // Default: 5000ms
  backoffMultiplier: number; // Default: 1.5
}

function isRetryable(error: Error): boolean {
  // Retryable:
  // - Network errors (TypeError: Failed to fetch)
  // - Timeout errors
  // - HTTP 500, 502, 503, 504
  // - HTTP 429 (rate limited)
  
  // NOT retryable:
  // - HTTP 400, 401, 403, 404, 409
  // - Validation errors
  // - Auth errors
}

// Retry flow:
// Attempt 1 → fail → wait 1.0s
// Attempt 2 → fail → wait 1.5s
// Attempt 3 → fail → throw error
```

### 10.3 Logging Layers

```
┌─────────────────────────────────────────────────────────┐
│                    LOGGING ARCHITECTURE                  │
│                                                         │
│  Layer 1: logger.ts (General purpose)                   │
│  ┌───────────────────────────────────────────────────┐ │
│  │  logger.debug('message', data)                    │ │
│  │  logger.info('message', data)                     │ │
│  │  logger.warn('message', data)                     │ │
│  │  logger.error('message', error)                   │ │
│  │                                                    │ │
│  │  Output: Console (dev), Sentry (prod)             │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Layer 2: systemLogger.ts (System events)               │
│  ┌───────────────────────────────────────────────────┐ │
│  │  systemLogger.logEvent('category', 'action', data)│ │
│  │                                                    │ │
│  │  Categories: auth, navigation, api, error          │ │
│  │  Output: console + optional persistence            │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Layer 3: operationLogger.ts (Business operations)      │
│  ┌───────────────────────────────────────────────────┐ │
│  │  const op = startOperation('submit_interview')    │ │
│  │  // ... do work ...                               │ │
│  │  op.complete({ attemptId })                       │ │
│  │  // or op.fail(error)                             │ │
│  │                                                    │ │
│  │  Tracks: duration, success/failure, metadata      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Layer 4: audit-logger.ts (Admin audit trail)           │
│  ┌───────────────────────────────────────────────────┐ │
│  │  auditLog('delete_user', { userId, performedBy }) │ │
│  │                                                    │ │
│  │  Persisted to: audit_logs table                   │ │
│  │  Retention: 90 days                               │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 11. Proctoring Engine Detail

### 11.1 Violation Detection Pipeline

```
┌────────────────────────────────────────────────────────────┐
│            PROCTORING DETECTION PIPELINE                    │
│                                                            │
│  ┌──── REAL-TIME (During Interview) ────────────────────┐ │
│  │                                                       │ │
│  │  Event Listeners:                                     │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ document.visibilitychange → tab_switch          │ │ │
│  │  │ document.copy/paste       → copy_attempt        │ │ │
│  │  │ keyboard.PrintScreen      → print_screen        │ │ │
│  │  │ keystroke timing          → suspicious_typing   │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  API Checks:                                          │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ screen.availWidth > window.innerWidth           │ │ │
│  │  │   → multiple_monitors                           │ │ │
│  │  │ navigator.userAgent patterns → virtual_machine  │ │ │
│  │  │ MediaStream.onended → screen_share_stopped      │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──── DEFERRED (Post-Interview Analysis) ──────────────┐ │
│  │                                                       │ │
│  │  MediaPipe Tasks Vision:                              │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ Face Detection:                                  │ │ │
│  │  │   personCount > 1 → multiple_persons (HIGH)     │ │ │
│  │  │   confidence < threshold → look_away (LOW)      │ │ │
│  │  │                                                  │ │ │
│  │  │ Gaze Tracking:                                   │ │ │
│  │  │   off-screen > 3s → look_away (LOW)             │ │ │
│  │  │   erratic pattern → eye_movement (LOW)          │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  Voice Analysis:                                      │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ Multiple voice profiles → multiple_voices (MED) │ │ │
│  │  │ Silence patterns → silence_anomaly (LOW)        │ │ │
│  │  │ TTS/recording detected → audio_playback (MED)   │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  Advanced Detection:                                  │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ Face mismatch vs reference → person_swap (HIGH) │ │ │
│  │  │ Liveness check fail → liveness_fail (HIGH)      │ │ │
│  │  │ Object detection → phone_detected (HIGH)        │ │ │
│  │  │ Object detection → prohibited_object (HIGH)     │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  Severity Scoring:                                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  HIGH violations:   -10 points each                 │  │
│  │  MEDIUM violations: -5 points each                  │  │
│  │  LOW violations:    -2 points each                  │  │
│  │                                                      │  │
│  │  Integrity Score = 100 - sum(penalties)              │  │
│  │  Minimum: 0                                          │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 11.2 Recording Architecture

```
┌────────────────────────────────────────────────────────────┐
│              RECORDING & UPLOAD PIPELINE                    │
│                                                            │
│  Camera Stream ──────────────────────────────────────────┐│
│       │                                                   ││
│       ▼                                                   ││
│  MediaRecorder (WebM)                                     ││
│       │                                                   ││
│       ├── Chunk every 30s ──→ ChunkUploader              ││
│       │                         │                         ││
│       │                         ▼                         ││
│       │               get-chunk-upload-url                ││
│       │               (signed URL)                        ││
│       │                         │                         ││
│       │                         ▼                         ││
│       │               Upload to Storage                   ││
│       │               (background, retryable)             ││
│       │                                                   ││
│  On Interview Complete:                                   ││
│       │                                                   ││
│       ▼                                                   ││
│  merge-proctoring-chunks                                  ││
│       │                                                   ││
│       ▼                                                   ││
│  repair-webm-metadata                                     ││
│       │                                                   ││
│       ▼                                                   ││
│  confirm-proctoring-upload                                ││
│       │                                                   ││
│       ▼                                                   ││
│  proctoring_sessions.video_url = final URL                ││
│  proctoring_sessions.upload_status = 'complete'           ││
│                                                           ││
│  Screen Share Stream (same pipeline) ─────────────────────┘│
└────────────────────────────────────────────────────────────┘

Upload Guard:
┌──────────────────────────────────────────┐
│  uploadLock.ts:                          │
│  • Prevents duplicate uploads            │
│  • Tracks pending chunks                 │
│  • Retries failed chunks (3 attempts)    │
│                                          │
│  uploadProgressStore.ts:                 │
│  • Progress percentage per chunk         │
│  • Total progress calculation            │
│  • UI progress bar binding               │
│                                          │
│  BackgroundUploadHandler.tsx:            │
│  • Resumes interrupted uploads           │
│  • Runs as app-level component           │
│  • Shows UploadProgressOverlay           │
└──────────────────────────────────────────┘
```

---

## 12. File Upload Architecture

### 12.1 Upload Flow

```
Component                ChunkUploader            Edge Function           Storage
    │                         │                         │                    │
    │  Start recording        │                         │                    │
    ├────────────────────────>│                         │                    │
    │                         │                         │                    │
    │  [Every 30 seconds]     │                         │                    │
    │  dataavailable event    │                         │                    │
    ├────────────────────────>│                         │                    │
    │                         │                         │                    │
    │                         │  get-chunk-upload-url   │                    │
    │                         ├────────────────────────>│                    │
    │                         │  { signedUrl, path }    │                    │
    │                         │<────────────────────────│                    │
    │                         │                         │                    │
    │                         │  PUT signedUrl (blob)   │                    │
    │                         ├─────────────────────────┼───────────────────>│
    │                         │  200 OK                 │                    │
    │                         │<────────────────────────┼────────────────────│
    │                         │                         │                    │
    │  progress update        │                         │                    │
    │<────────────────────────│                         │                    │
    │                         │                         │                    │
    │  [On completion]        │                         │                    │
    │                         │  merge-proctoring-      │                    │
    │                         │  chunks                 │                    │
    │                         ├────────────────────────>│                    │
    │                         │                         │  Merge to single   │
    │                         │                         │  file              │
    │                         │                         ├───────────────────>│
    │                         │                         │<───────────────────│
    │                         │  { videoUrl }           │                    │
    │                         │<────────────────────────│                    │
```

---

## 13. Configuration Management

### 13.1 Environment Variables

```
Frontend (Vite — VITE_ prefix):
┌──────────────────────────────────────────────────────────┐
│  VITE_SUPABASE_URL          = http://localhost:8000      │
│  VITE_SUPABASE_PUBLISHABLE_KEY = <anon_key>              │
│  VITE_SENTRY_DSN            = <sentry_dsn>               │
│  VITE_APP_ENV               = development | production   │
└──────────────────────────────────────────────────────────┘

Backend (Docker environment):
┌──────────────────────────────────────────────────────────┐
│  POSTGRES_PASSWORD          = <db_password>              │
│  JWT_SECRET                 = <jwt_signing_secret>       │
│  ANON_KEY                   = <anon_jwt>                 │
│  SERVICE_ROLE_KEY           = <service_jwt>              │
│  GOTRUE_SMTP_HOST           = <smtp_host>                │
│  GOTRUE_SMTP_PORT           = 587                        │
│  GOTRUE_SMTP_USER           = <smtp_user>                │
│  GOTRUE_SMTP_PASS           = <smtp_pass>                │
│  GOTRUE_EXTERNAL_EMAIL_ENABLED = true                    │
│  GOOGLE_AI_API_KEY          = <gemini_key>               │
│  STRIPE_SECRET_KEY          = <stripe_key>               │
└──────────────────────────────────────────────────────────┘
```

### 13.2 Platform Configuration System

```
┌──────────────────────────────────────────────────────────┐
│  CONFIGURATION HIERARCHY                                  │
│                                                          │
│  1. Environment Variables (highest priority)             │
│     └── Build-time: VITE_* variables                    │
│     └── Runtime: Docker env vars                        │
│                                                          │
│  2. Database Configuration                               │
│     ├── platform_configurations (key-value pairs)       │
│     ├── system_config (system-level settings)           │
│     └── ai_feature_configurations (AI feature flags)    │
│                                                          │
│  3. Organization Settings                                │
│     └── organizations.settings (JSONB per-org config)   │
│                                                          │
│  4. Code Defaults                                        │
│     ├── src/lib/configuration.ts (default values)       │
│     └── src/lib/configurationPresets.ts (presets)        │
└──────────────────────────────────────────────────────────┘
```

---

## 14. Testing Architecture

### 14.1 Test Stack

```
┌──────────────────────────────────────────────────────────┐
│                   TESTING ARCHITECTURE                    │
│                                                          │
│  ┌──── E2E Tests (Playwright) ────────────────────────┐ │
│  │                                                     │ │
│  │  Config: playwright.config.ts                      │ │
│  │  Browser: Chromium only                            │ │
│  │  Workers: 1 (sequential — avoids race conditions)  │ │
│  │  Timeout: 60s per test                             │ │
│  │  Base URL: http://localhost:5174                   │ │
│  │                                                     │ │
│  │  Test Files:                                        │ │
│  │  ├── e2e/11-rbac-access-control.spec.ts           │ │
│  │  ├── e2e/12-platform-admin-deep.spec.ts           │ │
│  │  ├── e2e/13-partner-admin-deep.spec.ts            │ │
│  │  ├── e2e/14-hr-recruiter-deep.spec.ts             │ │
│  │  ├── e2e/15-tech-spoc-deep.spec.ts               │ │
│  │  ├── e2e/16-billing-contact-deep.spec.ts          │ │
│  │  ├── e2e/17-guest-deep.spec.ts                    │ │
│  │  ├── e2e/18-profile-notifications.spec.ts         │ │
│  │  ├── e2e/flow-01 through flow-12.spec.ts          │ │
│  │  └── e2e/flow-13 through flow-18.spec.ts          │ │
│  │                                                     │ │
│  │  Total: 630 tests, all passing                     │ │
│  │  Runtime: ~1 hour (sequential)                     │ │
│  │                                                     │ │
│  │  Helpers:                                           │ │
│  │  ├── e2e/helpers.ts (login, credentials, utils)   │ │
│  │  ├── e2e/auth-utils.ts (access denial checks)     │ │
│  │  └── e2e/globalSetup.ts (seed data, verify users) │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──── Unit Tests (Vitest) ───────────────────────────┐ │
│  │                                                     │ │
│  │  Config: vitest.config.ts                          │ │
│  │  Coverage: lcov reporting                          │ │
│  │  Scope: Utility functions, validators, helpers     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──── Test Data Seeding ─────────────────────────────┐ │
│  │                                                     │ │
│  │  6 Test Users:                                     │ │
│  │  ├── e2e-admin@talentgeenie.test   (platform_admin)│ │
│  │  ├── e2e-partner@talentgeenie.test (partner_admin) │ │
│  │  ├── e2e-hr@talentgeenie.test      (hr_recruiter)  │ │
│  │  ├── e2e-tech@talentgeenie.test    (tech_spoc)     │ │
│  │  ├── e2e-billing@talentgeenie.test (billing_contact)│ │
│  │  └── e2e-guest@talentgeenie.test   (guest)         │ │
│  │                                                     │ │
│  │  Seeded via globalSetup:                           │ │
│  │  ├── Organization: "Test Organization"             │ │
│  │  ├── Interviews with questions                     │ │
│  │  ├── Subscription plans                            │ │
│  │  ├── Notifications                                 │ │
│  │  └── Training data                                 │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 14.2 Test Categories

```
┌──────────────────────────────────────────────────────────┐
│  TEST COVERAGE MATRIX                                    │
│                                                          │
│  Category              │ Test Files    │ Tests │ Type    │
│  ──────────────────────┼───────────────┼───────┼──────── │
│  RBAC/Access Control   │ 11-rbac       │  ~50  │ Security│
│  Platform Admin Deep   │ 12-admin      │  ~40  │ Feature │
│  Partner Admin Deep    │ 13-partner    │  ~30  │ Feature │
│  HR Recruiter Deep     │ 14-hr         │  ~35  │ Feature │
│  Tech SPOC Deep        │ 15-tech       │  ~25  │ Feature │
│  Billing Contact Deep  │ 16-billing    │  ~25  │ Feature │
│  Guest User Deep       │ 17-guest      │  ~30  │ Feature │
│  Profile/Notifications │ 18-profile    │  ~30  │ Feature │
│  Flow Tests (01-12)    │ flow-01-12    │  98   │ E2E Flow│
│  Profile CRUD          │ flow-13       │   9   │ CRUD    │
│  Interview CRUD        │ flow-14       │  13   │ CRUD    │
│  User Management CRUD  │ flow-15       │  11   │ CRUD    │
│  Form Validation       │ flow-16       │  12   │ Valid.  │
│  Data Persistence      │ flow-17       │  21   │ API     │
│  Candidate Journey     │ flow-18       │  23   │ E2E Flow│
│  ──────────────────────┼───────────────┼───────┼──────── │
│  TOTAL                 │ 26 files      │ 630   │         │
└──────────────────────────────────────────────────────────┘
```

---

*End of Low-Level Design Document*
