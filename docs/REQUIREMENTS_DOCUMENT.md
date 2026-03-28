# TalentGeenie — Software Requirements Specification (SRS)

**Document Version:** 2.0  
**Date:** March 5, 2026  
**Product:** TalentGeenie — AI-Powered Interview & Learning Platform  
**Classification:** Internal / Confidential  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features & Functional Requirements](#3-system-features--functional-requirements)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Security Requirements](#7-security-requirements)
8. [Appendices](#8-appendices)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the complete software requirements for **TalentGeenie**, a multi-tenant, AI-powered interview management and learning platform. It serves as the single source of truth for development, testing, and acceptance criteria.

### 1.2 Scope

TalentGeenie is an end-to-end platform that enables organizations to:

- Create and manage AI-generated interview assessments
- Evaluate candidates with AI-powered scoring and hiring recommendations
- Proctor interviews with video, audio, tab-switch, face, and gaze detection
- Manage employee learning paths, certifications, and training
- Handle multi-organization billing with subscription plans
- Provide role-based hierarchical access for 6 distinct user types

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| **JD** | Job Description |
| **CPI** | Candidate Performance Index — composite score across technical, problem-solving, communication, and integrity dimensions |
| **RBAC** | Role-Based Access Control |
| **RLS** | Row-Level Security (PostgreSQL) |
| **MCQ** | Multiple-Choice Question |
| **ATS** | Applicant Tracking System |
| **SPA** | Single-Page Application |
| **Edge Function** | Serverless Deno function deployed on Supabase |

### 1.4 Intended Audience

- **Developers/Engineers** — Implementation reference
- **QA/Test Engineers** — Acceptance criteria and test planning
- **Product Owners** — Feature validation and prioritization
- **Stakeholders** — Business requirement verification

### 1.5 References

| Document | Location |
|----------|----------|
| High-Level Design (HLD) | `docs/HIGH_LEVEL_DESIGN.md` |
| Low-Level Design (LLD) | `docs/LOW_LEVEL_DESIGN.md` |
| Security Audit Report | `SECURITY_AUDIT_COMPLETE.md` |
| Database Migration Scripts | `docs/COMPLETE_DATABASE_MIGRATIONS.md` |
| Deployment Guide | `DEPLOYMENT.md` |

---

## 2. Overall Description

### 2.1 Product Perspective

TalentGeenie is a **standalone SaaS platform** that integrates:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TalentGeenie Platform                        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Interview │  │Learning &│  │Proctoring│  │  Billing  │       │
│  │Management│  │Certific. │  │  Engine   │  │ & Subscr. │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │             │
│  ┌────┴──────────────┴──────────────┴──────────────┴───────┐   │
│  │                  AI Engine (Gemini 2.5 Flash)            │   │
│  └────┬────────────────────────────────────────────────────┘   │
│       │                                                         │
│  ┌────┴────────────────────────────────────────────────────┐   │
│  │            Self-Hosted Supabase Backend                  │   │
│  │  PostgreSQL · PostgREST · GoTrue · Kong · Storage        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions (Summary)

| # | Function Area | Description |
|---|--------------|-------------|
| F1 | **Interview Management** | Create, configure, and manage AI-generated interview templates with customizable question types, difficulty, and topics |
| F2 | **AI Question Generation** | Generate tailored interview questions from job descriptions using Google Gemini AI with configurable type/difficulty distributions |
| F3 | **Candidate Assessment** | AI-evaluate candidate responses with overall scores, topic-wise breakdown, hiring recommendations, strengths/weaknesses |
| F4 | **Proctoring** | Real-time video/audio proctoring with 17+ violation types, face detection, gaze tracking, VM detection, and integrity scoring |
| F5 | **Learning & Training** | Role-based training plans with topic-wise progress tracking, practice assessments, and certification preparation |
| F6 | **Certifications** | Proctored certification exams (Azure, AWS, GCP, etc.) with certificate issuance and public verification |
| F7 | **Multi-Tenant Organizations** | Organization management with isolated data, configurable settings, and member management |
| F8 | **Subscription & Billing** | Plan-based billing with Stripe integration, invoice generation, usage tracking, and payment management |
| F9 | **RBAC & Security** | 6-role hierarchical access control with 38 granular permissions, RLS policies, and audit logging |
| F10 | **Analytics & Reporting** | Interview analytics, organization metrics, AI usage monitoring, and exportable reports |
| F11 | **JD Builder Wizard** | AI-assisted job description creation with skill extraction and template suggestions |
| F12 | **ATS Integration** | Integration with external Applicant Tracking Systems via webhooks |

### 2.3 User Classes and Roles

```
┌─────────────────┐    GOD MODE — Full platform access
│ Platform Admin   │    Access: Everything (all orgs, all data, all settings)
└────────┬────────┘
         │
┌────────┴────────┐    Organization-level administration
│ Partner Admin    │    Access: Own org settings, users, billing, recruiting
└────────┬────────┘
         │
┌────────┴────────────────────────────────┐
│                                          │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │HR Recruiter  │  │   Tech SPOC      │  │
│  │Create/manage │  │Question contrib. │  │
│  │interviews,   │  │Templates, read-  │  │
│  │evaluate,     │  │only interviews   │  │
│  │share, proctor│  │                  │  │
│  └──────────────┘  └──────────────────┘  │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │Billing       │  │   Guest          │  │
│  │Contact       │  │Learning only,    │  │
│  │Invoices,     │  │awaiting role     │  │
│  │payments,     │  │assignment        │  │
│  │subscriptions │  │                  │  │
│  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────┘

┌──────────────────┐   External (unauthenticated)
│ Candidate        │   Takes interview via shared link
└──────────────────┘   No account required
```

#### Role Permissions Matrix

| Permission | Platform Admin | Partner Admin | HR Recruiter | Tech SPOC | Billing Contact | Guest |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| **Interviews** | | | | | | |
| Create interviews | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit interviews | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete interviews | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Share interviews | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View interviews | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage questions | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Users** | | | | | | |
| Create users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View users | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage teams | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reports** | | | | | | |
| View reports | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Generate reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View assessments | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Analytics** | | | | | | |
| View analytics | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Org analytics | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Comparative analytics | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Billing** | | | | | | |
| View billing | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Manage billing | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Manage subscription | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View invoices | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Organizations** | | | | | | |
| Manage organizations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve applications | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View org members | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Settings** | | | | | | |
| Manage settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage integrations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage custom roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Proctoring** | | | | | | |
| View proctoring | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage proctoring | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Review violations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Learning** | | | | | | |
| View learning | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Create learning | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage learning | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 2.4 Operating Environment

| Component | Requirement |
|-----------|-------------|
| **Client Browser** | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| **Mobile** | iOS 14+ / Android 10+ (via Capacitor hybrid app) |
| **Server OS** | Linux (Docker containers) |
| **Database** | PostgreSQL 15.8+ |
| **Runtime** | Node.js 20+, Deno (edge functions) |
| **Container** | Docker 24+, Kubernetes 1.28+ (optional) |

### 2.5 Design and Implementation Constraints

- **C1**: Must use self-hosted Supabase (PostgreSQL, GoTrue, PostgREST, Kong)
- **C2**: AI provider must support Google Gemini 2.5 Flash (with 1.5 Flash fallback)
- **C3**: All database tables must have Row-Level Security (RLS) enabled
- **C4**: Frontend must be a React SPA deployable via Nginx
- **C5**: Must support multi-tenant organization isolation
- **C6**: Proctoring must work with standard browser MediaDevices API

### 2.6 Assumptions and Dependencies

- **A1**: Users have modern browsers with WebRTC support for proctoring
- **A2**: Candidates have camera + microphone for proctored interviews
- **A3**: Google Gemini API is available with valid API credentials
- **A4**: Stripe API is used for payment processing
- **A5**: Minimum 1 Mbps network bandwidth for proctored sessions

---

## 3. System Features & Functional Requirements

### 3.1 Authentication & User Management

#### FR-AUTH-01: User Registration
- **Description**: New users register with email, password, and full name
- **Validation Rules**:
  - Email: Valid format, ≤255 characters, trimmed and lowercased
  - Password: 8–72 characters, ≥1 uppercase, ≥1 lowercase, ≥1 digit
  - Full Name: 2–100 characters, letters/spaces/hyphens/apostrophes only (regex: `/^[a-zA-Z\s'-]+$/`)
- **Post-Registration**:
  - Profile created in `profiles` table with `email_verified: false`
  - Default `guest` role assigned via `user_roles` table
  - Onboarding progress initialized
  - Welcome email sent
- **Priority**: Critical

#### FR-AUTH-02: Email Verification
- **Description**: Users must verify email before accessing protected features
- **Flow**: Registration → verification email → click link → redirect to `/auth/verify` → `email_verified` set to `true`
- **Bypass**: Platform admin can skip verification
- **Priority**: Critical

#### FR-AUTH-03: Sign In
- **Description**: Existing users sign in with email and password
- **Flow**: Enter email → Check user exists (RPC) → Route to sign-in → Enter password → Authenticate via GoTrue → Redirect to role-based dashboard
- **Dashboard Redirects**:
  - `platform_admin` → `/admin`
  - `partner_admin` → `/partner/portal`
  - `hr_recruiter` → `/partner/recruiting/interviews`
  - `tech_spoc` → `/partner/recruiting/question-repository`
  - `billing_contact` → `/partner/billing`
  - `guest` → `/learning-dashboard`
- **Priority**: Critical

#### FR-AUTH-04: Password Reset
- **Description**: Users can request password reset via email
- **Flow**: Enter email at `/reset-password` → reset email sent → click link → `/reset-password/confirm` → set new password
- **Priority**: High

#### FR-AUTH-05: Session Management
- **Description**: JWT-based sessions with automatic refresh
- **Details**:
  - Token expiration check with 60-second buffer
  - Automatic token refresh on expiration
  - Session stored securely in browser
- **Priority**: Critical

#### FR-AUTH-06: User Profile Management
- **Description**: All users can view and edit their profile
- **Editable Fields**: Full name, phone, bio, avatar
- **Validation**: Same rules as registration for name fields
- **Password Change**: Requires current password, validates strength rules, confirms match
- **Priority**: High

---

### 3.2 Interview Management

#### FR-INT-01: Interview Creation
- **Description**: HR Recruiters and above can create interview templates
- **Required Fields**:
  - Title: 5–200 characters
  - Job Description: 50–10,000 characters
  - Question Count: 5–100 (integer)
  - Time Limit: 0–180 minutes (optional)
- **Question Type Configuration**:
  - Types: MCQ, Scenario-Based, Coding, Descriptive
  - Counts per type (must sum to total question count)
  - Difficulty per type: Easy/Medium/Hard percentages (sum to 100%)
- **Topic Distribution**:
  - Skills extracted from JD via AI
  - Percentage per topic (must sum to 100%)
  - Required question rules (e.g., "at least 2 hard coding on SQL")
- **Additional Options**:
  - Proctoring enable/disable toggle
  - Question bank size (default: 200)
  - Experience level detection
- **Modes**: Create new, edit existing, reconfigure, pre-fill from JD Builder/template
- **Priority**: Critical

#### FR-INT-02: AI Question Generation
- **Description**: Generate interview questions from configured parameters
- **AI Provider**: Google Gemini 2.5 Flash (primary), 1.5 Flash (fallback)
- **Input**: Job description, question type distribution, difficulty distribution, topic distribution, required rules
- **Output**: Question bank with text, type, difficulty, topic, options (MCQ), correct answers, code templates (coding), test cases, explanations
- **Progress**: Real-time generation progress display
- **Post-Generation**: Questions stored in `questions` table linked to interview
- **Priority**: Critical

#### FR-INT-03: Interview Sharing
- **Description**: Share interviews with candidates via unique links
- **URL Formats**:
  - New: `/i/:orgSlug/:interviewSlug/:shareToken`
  - Legacy: `/take-interview/:shareLink`
- **Invitations**: Send via email with candidate name/email, expiry date
- **Token**: Cryptographically generated share token
- **Priority**: Critical

#### FR-INT-04: Candidate Interview Taking
- **Description**: Candidates take interviews via shared links (no account required)
- **Flow**:
  1. Resolve invitation via share token (3 retries, 1.5s → backoff)
  2. Validate: not expired, not completed, not archived
  3. Candidate enters name + email (must match invitation)
  4. Pre-interview proctoring checks (if enabled)
  5. Create attempt via secure RPC (generates 64-char session token)
  6. Fetch questions (correct answers hidden via RLS)
  7. Timer countdown with auto-submit on expiry
  8. Submit answers with session token validation
  9. Auto-evaluate trigger on submission
- **Validation**:
  - Candidate name: 2–100 characters, letters only
  - Candidate email: valid format, ≤255 characters
  - Session token: ≥32 characters, alphanumeric
  - Answer: 1–5,000 characters per question
  - Time taken: 0–86,400 seconds (24 hours max)
- **One attempt per candidate email per interview**
- **Priority**: Critical

#### FR-INT-05: AI Candidate Evaluation
- **Description**: Automated evaluation of candidate responses
- **Output**:
  - Overall score (0–100)
  - Hiring decision (Strong Hire / Hire / Lean Hire / No Hire)
  - Per-topic scores
  - Strengths and weaknesses arrays
  - Detailed analysis per question
  - CPI: Technical, Problem-Solving, Communication, Integrity scores
- **Trigger**: Automatic post-submission via edge function
- **Priority**: Critical

#### FR-INT-06: Interview List & Search
- **Description**: View all interviews with filtering and search
- **View Modes**: Card, Compact, Table
- **Filters**: Status (active, archived, draft), search by title/job
- **Priority**: High

#### FR-INT-07: Interview Detail View
- **Description**: Detailed view of interview configuration, questions, attempts, and assessment reports
- **Priority**: High

---

### 3.3 Proctoring System

#### FR-PROC-01: Pre-Interview Checks
- **Description**: 4-step wizard before proctored interviews
- **Steps**:
  1. **Instructions**: Rules and guidelines display
  2. **Consent**: Must agree to proctoring, recording, data usage, AI analysis
  3. **Setup**: Automated hardware checks
  4. **Ready**: Confirmation to proceed
- **Automated Checks**:
  - Network bandwidth: 5 × 1MB samples, median calculation (fail < 1 Mbps, warn < 5 Mbps)
  - Camera: 640×480 MediaDevices validation
  - Microphone: Audio track presence on stream
  - Lighting: Camera quality + brightness analysis
  - Person visible: Face detection (single person required)
- **Priority**: Critical

#### FR-PROC-02: Real-Time Monitoring
- **Description**: Continuous monitoring during proctored assessments
- **Live Checks During Assessment**:
  - Tab switch detection
  - Print screen blocking
  - Multi-monitor detection
  - VM/virtual machine detection (single check)
  - Copy/paste attempt detection
  - Typing pattern analysis
  - Screen share continuity enforcement
- **Deferred Heavy Analysis (Post-Interview)**:
  - Multi-person detection (face detection)
  - Gaze tracking and eye movement analysis
  - Voice analysis (multiple voices, playback)
  - Liveness detection
  - Face verification (person swap)
  - Phone/prohibited object detection
- **Priority**: Critical

#### FR-PROC-03: Violation Tracking
- **Description**: System tracks 17+ violation types with severity levels
- **Violation Types**:

| Violation | Severity | Detection Method |
|-----------|----------|-----------------|
| Multiple persons | High | Face detection (post-interview) |
| Multiple voices | Medium | Voice analysis (post-interview) |
| Tab switch | Medium | Visibility change API |
| Look away | Low | Gaze tracking (>3–5s threshold) |
| Copy attempt | Medium | Clipboard event interception |
| Eye movement anomaly | Low | MediaPipe gaze tracking |
| Liveness failure | High | Liveness detection model |
| Person swap | High | Face verification mismatch |
| Silence anomaly | Low | Audio analysis |
| Phone detected | High | Object detection |
| Prohibited object | High | Object detection |
| Multiple monitors | Medium | Screen enumeration API |
| Print screen | High | Keyboard event interception |
| Virtual machine | High | Browser fingerprinting |
| Suspicious typing | Medium | Typing pattern analysis |
| Audio playback | Medium | Audio spectral analysis |
| Screen share stopped | High | MediaStream track ended |

- **Priority**: Critical

#### FR-PROC-04: Recording Management
- **Description**: Video and screen recording during proctored interviews
- **Features**:
  - Chunked upload during interview (prevents data loss)
  - Post-interview chunk merging
  - WebM metadata repair
  - Signed upload URLs for security
  - Background upload with progress tracking
  - Stream health monitoring with auto-recovery
- **Priority**: High

#### FR-PROC-05: Integrity Scoring
- **Description**: Composite integrity score based on all proctoring data
- **Factors**: Violation count/severity, tab switches, look-away count, face detection confidence, voice analysis
- **Output**: Integrity score (0–100), review status, per-violation breakdown
- **Priority**: High

---

### 3.4 Learning & Certifications

#### FR-LEARN-01: Learning Dashboard
- **Description**: Personalized dashboard showing training progress, assigned plans, and certification status
- **Available to**: All authenticated users
- **Priority**: High

#### FR-LEARN-02: Training Plans
- **Description**: Role-based training plans with topic-wise structure
- **Components**: Training plan → Topics → Learning materials (articles, videos)
- **Progress Tracking**: Per-topic progress with status (In Progress, Upcoming, Completed)
- **Actions**: Start Assessment, Practice per topic
- **Priority**: High

#### FR-LEARN-03: Practice Assessments
- **Description**: Non-proctored practice assessments for learning topics
- **Configuration**: Question count, difficulty, type distribution
- **Evaluation**: AI-powered feedback with topic/difficulty scores
- **Usage Tracking**: Free vs. paid tiers
- **Priority**: Medium

#### FR-LEARN-04: Certification Exams
- **Description**: Proctored certification exams for cloud platforms
- **Supported Providers**: Azure, AWS, GCP, Databricks, Snowflake
- **Difficulty Levels**: Beginner, Intermediate, Advanced
- **Flow**: Select certification → Pre-interview checks → Proctored exam → AI evaluation → Certificate issuance
- **Retake Policy**: Governed by `can_user_retake_certification` RPC
- **Priority**: High

#### FR-LEARN-05: Certificate Management
- **Description**: Certificate issuance and verification
- **Features**:
  - Certificate with unique verification code
  - PDF generation via edge function
  - Public verification page at `/verify-certificate`
  - My Certificates dashboard
- **Priority**: Medium

#### FR-LEARN-06: Learning History
- **Description**: Track all learning activities, assessment attempts, and feedback
- **Pages**: `/learning-progress/:id`, `/learning-feedback/:attemptId`, `/learning-history`
- **Priority**: Medium

---

### 3.5 Organization Management

#### FR-ORG-01: Multi-Tenant Organizations
- **Description**: Organizations as top-level entities with isolated data
- **Fields**: Name, slug, logo, industry, size, pricing model, settings, active status
- **Data Isolation**: RLS policies restrict data to organization members
- **Priority**: Critical

#### FR-ORG-02: Organization Member Management
- **Description**: Add, edit, remove organization members with role assignment
- **Fields**: User, role, permissions, active status
- **Invitation Flow**: Admin invites → email sent → user accepts → added to org
- **Priority**: High

#### FR-ORG-03: Partner Onboarding
- **Description**: New organizations apply via `/partner/onboarding`
- **Flow**: Submit application → Platform admin reviews → Approve/reject → Organization created
- **Priority**: Medium

#### FR-ORG-04: Organization Settings
- **Description**: Configurable organization-level settings
- **Access**: Partner admin and platform admin
- **Priority**: Medium

#### FR-ORG-05: Organization Analytics
- **Description**: Organization-level metrics and dashboards
- **Metrics**: Interviews conducted, candidates evaluated, AI usage, team activity
- **Priority**: Medium

---

### 3.6 Billing & Subscriptions

#### FR-BILL-01: Subscription Plans
- **Description**: Plan-based access control with usage limits
- **Plan Attributes**: Name, price (monthly cents), max interviews, max users, max AI usage
- **Priority**: High

#### FR-BILL-02: Organization Subscriptions
- **Description**: Link organizations to subscription plans
- **Integration**: Stripe for payment processing
- **Features**: Plan selection, upgrade/downgrade, usage tracking, auto-renewal
- **Priority**: High

#### FR-BILL-03: Invoice Management
- **Description**: Automated invoice generation and history
- **Features**: Invoice generation via edge function, line items, PDF export, payment status
- **Priority**: High

#### FR-BILL-04: Payment Methods
- **Description**: Manage organization payment methods
- **Storage**: Card brand, last 4 digits (sensitive data in Stripe)
- **Priority**: Medium

#### FR-BILL-05: Usage Tracking
- **Description**: Track interviews conducted, AI tokens used, active users per billing period
- **Alerts**: Approaching limit notifications
- **Priority**: Medium

---

### 3.7 AI Configuration & Management

#### FR-AI-01: AI Provider Management
- **Description**: Configure and manage AI providers
- **Providers**: Google Gemini (primary), OpenAI (optional)
- **Features**:
  - Provider registry with credentials management
  - AES-encrypted API key storage
  - Feature-to-model mapping with A/B testing
  - Feature toggles and fallback configuration
- **Priority**: High

#### FR-AI-02: AI Health Monitoring
- **Description**: Monitor AI service health and performance
- **Metrics**: Response time, success rate, token usage, cost per request
- **Dashboard**: Real-time health status, usage graphs, cost monitoring
- **Priority**: Medium

#### FR-AI-03: AI Usage Monitoring
- **Description**: Track and limit AI usage per organization
- **Tracking**: Tokens consumed, requests made, cost per feature, latency percentiles
- **Priority**: Medium

---

### 3.8 Platform Administration

#### FR-ADMIN-01: Platform Admin Hub
- **Description**: Central dashboard for platform administration
- **Access**: `platform_admin` only
- **Features**: Organization overview, user counts, system health, quick actions
- **Priority**: High

#### FR-ADMIN-02: Organization Management
- **Description**: Create, edit, deactivate organizations across the platform
- **Priority**: High

#### FR-ADMIN-03: Unified User Management
- **Description**: Manage all users across organizations
- **Features**: User list, search, role assignment, deactivation, impersonation
- **Priority**: High

#### FR-ADMIN-04: Partner Application Review
- **Description**: Review and approve/reject partner applications
- **Priority**: Medium

#### FR-ADMIN-05: Platform Configuration
- **Description**: Key-value platform settings management
- **Categories**: System config, email configuration, AI settings, payment gateways
- **Priority**: Medium

#### FR-ADMIN-06: Operation Logs & Monitoring
- **Description**: View and analyze platform operation logs
- **Pages**: Operation logs, log analysis (AI-powered), pre-interview check logs
- **Priority**: Medium

#### FR-ADMIN-07: Scheduled Jobs
- **Description**: Manage cron jobs for automated tasks
- **Jobs**: Data cleanup, deadline enforcement, stale session cleanup, reminder emails
- **Priority**: Low

---

### 3.9 Notifications & Communication

#### FR-NOTIF-01: In-App Notifications
- **Description**: Real-time notifications for platform events
- **Types**: New candidate submission, assessment report ready, invitation accepted, etc.
- **Features**: All/Unread tabs, Mark all read button, notification list
- **Priority**: High

#### FR-NOTIF-02: Email Notifications
- **Description**: Transactional emails for key events
- **Types**: Welcome, verification, invitation, reminder, password reset, review request
- **AI Enhancement**: Optional AI-powered email content enhancement
- **Customization**: Email templates with subject and body configuration
- **Priority**: High

---

### 3.10 JD Builder & Templates

#### FR-JD-01: JD Builder Wizard
- **Description**: AI-assisted job description creation
- **Features**:
  - Job title searchable dropdown
  - Step-by-step wizard with Next/Back navigation
  - AI-generated JD content with suggestions
  - Skill extraction from generated JD
  - Direct flow to interview creation
- **Priority**: Medium

#### FR-JD-02: Interview Templates
- **Description**: Reusable interview templates
- **Features**:
  - Template library with search and filters
  - Seniority filter (Junior, Mid, Senior, Lead)
  - Save interview config as template
  - Create interview from template
- **Priority**: Medium

#### FR-JD-03: Question Repository
- **Description**: Centralized question bank
- **Features**: Search by keyword, filter by topic, question cards with type/difficulty badges
- **Priority**: Medium

---

### 3.11 Reporting & Export

#### FR-RPT-01: Assessment Reports
- **Description**: Detailed per-candidate assessment reports
- **Content**: Overall score, topic scores, hiring decision, CPI breakdown, strengths/weaknesses, per-question analysis
- **Priority**: High

#### FR-RPT-02: Report Builder
- **Description**: Custom report generation
- **Priority**: Medium

#### FR-RPT-03: Data Export
- **Description**: Export data in multiple formats
- **Formats**: PDF (jsPDF), Word (docx), Excel (exceljs), HTML (html2canvas)
- **Priority**: Medium

---

### 3.12 Chatbot

#### FR-CHAT-01: AI Chatbot Assistant
- **Description**: Platform assistance chatbot powered by AI
- **Data Source**: `chatbot_knowledge` table with Q&A pairs
- **Management**: `/admin/chatbot-management` for knowledge base CRUD
- **Priority**: Low

---

## 4. External Interface Requirements

### 4.1 User Interface

| Requirement | Specification |
|-------------|--------------|
| **Framework** | React 18.3 SPA with React Router v6 |
| **Component Library** | shadcn/ui (50+ Radix primitives) |
| **Styling** | Tailwind CSS 3.4 with CSS variables theming |
| **Responsive** | Mobile-first, supports 320px–4K displays |
| **Dark Mode** | Supported via CSS class toggle |
| **Accessibility** | Radix primitives provide ARIA attributes |
| **Code Editor** | Monaco Editor for coding questions |
| **Charts** | Recharts for analytics visualizations |
| **Diagrams** | Mermaid for architecture rendering |
| **Icons** | Lucide React icon set |
| **Toasts** | Sonner toast notifications |
| **Loading States** | Skeleton loaders, PageLoader spinner |
| **Lazy Loading** | Heavy pages (proctoring, interviews) loaded lazily |

### 4.2 Hardware Interfaces

| Interface | Purpose |
|-----------|---------|
| Camera (WebRTC) | Video recording for proctoring |
| Microphone (WebRTC) | Audio recording for proctoring |
| Screen Share (getDisplayMedia) | Screen recording for proctoring |

### 4.3 Software Interfaces

| External System | Protocol | Purpose |
|----------------|----------|---------|
| Google Gemini API | HTTPS/REST | AI question generation and evaluation |
| Stripe API | HTTPS/REST | Payment processing, subscriptions |
| Supabase GoTrue | HTTPS/REST | Authentication (email/password) |
| Supabase PostgREST | HTTPS/REST | Database CRUD via REST |
| Supabase Realtime | WebSocket | Real-time data subscriptions |
| Supabase Storage | HTTPS/REST | File/recording storage |
| SMTP Server | SMTP | Transactional email delivery |
| ATS Webhooks | HTTPS | Applicant tracking system integration |

### 4.4 Communication Interfaces

| Protocol | Usage |
|----------|-------|
| HTTPS | All API communication (TLS 1.2+) |
| WebSocket | Real-time notifications, proctoring broadcasts |
| REST | CRUD operations via PostgREST |
| RPC | Secure database function calls |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Requirement |
|--------|-------------|
| **Page Load** | First meaningful paint < 3s on 4G |
| **API Response** | 95th percentile < 2s for CRUD operations |
| **AI Generation** | Question generation < 60s for 50 questions |
| **AI Evaluation** | Candidate evaluation < 30s |
| **Concurrent Users** | Support 1,000 concurrent sessions (PgBouncer) |
| **Max Upload** | Recording chunks up to 50MB each |
| **Network Threshold** | Minimum 1 Mbps for proctored sessions |

### 5.2 Reliability & Availability

| Metric | Requirement |
|--------|-------------|
| **Uptime Target** | 99.5% monthly |
| **Auto-Recovery** | Automatic session resume on connection loss |
| **Retry Policy** | 3 attempts, 1s→5s exponential backoff (1.5× multiplier) |
| **Retryable Errors** | Network failures, HTTP 5xx, HTTP 429 (rate limit) |
| **Background Upload** | Background upload handler for interrupted transfers |
| **Error Boundaries** | React ErrorBoundary at root + per-section with Sentry reporting |

### 5.3 Scalability

| Dimension | Specification |
|-----------|--------------|
| **Database Connections** | PgBouncer: 1,000 max clients |
| **Container Orchestration** | Docker Compose (dev), Kubernetes + Helm (production) |
| **Edge Functions** | Stateless Deno functions, horizontally scalable |
| **Storage** | Supabase Storage API (S3-compatible backend) |
| **CDN** | Nginx serves static assets with 1-year cache headers |

### 5.4 Security

See [Section 7: Security Requirements](#7-security-requirements).

### 5.5 Usability

| Requirement | Specification |
|-------------|--------------|
| **Onboarding** | Interactive tour + onboarding checklist for new users |
| **Error Messages** | PostgreSQL errors mapped to user-friendly messages |
| **Toast Notifications** | Consistent success/error/info toast styling |
| **Breadcrumbs** | Role-aware breadcrumbs on all protected pages |
| **Role-Based Navigation** | Navigation adapts to user's active role |
| **Keyboard Shortcuts** | Command palette for power users |

### 5.6 Maintainability

| Requirement | Specification |
|-------------|--------------|
| **Type Safety** | Full TypeScript across frontend |
| **Code Quality** | ESLint with custom rules |
| **Testing** | 630 E2E tests (Playwright), Vitest unit tests |
| **Logging** | 4-layer logging: logger, systemLogger, operationLogger, audit-logger |
| **Error Monitoring** | Sentry integration with section-tagged error boundaries |

### 5.7 Portability

| Platform | Support |
|----------|---------|
| **Web** | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| **iOS** | Via Capacitor hybrid app (iOS 14+) |
| **Android** | Via Capacitor hybrid app (Android 10+) |
| **Deployment** | Docker containers, Kubernetes, AWS (migration planned) |

---

## 6. Data Requirements

### 6.1 Database Tables (60+ tables)

#### Core Entities

| Table | Description | Key Relations |
|-------|-------------|---------------|
| `profiles` | User profiles | FK → `auth.users` |
| `user_roles` | Role assignments | FK → `profiles` |
| `organizations` | Multi-tenant orgs | — |
| `organization_members` | Org membership | FK → `organizations`, `profiles` |
| `interviews` | Interview templates | FK → `organizations`, `profiles` |
| `questions` | Question bank | FK → `interviews` |
| `interview_invitations` | Candidate invitations | FK → `interviews` |
| `interview_attempts` | Candidate submissions | FK → `interviews` |
| `attempt_questions` | Question-attempt junction | FK → `interview_attempts`, `questions` |
| `assessments` | AI evaluation results | FK → `interview_attempts` |

#### Proctoring

| Table | Description |
|-------|-------------|
| `proctoring_sessions` | Recording URLs, violations, integrity score |
| `preinterview_check_logs` | Camera/mic/network/lighting status |
| `candidate_performance_index` | CPI scores per candidate |

#### Billing

| Table | Description |
|-------|-------------|
| `subscription_plans` | Plan definitions |
| `organization_subscriptions` | Org-plan links |
| `invoices` | Invoice records |
| `usage_tracking` | Per-period usage |
| `payment_gateways` | Stripe configuration |
| `payment_methods` | Card details |
| `payment_transactions` | Charge records |

#### Learning

| Table | Description |
|-------|-------------|
| `learning_assessments` | Practice assessments |
| `learning_assessment_questions` | Assessment questions |
| `learning_assessment_attempts` | User attempts |
| `learning_assessment_feedback` | AI feedback |
| `training_plans` | Training plan definitions |
| `training_topics` | Topics in plans |
| `learning_materials` | Materials per topic |
| `user_training_assignments` | User-plan links |
| `user_topic_progress` | Progress tracking |
| `certification_topics` | Cert definitions |
| `certification_questions` | Cert exam questions |
| `certification_attempts` | User cert attempts |
| `user_certificates` | Issued certificates |

#### AI & Platform

| Table | Description |
|-------|-------------|
| `ai_providers` | Provider registry |
| `ai_provider_credentials` | Encrypted API keys |
| `ai_model_configurations` | Model-feature mapping |
| `ai_feature_configurations` | Feature toggles |
| `ai_usage_logs` | Token/cost/latency tracking |
| `platform_configurations` | Key-value settings |
| `audit_logs` | Action audit trail |
| `security_events` | Security event logs |
| `notifications` | User notifications |

### 6.2 Data Retention

| Data Type | Retention |
|-----------|-----------|
| Audit logs | 90 days |
| Proctoring recordings | Configurable per organization |
| Security events | 90 days |
| Interview attempts | Indefinite (org-managed) |
| Certificates | Indefinite |

### 6.3 Data Privacy (GDPR)

- **Right to Access**: Users can view all their personal data
- **Right to Deletion**: Account deletion removes profile, roles, and personal data
- **Consent**: Explicit proctoring consent required before recording
- **Encryption**: API keys encrypted with AES; passwords with bcrypt
- **PII Protection**: Candidate email/name immutable after attempt creation

---

## 7. Security Requirements

### 7.1 Authentication Security

| Requirement | Implementation |
|-------------|---------------|
| **SR-01**: Password hashing | bcrypt via GoTrue |
| **SR-02**: JWT session tokens | Signed JWTs with configurable expiration |
| **SR-03**: Email verification | Required before protected access (configurable) |
| **SR-04**: Auto token refresh | 60-second buffer check |
| **SR-05**: HTTPS only | TLS 1.2+ enforced |

### 7.2 Authorization Security

| Requirement | Implementation |
|-------------|---------------|
| **SR-06**: RBAC enforcement | 6 roles, 38 permissions, route/component/DB level |
| **SR-07**: Row-Level Security | 406 RLS policies on all tables |
| **SR-08**: God mode isolation | `platform_admin` bypasses role checks (explicit) |
| **SR-09**: Organization isolation | RLS ensures org data is siloed |
| **SR-10**: Service role restricted | Service key only in edge functions, never client-exposed |

### 7.3 Data Security

| Requirement | Implementation |
|-------------|---------------|
| **SR-11**: API key encryption | AES encryption for AI provider credentials |
| **SR-12**: Session token validation | 64-char base64 tokens, validated per request |
| **SR-13**: Answer protection | Correct answers hidden from candidates via RLS |
| **SR-14**: PII immutability | Candidate email/name locked after attempt creation |
| **SR-15**: Error sanitization | Technical errors masked to user-friendly messages |

### 7.4 Infrastructure Security

| Requirement | Implementation |
|-------------|---------------|
| **SR-16**: CORS configuration | Configured on edge functions and API gateway |
| **SR-17**: Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| **SR-18**: Non-root container | Nginx runs as non-root user |
| **SR-19**: Gzip compression | Enabled for text responses |
| **SR-20**: Static asset caching | 1-year cache headers, versioned filenames |

### 7.5 Monitoring & Audit

| Requirement | Implementation |
|-------------|---------------|
| **SR-21**: Audit logging | All admin actions logged to `audit_logs` |
| **SR-22**: Security event logging | Security events logged to `security_events` |
| **SR-23**: Error monitoring | Sentry integration for runtime errors |
| **SR-24**: AI health monitoring | Continuous health checks on AI services |

---

## 8. Appendices

### 8.1 Edge Functions Catalog (107 functions)

| Category | Functions | Count |
|----------|-----------|-------|
| Interview & AI | generate-questions, evaluate-interview, generate-job-description, extract-skills, enhance-job-description, suggest-jd-content, regenerate-questions, batch-regenerate-questions, detect-bias, calculate-cpi, parse-resume | 11 |
| Assessment & Learning | evaluate-learning-assessment, evaluate-certification, generate-learning-questions, generate-certification-questions, generate-training-plan, refine-assessment-feedback | 6 |
| Proctoring | init-proctoring-session, update-proctoring-session, log-proctoring-violation, analyze-violations, analyze-proctoring-video, cleanup-proctoring-chunks, cleanup-stale-proctoring, get-proctoring-upload-url, get-chunk-upload-url, upload-proctoring-recording, upload-proctoring-screenshot, confirm-proctoring-upload, merge-proctoring-chunks, repair-webm-metadata, auto-close-sessions | 15 |
| User Management | complete-user-signup, complete-password-setup, admin-user-management, manage-organization-user | 4 |
| Notifications & Email | send-email, send-notification, send-interview-invitations, send-invitation-reminders, send-verification-email, send-password-setup, send-review-request, resend-email, auth-email-hook, enhance-email-content | 10 |
| Billing | generate-invoice, approve-partner-application, fix-pending-invitations, delete-organization | 4 |
| Documentation & Testing | generate-documentation, generate-documentation-from-code, generate-architecture-docs, update-architecture-diagram, generate-schema, run-tests, run-flow-tests, run-comprehensive-flow-test, analyze-test-error, auto-fix-issue, validate-test-data, seed-test-data, seed-flow-data, cleanup-test-data | 14 |
| Platform | chatbot-assist, scan-platform-features, scan-ai-features, test-ai-connection, test-configuration, schedule-interview, manage-scheduled-jobs, scheduled-data-cleanup, enforce-interview-deadlines, ats-webhook, sync-ats-candidates, generate-certificate-pdf | 12 |
| Other | Remaining utility functions | 31 |

### 8.2 Database Functions (123 functions)

Key security-critical functions (SECURITY DEFINER):
- `has_role(uid, role)` / `has_any_role(uid, roles[])`
- `user_is_org_member()` / `user_is_org_admin()`
- `can_access_interview()` / `can_access_org_data()`
- `encrypt_api_key()` / `decrypt_api_key()`
- `generate_share_token()` / `generate_session_token()`
- `create_interview_attempt()` / `update_attempt_with_session()`
- `get_interview_for_candidate()` / `get_questions_for_candidate()`
- `can_user_retake_certification()`

### 8.3 Validation Schemas Summary

| Schema | Fields | Key Rules |
|--------|--------|-----------|
| `signUpSchema` | email, password, fullName | See FR-AUTH-01 |
| `signInSchema` | email, password | Email ≤255, password required |
| `createInterviewSchema` | title, jobDescription, questionCount, timeLimit, difficultyDistribution | See FR-INT-01 |
| `candidateInfoSchema` | candidateName, candidateEmail | 2–100 chars, letters; valid email |
| `profileUpdateSchema` | fullName | 2–100 chars, letters only |
| `answerSchema` | answer | 1–5,000 chars |
| `passwordChangeSchema` | newPassword, confirmPassword | Match + strength rules |
| `roleAssignmentSchema` | role | Enum of valid roles |
| `interviewSubmissionSchema` | sessionToken, answers, timeTaken | Token ≥32, time 0–86,400s |

---

*End of Requirements Document*
