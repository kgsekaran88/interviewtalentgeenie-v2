# InterviewTalentGeenie — Functional Specification

> **Version**: 1.0 (Baseline)  
> **Date**: 19 February 2026  
> **Source**: Migrated from Lovable Cloud to Self-hosted Docker Supabase

---

## 1. Application Overview

**InterviewTalentGeenie** is an AI-powered interview assessment and talent evaluation platform built with React + Vite + TypeScript (frontend) and Supabase + Deno Edge Functions (backend). It is a multi-tenant SaaS platform serving organizations that create, manage, and administer technical interviews with AI-generated questions, automated proctoring, and AI-powered evaluation.

---

## 2. User Roles & Access Control

### 2.1 Core Roles (6)

| Role | Description | Access Scope |
|------|-------------|-------------|
| `platform_admin` | **Superuser** — bypasses all role checks | Full platform: all organizations, all features, system configuration |
| `partner_admin` | Organization owner/administrator | Their organization: users, interviews, billing, analytics, settings |
| `hr` | HR/recruiting team member | Create/manage interviews, view reports, manage candidates, proctoring |
| `tech_spoc` | Technical reviewer | Review pending interview questions, view reports, limited interview access |
| `finance_controller` | Financial point of contact | Billing info, invoices, subscription management only |
| `learner` | Default role after sign-up | Learning hub access only |

### 2.2 Key Behaviors

- `platform_admin` is a **superuser** — `isPlatformAdmin()` always returns `true`
- Roles stored in `user_roles` table, scoped by `organization_id`
- Custom roles supported via `custom_roles` and `user_custom_roles` tables
- 9 permission categories: Interviews, Users, Reports, Analytics, Billing, Organizations, Settings, Proctoring, Learning (37 total permissions)

### 2.3 Role-Based Redirects

| Role | Redirect Target |
|------|----------------|
| `platform_admin` | `/partner/portal` (or `/admin/hub` if not impersonating) |
| `partner_admin` | `/partner/portal` |
| `hr` | `/partner/recruiting/interviews` |
| `tech_spoc` | `/partner/recruiting/pending-reviews` |
| `learner` | `/learning-dashboard` |
| No roles | `/partner/onboarding` |

---

## 3. Complete Route Map

### 3.1 Public Routes (No Authentication Required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Index` | Marketing landing page with role-specific CTAs |
| `/auth` | `Auth` | Unified auth flow (email check → sign in / sign up) |
| `/auth/callback` | `AuthCallback` | Email verification callback page |
| `/auth/verify` | `EmailVerification` | Email verification handler |
| `/interview/:id` | `CandidateInterview` | Candidate interview page (readable URL) |
| `/candidate-interview/:id` | `CandidateInterview` | Legacy candidate interview URL |
| `/interview-complete` | `InterviewComplete` | Post-interview completion page |
| `/learning-assessment/:id` | `LearningAssessment` | Learning assessment page |
| `/learning-progress/:id` | `LearningProgress` | Learning progress view |
| `/assessment-feedback/:id` | `AssessmentFeedback` | Assessment feedback |
| `/forgot-password` | `ForgotPassword` | Password reset request |
| `/reset-password` | `ResetPassword` | Password reset confirmation |
| `/pricing` | `InterviewPricing` | Interview pricing page |
| `/learning` | `LearningCatalog` | Learning/certification catalog (public) |
| `/learning-pricing` | `LearningPricing` | Learning subscription pricing |
| `/certifications` | `Certifications` | Certification catalog |
| `/verify-certificate/:code` | `VerifyCertificate` | Public certificate verification |
| `/partner/payment-setup` | `PaymentSetup` | Payment setup for partners |
| `/partner/onboarding` | `PartnerOnboarding` | Partner application/onboarding |

### 3.2 Protected Routes (Authentication Required, Any Role)

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `Dashboard` | Smart redirect to role-specific dashboard |
| `/profile` | `Profile` | User profile management |
| `/profile/partner-applications` | `PartnerApplications` | User's partner applications |
| `/notifications` | `Notifications` | Notification center |
| `/settings` | `Settings` | User settings |
| `/learning/:topicId/configure` | `ConfigureAssessment` | Configure practice assessment |
| `/certification/:topicId/exam` | `CertificationExam` | Take certification exam |
| `/certification/:topicId/results` | `CertificationResults` | Certification results |
| `/learning-dashboard` | `LearningDashboard` | Personal learning hub |
| `/learning-history` | `LearningHistory` | Learning history |
| `/my-learning-plan` | `MyLearningPlan` | Personal learning plan |
| `/my-certificates` | `MyCertificates` | Earned certificates |

### 3.3 Platform Admin Routes (`/admin/*`)

Required role: `platform_admin`. Uses `PlatformAdminLayout`.

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin/hub` | `AdminHub` | Admin dashboard with categorized admin sections |
| `/admin/partners` | `PartnerManagement` | Manage all partner organizations |
| `/admin/users` | `UserManagement` | Platform-wide user management |
| `/admin/partner-applications` | `PartnerApplicationReview` | Review partner applications |
| `/admin/role-assignment` | `RoleAssignment` | Assign roles to users |
| `/admin/role-permissions` | `RolePermissions` | Configure RBAC permissions |
| `/admin/analytics` | `Analytics` | Platform-wide analytics |
| `/admin/settings` | `PlatformSettings` | Platform settings |
| `/admin/docs` | `Documentation` | Platform documentation |
| `/admin/architecture` | `ArchitectureDocs` | Architecture documentation |
| `/admin/billing` | `BillingManagement` | Global billing management |
| `/admin/training-plans` | `TrainingPlanAdmin` | Training plan management |
| `/admin/learning-management` | `LearningManagement` | Learning content management |
| `/admin/certification-admin` | `CertificationAdmin` | Certification topic management |
| `/admin/certification-analytics` | `CertificationAnalytics` | Certification metrics |
| `/admin/certification-settings` | `CertificationSettings` | Certification settings |
| `/admin/ai-configuration` | `AIConfiguration` | AI model configuration |
| `/admin/chatbot-management` | `ChatbotManagement` | AI chatbot settings |
| `/admin/testing` | `TestingManagement` | Testing management hub |
| `/admin/deployment` | `DeploymentConfiguration` | Deployment configuration |
| `/admin/deployment-status` | `DeploymentStatus` | Deployment status |
| `/admin/deployment-history` | `DeploymentHistory` | Deployment history |
| `/admin/proctoring-settings` | `ProctoringSettings` | Global proctoring settings |
| `/admin/subscription-plans` | `SubscriptionPlanManagement` | Subscription plan configuration |
| `/admin/promotions` | `PromotionManagement` | Coupon/discount management |
| `/admin/learning-plan-pricing` | `LearningPlanPricing` | Learning plan pricing |
| `/admin/payment-gateways` | `PaymentGatewayConfig` | Payment gateway config (Stripe, Razorpay) |
| `/admin/email-configuration` | `EmailConfiguration` | Email provider setup (Resend) |
| `/admin/candidate-debug` | `CandidateDebug` | Debug candidate setup issues |
| `/admin/operation-logs` | `OperationLogs` | Interview operation tracking |
| `/admin/log-analysis` | `AILogAnalysis` | AI-powered log analysis |
| `/admin/cost-monitoring` | `CostMonitoring` | AI/storage cost tracking |
| `/admin/cron-management` | `CronManagement` | Cron job management |
| `/admin/ai-usage` | `AIUsageMonitoring` | AI token/cost monitoring |
| `/admin/system-monitoring` | `SystemMonitoring` | Platform health diagnostics |
| `/admin/assessment-report/:id` | `AssessmentReport` | View assessment report |

### 3.4 Partner/Organization Routes (`/partner/*`)

Required roles: `partner_admin`, `hr`, `tech_spoc`, `finance_controller`, or `platform_admin`. Uses `PartnerLayout`.

| Route | Component | Description |
|-------|-----------|-------------|
| `/partner` or `/partner/portal` | `PartnerPortal` | Organization overview dashboard (draggable cards) |
| `/partner/dashboard` | `UnifiedDashboard` | Unified analytics dashboard |
| `/partner/settings` | `PartnerSettings` | Organization settings |
| `/partner/analytics` | `PartnerAnalytics` | Organization analytics |
| `/partner/users` | `PartnerUsers` | Organization user management |
| `/partner/organization/:id` | `OrganizationManagement` | Manage specific organization |
| `/partner/billing` | `PartnerBilling` | Organization billing |
| `/partner/reports` | `PartnerReports` | Partner reports (admin/partner_admin only) |

### 3.5 Recruiting Routes (`/partner/recruiting/*`)

Required roles: `partner_admin`, `hr`, `tech_spoc`, `platform_admin`. Uses `PartnerLayout`.

| Route | Component | Description |
|-------|-----------|-------------|
| `/partner/recruiting/jd-builder` | `JDBuilder` | AI Job Description builder wizard |
| `/partner/recruiting/create-interview` | `CreateInterview` | Interview configuration & creation |
| `/partner/recruiting/quick-create` | `QuickCreateInterview` | Quick interview creation |
| `/partner/recruiting/progress/:id` | `QuestionGenerationProgress` | AI question generation progress |
| `/partner/recruiting/interviews` | `InterviewList` | Interview list (cards/table/compact views) |
| `/partner/recruiting/interviews/:id` | `InterviewDetail` | Interview details & candidate management |
| `/partner/recruiting/interview/:id/preview` | `InterviewPreview` | Preview generated questions |
| `/partner/recruiting/pending-reviews` | `PendingReviews` | Questions pending tech review |
| `/partner/recruiting/assessment/:id` | `AssessmentReport` | Candidate assessment report |
| `/partner/recruiting/proctoring/:id` | `ProctoringDashboard` | Proctoring session dashboard |
| `/partner/recruiting/proctoring-settings` | `ProctoringSettings` | Proctoring config |
| `/partner/recruiting/proctoring-test` | `ProctoringTest` | Proctoring test page |
| `/partner/recruiting/question-repository` | `QuestionRepository` | Reusable question bank |
| `/partner/recruiting/templates` | `InterviewTemplates` | Interview templates |
| `/partner/recruiting/report-builder` | `ReportBuilder` | Custom report builder |

---

## 4. Authentication Flows

### 4.1 Registration

1. User navigates to `/auth`
2. Enters email → `check_email_exists` RPC determines if sign-in or sign-up
3. **Sign Up**: email + password + full name → `supabase.auth.signUp()` → `complete-user-signup` edge function
4. Edge function: creates profile, assigns `learner` role, initializes onboarding progress
5. Email verification sent via SMTP (Resend)
6. User clicks verification link → `/auth/callback` → confirmed

### 4.2 Sign In

1. User enters email + password → `supabase.auth.signInWithPassword()`
2. Role-based redirect per Section 2.3

### 4.3 Email Verification

- Uses Supabase native email confirmation
- Redirect to `/auth/callback` handler
- Profile has `email_verified` flag checked by `useEmailVerification` hook
- Platform admins bypass verification

### 4.4 Password Reset

1. `/forgot-password` → user enters email → Supabase sends reset email
2. User clicks link → `/reset-password` → enters new password

### 4.5 Partner Onboarding

1. Guest user → `/partner/onboarding`
2. Fills company details & selects subscription plan
3. Creates entry in `partner_applications` table
4. Platform admin reviews at `/admin/partner-applications`
5. `approve-partner` edge function → creates organization, assigns `partner_admin` role

### 4.6 Password Setup Invitations

- Existing users invited via `send-password-setup` edge function
- Recipient completes via `complete-password-setup` flow

---

## 5. Edge Functions (107 Functions by Feature Area)

### 5.1 Interview Management (Core)

| Function | Description |
|----------|-------------|
| `generate-questions` | AI question generation from job description |
| `regenerate-question` / `regenerate-questions` | Re-generate individual/bulk questions |
| `evaluate-interview` | AI evaluation of candidate responses |
| `auto-evaluate-interview` | Auto-trigger evaluation after submission |
| `process-evaluation-queue` | Process queued evaluations |
| `delete-interview` | Soft-delete interview with cascade |
| `schedule-interview` | Schedule interview sessions |
| `send-interview-invitations` | Send candidate invite emails |
| `send-invitation-reminders` | Reminder emails for pending invitations |
| `enforce-interview-deadlines` | Auto-enforce deadline rules |
| `resolve-invitation` / `resolve-invitation-token` | Resolve invite tokens |
| `reassign-questions` / `reassign-questions-to-invitation` | Reassign questions to invitations |
| `reconstruct-interview` | Reconstruct interview data |
| `check-interview-limits` | Check org usage limits |

### 5.2 Question Management

| Function | Description |
|----------|-------------|
| `add-questions` | Add questions to interview |
| `approve-questions` | Tech SPOC approves questions |
| `get-approved-questions` | Fetch approved question bank |
| `submit-for-review` | Submit questions for tech review |
| `send-review-request` | Notify tech SPOC of review request |
| `detect-bias` | AI bias detection in questions |

### 5.3 AI & Content Generation

| Function | Description |
|----------|-------------|
| `generate-jd` / `enhance-jd` / `generate-jd-from-skills` | JD creation/enhancement |
| `enhance-content-with-ai` | Generic AI content enhancement |
| `extract-skills` | Extract skills from job descriptions |
| `generate-predictive-analytics` | Predictive candidate analytics |
| `generate-comparative-report` / `generate-custom-report` | Report generation |
| `calculate-cpi` | Candidate Performance Index calculation |
| `validate-ai-config` | Validate AI provider connectivity |
| `scan-features` / `scan-features-detailed` | Feature scanning |
| `update-ai-assignments` | Update AI model assignments |
| `ai-health-monitor` | Monitor AI service health |
| `chatbot-assist` | AI chatbot responses |

### 5.4 Proctoring & Integrity

| Function | Description |
|----------|-------------|
| `initialize-proctoring` | Initialize proctoring for attempt |
| `update-proctoring-session` | Update session state |
| `record-violation` | Record integrity violations |
| `analyze-proctoring-video` | AI video analysis post-interview |
| `analyze-violations` | Analyze violation patterns |
| `get-signed-upload-url` / `get-signed-urls` | Signed upload URLs |
| `upload-proctoring-recording` / `upload-proctoring-screenshot` | Handle uploads |
| `confirm-proctoring-upload` | Confirm upload completion |
| `merge-proctoring-chunks` | Merge chunked video uploads |
| `fix-webm-metadata` | Fix WebM metadata issues |
| `cleanup-proctoring-data` / `cleanup-old-proctoring` | Cleanup old data |
| `auto-close-sessions` | Auto-close abandoned sessions |

### 5.5 Learning & Certification

| Function | Description |
|----------|-------------|
| `generate-learning-questions` | Generate learning assessment questions |
| `evaluate-learning` | Evaluate learning responses |
| `generate-certification-questions` | Certification exam questions |
| `evaluate-certification` | Evaluate certification attempts |
| `generate-certificate-pdf` | PDF certificate generation |
| `generate-training-plan` | AI training plan generation |

### 5.6 User & Organization Management

| Function | Description |
|----------|-------------|
| `complete-user-signup` | Post-registration setup |
| `complete-password-setup` | Complete password setup invitation |
| `manage-user` | Admin user operations |
| `manage-organization-members` | Org member management |
| `approve-partner` | Approve partner applications |
| `delete-organization` | Delete organization with cascade |
| `fix-pending-invitations` | Fix stuck invitations |
| `cleanup-users` | Bulk user cleanup |

### 5.7 Communication

| Function | Description |
|----------|-------------|
| `send-email` / `send-enhanced-email` | Email sending with AI enhancement |
| `send-notification` | In-app notifications |
| `verify-email` / `verify-email-direct` | Email verification |
| `send-password-setup` | Password setup emails |
| `retry-failed-emails` | Resend failed emails |
| `auth-email-hook` | Auth email customization hook |

### 5.8 Billing & Payments

| Function | Description |
|----------|-------------|
| `generate-invoice` | Invoice generation |
| `export-data` | Data export for compliance |

### 5.9 Code Execution

| Function | Description |
|----------|-------------|
| `execute-code` | Sandboxed code execution for coding questions |

### 5.10 ATS Integration

| Function | Description |
|----------|-------------|
| `ats-webhook` | Incoming ATS webhooks |
| `sync-ats-candidates` | Sync candidates from ATS |
| `parse-resume` | AI resume parsing |

### 5.11 Analytics & Monitoring

| Function | Description |
|----------|-------------|
| `analyze-logs` | AI-powered log analysis |
| `diagnose-issue` / `auto-fix-issue` | Auto-diagnose & fix issues |
| `generate-architecture-docs` / `generate-docs` / `generate-schema-docs` | Auto-documentation |
| `improve-doc-formatting` | Improve doc formatting |
| `generate-schema` / `generate-architecture` | Schema/architecture generation |
| `detect-changes` | Detect source code changes |

### 5.12 System Operations

| Function | Description |
|----------|-------------|
| `manage-scheduled-jobs` | Cron job management |
| `scheduled-cleanup` | Scheduled data retention cleanup |
| `fix-stuck-generation` | Fix stuck question generation |
| `run-e2e-tests` / `run-flow-tests` / `run-tests` | Automated testing |
| `create-test-data` / `generate-test-data` / `reset-test-data` / `cleanup-test-data` | Test data management |
| `validate-config` | Configuration validation |

---

## 6. Navigation Structure

### 6.1 Top Navbar

- Dashboard (all org users)
- Create Position (hr/admin roles)
- Platform Admin Hub (platform_admin)
- Partner Portal (org members)
- Proctoring (hr/admin)
- Learning Hub (all)
- Docs (platform_admin)

### 6.2 Platform Admin Hub Categories

- **Critical Operations**: Partner Organizations, User Management, Role Permissions
- **Billing & Subscriptions**: Plans, Learning Plans, Payment Gateways, Promotions, Billing, Cost Monitoring
- **Monitoring & Analytics**: System Monitoring, AI Usage, Log Analysis, Pre-Interview Logs, Operation Logs, Scheduled Jobs, Analytics
- **Communications**: Email Configuration
- **Learning & Certification**: Learning Management, Training Plans, Certification Admin/Analytics
- **AI & Automation**: AI Configuration, Chatbot Management

### 6.3 Sidebar Sections

- **Main**: Home, Interviews
- **Learning**: Learning Hub, Create Assessment, My Learning Plan, Certifications
- **Admin** (role-gated): Create Interview, Question Repository, Templates, Proctoring, Analytics, Report Builder, Manage Users, Training Admin, Testing Hub, Scheduled Jobs, Platform Settings, Documentation

---

## 7. Key Features & Modules

### 7.1 Interview Creation Pipeline

1. **JD Builder Wizard** — Multi-step wizard: select job title → auto-suggest skills → generate AI job description → configure assessment
2. **Interview Configuration** — Set question count (5-100), time limit, question type distribution (MCQ/scenario/coding/descriptive), difficulty per category, coding schema, proctoring settings, required question rules
3. **AI Question Generation** — Edge function generates questions from JD with progress tracking, topic distribution, experience-level calibration
4. **Question Review** — Questions can be submitted for tech SPOC review, approved/rejected, regenerated individually or in bulk
5. **Question Repository** — Reusable question bank across interviews
6. **Templates** — Save/load interview configuration templates

### 7.2 Candidate Assessment

1. **Invitation System** — Invite candidates via email with shareable links
2. **Interview Taking** — Candidates answer questions with timer, code editor for coding questions, auto-save answers
3. **Proctoring** — Camera/screen recording, face detection, gaze detection, liveness detection, voice analysis, tab-switch detection, copy-paste detection, phone/object detection, multi-person detection
4. **AI Evaluation** — Automated scoring with detailed analysis, topic scores, hiring decision (Strong Hire/Hire/No Hire), strengths/weaknesses identification
5. **Assessment Report** — Comprehensive report with scores, integrity checks, proctoring violations, question-level analysis, exportable to PDF/DOCX
6. **CPI Score** — Candidate Performance Index combining technical score, problem-solving score, and integrity score

### 7.3 Proctoring System

- Pre-interview checks (camera, microphone, screen share)
- Real-time monitoring (face detection, gaze tracking, tab switches)
- Video/screen chunk uploading with background upload
- Post-interview AI video analysis
- Violation types: `multiple_persons`, `multiple_voices`, `tab_switch`, `look_away`, `copy_attempt`, `eye_movement`, `liveness_fail`, `person_swap`, `phone_detected`, `prohibited_object`, etc.
- Integrity score calculation with violation toggle (ignore/un-ignore)
- Configurable thresholds and settings per organization

### 7.4 Learning & Certification Platform

- **Learning Hub** — Browse topics, take practice assessments
- **Certification Exams** — Timed, proctored certification exams with AI-generated questions
- **Certificates** — PDF certificates with unique verification codes, public verification page
- **Learning Plans** — Personalized learning plans with topic progress tracking
- **Badges** — Achievement badges auto-awarded based on performance
- **Subscription** — Learning subscriptions with daily free assessment limits

### 7.5 Organization (Multi-Tenant) Management

- **Partner Onboarding** — Application → review → approval → organization creation
- **Organization Portal** — Dashboard with usage stats, member management, subscription info
- **Impersonation** — Platform admin can impersonate any organization
- **Organization Members** — Invite/manage users within organization
- **Subscription Plans** — Configurable plans with interview limits, user limits, pricing

### 7.6 Billing & Payments

- **Payment Gateways** — Stripe, Razorpay support with test/live modes
- **Invoices** — Auto-generated invoices with line items
- **Promotions** — Coupon codes, discounts, org-specific promotions
- **Usage Tracking** — Interview usage tracked per organization

### 7.7 AI Configuration

- Multi-provider AI support (model configurations, provider credentials)
- Feature-level model assignment (different models for different features)
- Health monitoring with circuit breaker pattern
- Usage logging with cost tracking
- Fallback configuration

### 7.8 Communication

- Email via Resend API with customizable templates
- In-app notification system with real-time delivery
- Interview invitation emails with reminders

---

## 8. Major Data Entities & Relationships

### 8.1 Entity Relationship Overview

```
organizations ──────┬── organization_members ── profiles ── user_roles
                     ├── organization_subscriptions ── subscription_plans
                     ├── interviews ──┬── questions
                     │                ├── interview_invitations
                     │                ├── interview_attempts ── assessments
                     │                ├── interview_templates
                     │                └── proctoring_settings
                     └── invoices

profiles ──────┬── user_roles (app_role enum)
               ├── user_custom_roles ── custom_roles
               ├── onboarding_progress
               ├── certificates
               └── learning_assessment_attempts

interview_attempts ──┬── assessments (1:1)
                     ├── proctoring_sessions ── proctoring_violations
                     ├── attempt_questions
                     └── candidate_performance_index

certification_topics ── certification_assessments ── certification_attempts ── certificates

ai_providers ── ai_provider_credentials
ai_feature_configurations ── ai_model_configurations ── ai_usage_logs

partner_applications → (approved) → organizations

payment_gateways ── payment_transactions
promotions ── promotion_usages
```

### 8.2 Core Entity Chain

**Organization → Interview → Invitation → Attempt → Assessment (+ Proctoring Session → Violations)**

### 8.3 Database Summary

| Object | Count |
|--------|-------|
| Tables | 122 |
| Functions | 123 |
| Triggers | 87 |
| RLS Policies | 406 |
| Indexes | 383 |
| Foreign Keys | 100 |
| Check Constraints | 420 |
| Storage Buckets | 5 |

---

## 9. Technical Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI Framework | shadcn/ui + Tailwind CSS + Radix UI |
| State Management | React Query (TanStack) + React Context |
| Routing | React Router v6 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Edge Functions | Deno (107 Supabase Edge Functions) |
| AI Provider | Google Gemini (via AI Gateway) |
| Email | Resend API via SMTP |
| Payments | Stripe + Razorpay |
| Proctoring | WebRTC + MediaRecorder + TensorFlow.js |
| Code Execution | Sandboxed edge function |
| Validation | Zod schemas |
| PDF/DOCX Export | jsPDF + docx library |
| Deployment | Docker + Kubernetes + Helm charts |

---

## 10. Self-Hosting Differences from Lovable Cloud

| Aspect | Lovable Cloud | Self-Hosted |
|--------|--------------|-------------|
| Supabase URL | `vtztavcqjmirktkjdprm.supabase.co` | `http://localhost:8000` (Kong gateway) |
| AI Gateway | `lovable.dev/api/ai-gateway` | `generativelanguage.googleapis.com/v1beta/openai` (direct) |
| AI API Key Env | `LOVABLE_API_KEY` | `AI_GATEWAY_API_KEY` |
| AI Model Names | `google/gemini-2.5-flash` (prefixed) | `gemini-2.5-flash` (direct) |
| Platform Name | "Lovable" | "InterviewTalentGeenie" |
| Email Sender | "Lovable" | "InterviewTalentGeenie" |
| DB Function URLs | Cloud Supabase URL | `http://talentgeenie-kong:8000` (internal) |
| Background Uploader | Hardcoded Cloud URL fallback | Dynamic from `VITE_SUPABASE_URL` only |
| Proctoring SW | Hardcoded Supabase URL/key | Dynamic CONFIG via message passing |
| Extensions | pg_net, pg_cron, pgsodium available | Not available (need shared_preload_libraries) |
