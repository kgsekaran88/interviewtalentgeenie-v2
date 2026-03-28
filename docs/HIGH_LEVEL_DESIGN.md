# TalentGeenie — High-Level Design (HLD)

**Document Version:** 2.0  
**Date:** March 5, 2026  
**Product:** TalentGeenie — AI-Powered Interview & Learning Platform  
**Classification:** Internal / Confidential  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [System Context Diagram](#4-system-context-diagram)
5. [Component Architecture](#5-component-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Authentication & Authorization Architecture](#7-authentication--authorization-architecture)
8. [AI Architecture](#8-ai-architecture)
9. [Infrastructure & Deployment Architecture](#9-infrastructure--deployment-architecture)
10. [Integration Architecture](#10-integration-architecture)
11. [Key Design Decisions](#11-key-design-decisions)
12. [Scalability Strategy](#12-scalability-strategy)
13. [Security Architecture](#13-security-architecture)

---

## 1. Introduction

### 1.1 Purpose

This document presents the High-Level Design (HLD) for the TalentGeenie platform. It describes the system architecture, major components, their interactions, and the key design decisions that shape the platform.

### 1.2 Scope

TalentGeenie is a multi-tenant SaaS platform comprising:
- **Frontend**: React SPA with hybrid mobile app support (Capacitor)
- **Backend**: Self-hosted Supabase (10 Docker services)
- **AI Engine**: Google Gemini integration for question generation and evaluation
- **Proctoring Engine**: Browser-based video/audio monitoring with AI analysis

### 1.3 References

| Document | Location |
|----------|----------|
| Requirements (SRS) | `docs/REQUIREMENTS_DOCUMENT.md` |
| Low-Level Design (LLD) | `docs/LOW_LEVEL_DESIGN.md` |
| Security Audit | `SECURITY_AUDIT_COMPLETE.md` |

---

## 2. System Architecture Overview

### 2.1 Architecture Style

TalentGeenie follows a **modular monolith frontend + serverless backend** architecture:

- **Frontend**: Single React SPA handling all UI concerns
- **Backend**: Supabase platform providing authentication, database, storage, and edge functions
- **API Gateway**: Kong proxies all API requests
- **Database**: PostgreSQL with RLS for multi-tenant data isolation

### 2.2 High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT TIER                                   │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │  Web Browser  │  │   iOS App    │  │      Android App            │  │
│  │  (React SPA)  │  │ (Capacitor)  │  │     (Capacitor)             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────────────┘  │
│         │                  │                      │                     │
│         └──────────────────┼──────────────────────┘                     │
│                            │                                            │
│                     HTTPS / WSS                                         │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────┐
│                     API GATEWAY TIER                                    │
│                            │                                            │
│                   ┌────────┴────────┐                                   │
│                   │   Kong Gateway   │  Port 8000                       │
│                   │  (Rate Limiting, │  CORS, Auth Header Forwarding)   │
│                   └────────┬────────┘                                   │
│                            │                                            │
│              ┌─────────────┼─────────────┐                              │
│              │             │             │                               │
│         ┌────┴────┐  ┌────┴────┐  ┌────┴────┐                         │
│         │  /auth  │  │  /rest  │  │/functions│                         │
│         │ GoTrue  │  │PostgREST│  │  Deno    │                         │
│         └────┬────┘  └────┬────┘  └────┬────┘                         │
│              │             │             │                               │
└──────────────┼─────────────┼─────────────┼──────────────────────────────┘
               │             │             │
┌──────────────┼─────────────┼─────────────┼──────────────────────────────┐
│              │       BACKEND TIER        │                               │
│              │             │             │                               │
│         ┌────┴─────────────┴─────────────┴────┐                        │
│         │          PgBouncer (6432)            │                        │
│         │     Connection Pooling (1000 max)    │                        │
│         └────────────────┬────────────────────┘                        │
│                          │                                              │
│                ┌─────────┴─────────┐                                    │
│                │  PostgreSQL 15.8  │ Port 54322                         │
│                │  ┌─────────────┐  │                                    │
│                │  │ 60+ Tables  │  │                                    │
│                │  │ 406 RLS     │  │                                    │
│                │  │ 123 Funcs   │  │                                    │
│                │  └─────────────┘  │                                    │
│                └───────────────────┘                                    │
│                                                                         │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐   │
│  │  Realtime   │  │   Storage    │  │   Imgproxy   │  │   Studio   │   │
│  │ (WebSocket) │  │ (S3-compat.) │  │(Image Trans.)│  │  (Admin)   │   │
│  └────────────┘  └──────────────┘  └──────────────┘  └────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
               │
┌──────────────┼──────────────────────────────────────────────────────────┐
│        EXTERNAL SERVICES                                                │
│              │                                                          │
│  ┌───────────┴──────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Google Gemini API │  │  Stripe API  │  │      SMTP Server         │  │
│  │ (AI Generation &  │  │  (Payments)  │  │   (Email Delivery)       │  │
│  │  Evaluation)      │  │              │  │                          │  │
│  └───────────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend Stack

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND STACK                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React 18.3 (SPA)                    │   │
│  │  ┌──────────┐ ┌───────────┐ ┌───────────────┐  │   │
│  │  │TypeScript│ │React Router│ │ React Query   │  │   │
│  │  │  5.8     │ │ DOM 6.30  │ │ (TanStack) 5  │  │   │
│  │  └──────────┘ └───────────┘ └───────────────┘  │   │
│  │  ┌──────────┐ ┌───────────┐ ┌───────────────┐  │   │
│  │  │React Hook│ │   Zod     │ │  shadcn/ui    │  │   │
│  │  │Form 7.61 │ │   4.1     │ │  (50+ comp.)  │  │   │
│  │  └──────────┘ └───────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐ ┌────────────┐ ┌────────────────┐   │
│  │ Tailwind CSS │ │  Recharts  │ │  Monaco Editor │   │
│  │    3.4       │ │   2.15     │ │     4.7        │   │
│  └──────────────┘ └────────────┘ └────────────────┘   │
│                                                         │
│  ┌──────────────┐ ┌────────────┐ ┌────────────────┐   │
│  │  Capacitor   │ │   Sentry   │ │  MediaPipe +   │   │
│  │  7.4 (Mobile)│ │   10.39    │ │  HuggingFace   │   │
│  └──────────────┘ └────────────┘ └────────────────┘   │
│                                                         │
│  Build: Vite 5.4 + SWC                                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Backend Stack

```
┌───────────────────────────────────────────────────────┐
│               SELF-HOSTED SUPABASE                     │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │             10 Docker Services                    │ │
│  │                                                   │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐            │ │
│  │  │PostgreSQL│ │PgBouncer │ │  Kong  │            │ │
│  │  │  15.8   │ │(Pooling) │ │ 2.8    │            │ │
│  │  └─────────┘ └──────────┘ └────────┘            │ │
│  │                                                   │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐            │ │
│  │  │ GoTrue  │ │PostgREST │ │Realtime│            │ │
│  │  │(Auth)   │ │(REST API)│ │(WS)    │            │ │
│  │  └─────────┘ └──────────┘ └────────┘            │ │
│  │                                                   │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ │ │
│  │  │ Storage │ │Functions │ │Imgproxy│ │Studio │ │ │
│  │  │(Files)  │ │(107 Deno)│ │(Images)│ │(Admin)│ │ │
│  │  └─────────┘ └──────────┘ └────────┘ └───────┘ │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## 4. System Context Diagram

```
                          ┌──────────────────────┐
                          │                      │
                          │   Platform Admin      │
                          │   (Full Access)       │
                          └──────────┬───────────┘
                                     │
┌──────────────┐            ┌────────┴────────┐           ┌──────────────┐
│              │            │                 │           │              │
│ Partner Admin │────────── │   TalentGeenie  │ ──────────│  Candidate   │
│ (Org Admin)  │            │    Platform     │           │ (Interview   │
│              │            │                 │           │   Taker)     │
└──────────────┘            │  ┌───────────┐  │           └──────────────┘
                            │  │  Web SPA  │  │
┌──────────────┐            │  │  Mobile   │  │           ┌──────────────┐
│              │            │  │  Apps     │  │           │              │
│ HR Recruiter  │────────── │  └───────────┘  │ ──────────│ Google Gemini│
│ (Interviews) │            │                 │           │   (AI)       │
│              │            └────────┬────────┘           └──────────────┘
└──────────────┘                     │
                            ┌────────┴────────┐           ┌──────────────┐
┌──────────────┐            │                 │           │              │
│              │            │  Self-Hosted    │ ──────────│ Stripe API   │
│  Tech SPOC   │────────── │  Supabase       │           │ (Payments)   │
│ (Questions)  │            │  Backend        │           │              │
│              │            │                 │           └──────────────┘
└──────────────┘            └────────┬────────┘
                                     │                    ┌──────────────┐
┌──────────────┐                     │                    │              │
│              │                     └────────────────────│  SMTP Server │
│ Billing &    │                                          │  (Email)     │
│ Guest Users  │                                          │              │
│              │                                          └──────────────┘
└──────────────┘
```

---

## 5. Component Architecture

### 5.1 Frontend Module Decomposition

```
┌─────────────────────────────────────────────────────────────────────┐
│                      REACT APPLICATION                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    APP SHELL                                  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐ │  │
│  │  │  AuthContext │ │    Org      │ │   React Query          │ │  │
│  │  │  Provider   │ │  Context    │ │   Provider             │ │  │
│  │  └─────────────┘ └─────────────┘ └────────────────────────┘ │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐ │  │
│  │  │ErrorBoundary│ │  Sonner     │ │  React Router          │ │  │
│  │  │  (Sentry)   │ │  Toaster   │ │  BrowserRouter         │ │  │
│  │  └─────────────┘ └─────────────┘ └────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────── LAYOUTS ─────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │  │
│  │  │  AppLayout  │  │ AdminLayout  │  │  PartnerLayout      │ │  │
│  │  │  (Base)     │  │ (/admin/*)   │  │ (/partner/*)        │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────────┘ │  │
│  │                                                               │  │
│  │  Shared: AppNavbar │ RoleBreadcrumbs │ ImpersonationBanner  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────── FEATURE MODULES ─────────────────────────┐  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                  │  │
│  │  │   INTERVIEW      │  │   PROCTORING      │                  │  │
│  │  │   MODULE         │  │   MODULE           │                  │  │
│  │  │                  │  │                    │                  │  │
│  │  │ • CreateInterview│  │ • PreInterviewCheck│                  │  │
│  │  │ • InterviewDetail│  │ • ProctoringMonitor│                  │  │
│  │  │ • Dashboard      │  │ • ProctoringReport │                  │  │
│  │  │ • TakeInterview  │  │ • LiveStreamViewer │                  │  │
│  │  │ • QuickCreate    │  │ • VideoPlayer      │                  │  │
│  │  │ • JDBuilder      │  │ • Integrity Checks │                  │  │
│  │  │ • Templates      │  │ • 13 components    │                  │  │
│  │  │ • QuestionRepo   │  │                    │                  │  │
│  │  └─────────────────┘  └──────────────────┘                  │  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                  │  │
│  │  │   LEARNING       │  │   ADMIN           │                  │  │
│  │  │   MODULE         │  │   MODULE           │                  │  │
│  │  │                  │  │                    │                  │  │
│  │  │ • LearningDash   │  │ • AdminHub         │                  │  │
│  │  │ • MyLearningPlan │  │ • UserManagement   │                  │  │
│  │  │ • Certifications │  │ • OrgManagement    │                  │  │
│  │  │ • TakeCert       │  │ • AIConfiguration  │                  │  │
│  │  │ • MyCertificates │  │ • BillingMgmt      │                  │  │
│  │  │ • LearningHistory│  │ • SystemMonitoring │                  │  │
│  │  │ • CertVerify     │  │ • 30+ pages        │                  │  │
│  │  └─────────────────┘  └──────────────────┘                  │  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                  │  │
│  │  │   PARTNER        │  │   BILLING         │                  │  │
│  │  │   MODULE         │  │   MODULE           │                  │  │
│  │  │                  │  │                    │                  │  │
│  │  │ • PartnerPortal  │  │ • PartnerBilling   │                  │  │
│  │  │ • OrgSettings    │  │ • PlanManagement   │                  │  │
│  │  │ • OrgAnalytics   │  │ • PaymentGateway   │                  │  │
│  │  │ • UserManagement │  │ • Invoices         │                  │  │
│  │  │ • PartnerReports │  │ • Subscriptions    │                  │  │
│  │  └─────────────────┘  └──────────────────┘                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────── SHARED / CROSS-CUTTING ──────────────────────┐  │
│  │  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐          │  │
│  │  │50+ UI│ │  Hooks   │ │  Utils   │ │  Contexts │          │  │
│  │  │Comps │ │ (25+)    │ │  (30+)   │ │   (3)     │          │  │
│  │  └──────┘ └──────────┘ └──────────┘ └───────────┘          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Backend Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE BACKEND                                │
│                                                                     │
│  ┌───────── EDGE FUNCTIONS (107 Deno Functions) ──────────────┐    │
│  │                                                             │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │    │
│  │  │  AI Functions    │  │ User Functions   │                 │    │
│  │  │  (11)            │  │  (4)             │                 │    │
│  │  │ • generate-qs    │  │ • user-signup    │                 │    │
│  │  │ • evaluate       │  │ • admin-mgmt     │                 │    │
│  │  │ • generate-jd    │  │ • org-user       │                 │    │
│  │  │ • extract-skills │  │ • password       │                 │    │
│  │  └─────────────────┘  └─────────────────┘                 │    │
│  │                                                             │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │    │
│  │  │  Proctoring     │  │ Email/Notif      │                 │    │
│  │  │  Functions (15) │  │ Functions (10)   │                 │    │
│  │  │ • init-session  │  │ • send-email     │                 │    │
│  │  │ • log-violation │  │ • send-invite    │                 │    │
│  │  │ • upload-video  │  │ • send-notif     │                 │    │
│  │  │ • merge-chunks  │  │ • email-hook     │                 │    │
│  │  └─────────────────┘  └─────────────────┘                 │    │
│  │                                                             │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │    │
│  │  │  Learning       │  │ Billing          │                 │    │
│  │  │  Functions (6)  │  │ Functions (4)    │                 │    │
│  │  │ • eval-learning │  │ • gen-invoice    │                 │    │
│  │  │ • eval-cert     │  │ • approve-app    │                 │    │
│  │  │ • gen-questions │  │ • delete-org     │                 │    │
│  │  └─────────────────┘  └─────────────────┘                 │    │
│  │                                                             │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │    │
│  │  │  Testing        │  │ Platform         │                 │    │
│  │  │  Functions (14) │  │ Functions (12)   │                 │    │
│  │  │ • run-tests     │  │ • chatbot        │                 │    │
│  │  │ • seed-data     │  │ • scheduled-jobs │                 │    │
│  │  │ • cleanup       │  │ • ats-webhook    │                 │    │
│  │  └─────────────────┘  └─────────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────── DATABASE LAYER ───────────────────────────────────┐    │
│  │                                                             │    │
│  │  PostgreSQL 15.8                                           │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │  60+ Tables │ 406 RLS Policies │ 123 DB Functions    │  │    │
│  │  │  Enums: app_role (12 values)                         │  │    │
│  │  │  Triggers: auto-update timestamps, cascading deletes │  │    │
│  │  │  Indexes: Performance-optimized queries              │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Architecture

### 6.1 Entity-Relationship Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  auth.users  │──────>│   profiles   │<──────│  user_roles  │
│  (Supabase)  │  1:1  │              │  1:N  │  (RBAC)      │
└──────────────┘       └──────┬───────┘       └──────────────┘
                              │ N:N via
                    ┌─────────┴──────────┐
                    │  organization_     │
                    │  members           │
                    └─────────┬──────────┘
                              │ N:1
                    ┌─────────┴──────────┐
                    │  organizations     │
                    └─────────┬──────────┘
                              │ 1:N
            ┌─────────────────┼──────────────────────┐
            │                 │                      │
  ┌─────────┴──────┐  ┌──────┴───────┐  ┌──────────┴────────┐
  │   interviews   │  │  org_subs    │  │  activity_feed    │
  │                │  │              │  │                    │
  └────┬───────────┘  └──────┬───────┘  └───────────────────┘
       │ 1:N                 │ N:1
       │              ┌──────┴───────┐
       │              │  sub_plans   │
       │              └──────────────┘
       │
       ├──── 1:N ────┬──── 1:N ────┬──── 1:N ────┐
       │             │             │              │
┌──────┴──────┐ ┌────┴──────┐ ┌───┴────────┐ ┌───┴───────────┐
│  questions  │ │invitations│ │  attempts   │ │ proctoring_   │
│             │ │           │ │             │ │ sessions      │
└─────────────┘ └───────────┘ └──────┬──────┘ └───────────────┘
                                     │ 1:1
                              ┌──────┴──────┐
                              │ assessments │
                              │ (AI eval)   │
                              └─────────────┘
```

### 6.2 Data Domain Groups

```
┌──────────────────────────────────────────────────────────────────┐
│                        DATA DOMAINS                              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   IDENTITY        │  │  ORGANIZATION     │                     │
│  │                   │  │                   │                     │
│  │ • profiles        │  │ • organizations   │                     │
│  │ • user_roles      │  │ • org_members     │                     │
│  │ • custom_roles    │  │ • org_subscriptions│                    │
│  │ • user_custom_roles│ │ • activity_feed   │                     │
│  │ • role_permissions│  │ • onboarding      │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   INTERVIEW       │  │   PROCTORING      │                     │
│  │                   │  │                   │                     │
│  │ • interviews      │  │ • proctoring_     │                     │
│  │ • questions       │  │   sessions        │                     │
│  │ • invitations     │  │ • preinterview_   │                     │
│  │ • attempts        │  │   check_logs      │                     │
│  │ • attempt_questions│ │ • candidate_      │                     │
│  │ • assessments     │  │   performance_idx │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   LEARNING        │  │   BILLING         │                     │
│  │                   │  │                   │                     │
│  │ • learning_       │  │ • subscription_   │                     │
│  │   assessments     │  │   plans           │                     │
│  │ • learning_qs     │  │ • invoices        │                     │
│  │ • learning_       │  │ • usage_tracking  │                     │
│  │   attempts        │  │ • payment_gw      │                     │
│  │ • training_plans  │  │ • payment_methods │                     │
│  │ • training_topics │  │ • payment_txns    │                     │
│  │ • learning_mats   │  │                   │                     │
│  │ • cert_topics     │  │                   │                     │
│  │ • cert_questions  │  │                   │                     │
│  │ • cert_attempts   │  │                   │                     │
│  │ • user_certs      │  │                   │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   AI CONFIG       │  │   PLATFORM        │                     │
│  │                   │  │                   │                     │
│  │ • ai_providers    │  │ • platform_config │                     │
│  │ • ai_credentials  │  │ • system_config   │                     │
│  │ • ai_model_config │  │ • audit_logs      │                     │
│  │ • ai_feature_conf │  │ • security_events │                     │
│  │ • ai_health       │  │ • notifications   │                     │
│  │ • ai_usage_logs   │  │ • chatbot_knowledge│                    │
│  └──────────────────┘  └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Multi-Tenant Data Isolation Model

```
┌────────────────────────────────────────────────────────────────┐
│                  MULTI-TENANT ISOLATION                         │
│                                                                │
│  ┌──── Organization A ──────┐  ┌──── Organization B ─────┐   │
│  │                           │  │                         │   │
│  │ interviews ← RLS Filter  │  │ interviews ← RLS Filter │   │
│  │ questions  ← RLS Filter  │  │ questions  ← RLS Filter │   │
│  │ attempts   ← RLS Filter  │  │ attempts   ← RLS Filter │   │
│  │ members    ← RLS Filter  │  │ members    ← RLS Filter │   │
│  │                           │  │                         │   │
│  └───────────────────────────┘  └─────────────────────────┘   │
│                                                                │
│  RLS Policy Pattern:                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  CREATE POLICY "org_isolation" ON interviews             │  │
│  │  USING (                                                 │  │
│  │    organization_id IN (                                  │  │
│  │      SELECT organization_id FROM organization_members    │  │
│  │      WHERE user_id = auth.uid() AND is_active = true     │  │
│  │    )                                                     │  │
│  │    OR has_role(auth.uid(), 'platform_admin')             │  │
│  │  );                                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  Platform Admin: Bypasses all org isolation (god mode)         │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Authentication & Authorization Architecture

### 7.1 Authentication Flow

```
   User                   SPA                  GoTrue          Edge Function       Database
    │                      │                     │                  │                  │
    │  1. Enter Email      │                     │                  │                  │
    ├─────────────────────>│                     │                  │                  │
    │                      │  2. check_user_exists│                 │                  │
    │                      ├─────────────────────┼──────────────────┼─────────────────>│
    │                      │<────────────────────┼──────────────────┼──────────────────│
    │                      │                     │                  │                  │
    │  3. Enter Password   │                     │                  │                  │
    ├─────────────────────>│                     │                  │                  │
    │                      │  4. signInWithPassword                 │                  │
    │                      ├────────────────────>│                  │                  │
    │                      │  5. JWT + Session   │                  │                  │
    │                      │<────────────────────│                  │                  │
    │                      │                     │                  │                  │
    │                      │  6. complete-user-signup (if new)      │                  │
    │                      ├─────────────────────┼─────────────────>│                  │
    │                      │                     │                  │  7. Create Profile│
    │                      │                     │                  ├─────────────────>│
    │                      │                     │                  │  8. Assign Guest │
    │                      │                     │                  ├─────────────────>│
    │                      │                     │                  │<─────────────────│
    │                      │<────────────────────┼──────────────────│                  │
    │                      │                     │                  │                  │
    │                      │  9. Fetch user_roles│                  │                  │
    │                      ├─────────────────────┼──────────────────┼─────────────────>│
    │                      │<────────────────────┼──────────────────┼──────────────────│
    │                      │                     │                  │                  │
    │  10. Redirect to     │                     │                  │                  │
    │  Role Dashboard      │                     │                  │                  │
    │<─────────────────────│                     │                  │                  │
```

### 7.2 Authorization Layer Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                     4-LAYER AUTHORIZATION                              │
│                                                                        │
│  Layer 1: ROUTE LEVEL                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  <ProtectedRoute requiredRoles={['platform_admin']}>             │ │
│  │    <AdminLayout>                                                  │ │
│  │      <Route ... />                                                │ │
│  │    </AdminLayout>                                                 │ │
│  │  </ProtectedRoute>                                                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  Layer 2: LAYOUT LEVEL                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  AdminLayout  → platform_admin only                               │ │
│  │  PartnerLayout → partner_admin, hr_recruiter, tech_spoc,         │ │
│  │                   billing_contact, platform_admin                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  Layer 3: COMPONENT LEVEL                                              │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  <PermissionGate permission="manage_billing">                     │ │
│  │    <BillingSection />                                             │ │
│  │  </PermissionGate>                                                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  Layer 4: DATABASE LEVEL (RLS)                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  406 Row-Level Security Policies                                  │ │
│  │  • Table-level read/write restrictions                            │ │
│  │  • Organization-scoped data access                                │ │
│  │  • Role-based query filtering                                     │ │
│  │  • SECURITY DEFINER functions for sensitive operations            │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Role Hierarchy

```
                    ┌─────────────────────┐
                    │   PLATFORM ADMIN     │
                    │   (God Mode)         │
                    │                      │
                    │ All permissions      │
                    │ All organizations    │
                    │ All data access      │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   PARTNER ADMIN      │
                    │                      │
                    │ Own org management   │
                    │ Users, billing,      │
                    │ recruiting, settings │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────┴────┐  ┌───────┴───────┐ ┌──────┴─────────┐
    │ HR RECRUITER  │  │  TECH SPOC    │ │BILLING CONTACT │
    │              │  │               │ │                │
    │ Create/share │  │ Questions,    │ │ Billing,       │
    │ interviews,  │  │ templates,    │ │ invoices,      │
    │ evaluate,    │  │ read-only     │ │ subscriptions  │
    │ proctoring   │  │ interviews    │ │                │
    └──────────────┘  └───────────────┘ └────────────────┘
              │
    ┌─────────┴────────────────────────────────┐
    │                 GUEST                      │
    │                                            │
    │  Learning dashboard, certifications only   │
    │  Awaiting role assignment                  │
    └────────────────────────────────────────────┘
```

---

## 8. AI Architecture

### 8.1 AI Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI ARCHITECTURE                            │
│                                                                 │
│  ┌──── Frontend ──┐        ┌──── Edge Functions ────────────┐  │
│  │                 │        │                                │  │
│  │  CreateInterview│  HTTP  │  generate-questions             │  │
│  │  ────────────── ├───────>│  ┌──────────────────────────┐  │  │
│  │                 │        │  │  1. Parse JD & Config     │  │  │
│  │                 │        │  │  2. Build AI Prompt       │  │  │
│  │                 │        │  │  3. Call Gemini 2.5 Flash │  │  │
│  │                 │        │  │  4. Parse Response        │  │  │
│  │                 │        │  │  5. Validate Questions    │  │  │
│  │                 │        │  │  6. Store in DB           │  │  │
│  │                 │        │  └──────────────────────────┘  │  │
│  │                 │        │                                │  │
│  │  TakeInterview  │  HTTP  │  evaluate-interview            │  │
│  │  (post-submit)  ├───────>│  ┌──────────────────────────┐  │  │
│  │                 │        │  │  1. Fetch Answers         │  │  │
│  │                 │        │  │  2. Build Eval Prompt     │  │  │
│  │                 │        │  │  3. Call Gemini 2.5 Flash │  │  │
│  │                 │        │  │  4. Score per Question    │  │  │
│  │                 │        │  │  5. Calculate CPI         │  │  │
│  │                 │        │  │  6. Hiring Decision       │  │  │
│  │                 │        │  │  7. Store Assessment      │  │  │
│  │                 │        │  └──────────────────────────┘  │  │
│  └─────────────────┘        └────────────────────────────────┘  │
│                                          │                      │
│                                          ▼                      │
│                              ┌────────────────────┐             │
│                              │  Google Gemini API  │             │
│                              │  ┌──────────────┐  │             │
│                              │  │Primary: 2.5  │  │             │
│                              │  │Flash         │  │             │
│                              │  ├──────────────┤  │             │
│                              │  │Fallback: 1.5 │  │             │
│                              │  │Flash         │  │             │
│                              │  └──────────────┘  │             │
│                              └────────────────────┘             │
│                                                                 │
│  ┌──── Client-Side AI ──────────────────────────────────────┐  │
│  │                                                           │  │
│  │  MediaPipe Tasks Vision ── Face Detection, Gaze Tracking │  │
│  │  HuggingFace Transformers ── Object Detection            │  │
│  │  Custom Libraries ── Voice Analysis, Liveness Detection  │  │
│  │                                                           │  │
│  │  Usage: Proctoring (deferred to post-interview for heavy │  │
│  │         analysis; lightweight checks during interview)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 AI Feature Mapping

```
┌───────────────────────────────────────────────────────────┐
│              AI FEATURES & MODELS                         │
│                                                           │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │  QUESTION GENERATION     │  │  EVALUATION           │   │
│  │  Model: Gemini 2.5 Flash│  │  Model: Gemini 2.5   │   │
│  │                          │  │  Flash               │   │
│  │  • generate-questions    │  │  • evaluate-interview│   │
│  │  • generate-learning-qs  │  │  • evaluate-learning │   │
│  │  • generate-cert-qs      │  │  • evaluate-cert     │   │
│  │  • regenerate-questions  │  │  • detect-bias       │   │
│  │  • batch-regenerate      │  │  • calculate-cpi     │   │
│  └─────────────────────────┘  └──────────────────────┘   │
│                                                           │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │  JD GENERATION           │  │  PROCTORING AI       │   │
│  │  Model: Gemini 2.5 Flash│  │  (Client-Side)       │   │
│  │                          │  │                      │   │
│  │  • generate-job-desc     │  │  • Face Detection    │   │
│  │  • enhance-job-desc      │  │  • Gaze Tracking     │   │
│  │  • suggest-jd-content    │  │  • Object Detection  │   │
│  │  • extract-skills        │  │  • Voice Analysis    │   │
│  │  • parse-resume          │  │  • Liveness Check    │   │
│  └─────────────────────────┘  └──────────────────────┘   │
│                                                           │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │  ASSISTANCE              │  │  MONITORING          │   │
│  │  Model: Configurable    │  │                      │   │
│  │                          │  │  • ai_health_monitor │   │
│  │  • chatbot-assist        │  │  • ai_usage_logs     │   │
│  │  • enhance-email-content│  │  • ai_feature_health │   │
│  │  • log-analysis-chat    │  │  • A/B testing       │   │
│  └─────────────────────────┘  └──────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

---

## 9. Infrastructure & Deployment Architecture

### 9.1 Docker Compose Architecture (Self-Hosted)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE STACK                              │
│                                                                     │
│  ┌───────── docker-compose.supabase.yml (10 services) ──────────┐  │
│  │                                                               │  │
│  │     ┌──────────────────────────────────────────────────┐     │  │
│  │     │              KONG (API Gateway)                   │     │  │
│  │     │              Port: 8000                           │     │  │
│  │     └────────┬──────────┬───────────┬──────────────────┘     │  │
│  │              │          │           │                         │  │
│  │     ┌────────┴──┐ ┌────┴────┐ ┌────┴──────┐                │  │
│  │     │  GoTrue   │ │PostgREST│ │ Functions │                │  │
│  │     │  (Auth)   │ │ (REST)  │ │ (107 Deno)│                │  │
│  │     │  :9999    │ │         │ │           │                │  │
│  │     └─────┬─────┘ └────┬────┘ └─────┬─────┘                │  │
│  │           │             │            │                       │  │
│  │     ┌─────┴─────────────┴────────────┴──────────────┐       │  │
│  │     │            PgBouncer (Pooling)                 │       │  │
│  │     │            Port: 6432                          │       │  │
│  │     │            Max Clients: 1000                   │       │  │
│  │     └──────────────────┬────────────────────────────┘       │  │
│  │                        │                                     │  │
│  │     ┌──────────────────┴────────────────────────────┐       │  │
│  │     │          PostgreSQL 15.8                       │       │  │
│  │     │          Port: 54322                           │       │  │
│  │     │          Volume: pgdata (persistent)           │       │  │
│  │     └───────────────────────────────────────────────┘       │  │
│  │                                                               │  │
│  │     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │     │ Realtime │ │ Storage  │ │ Imgproxy │ │  Studio  │    │  │
│  │     │ (WS)     │ │ (Files)  │ │ (Images) │ │ (Admin)  │    │  │
│  │     │          │ │          │ │          │ │ :3000    │    │  │
│  │     └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────── docker-compose.yml (Frontend) ──────────────────────┐  │
│  │                                                               │  │
│  │     ┌──────────────────────────────────────────────────┐     │  │
│  │     │         Nginx (Static SPA Serving)                │     │  │
│  │     │         Port: 8080                                │     │  │
│  │     │         Non-root user                             │     │  │
│  │     │         Gzip, Security Headers, SPA Routing       │     │  │
│  │     └──────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Production Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   PRODUCTION DEPLOYMENT                         │
│                                                                 │
│  ┌──── Kubernetes Cluster ───────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │ │
│  │  │  Frontend   │  │  Supabase   │  │  Edge Functions  │  │ │
│  │  │  Deployment │  │  Services   │  │  (Deno Workers)  │  │ │
│  │  │  (Nginx)    │  │  (10 pods)  │  │                  │  │ │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │ │
│  │                                                            │ │
│  │  ┌─────────────┐  ┌─────────────┐                         │ │
│  │  │  Secrets    │  │  ConfigMaps │                         │ │
│  │  │  (K8s)      │  │  (Settings) │                         │ │
│  │  └─────────────┘  └─────────────┘                         │ │
│  │                                                            │ │
│  │  Helm Charts for templated deployment                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──── Persistent Storage ────────────────────────────────────┐ │
│  │                                                            │ │
│  │  PostgreSQL Volume │ Storage Buckets │ Recording Files     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──── External ──────────────────────────────────────────────┐ │
│  │  Google Gemini │ Stripe │ SMTP │ Sentry                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Build Pipeline

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Source   │────>│  Build   │────>│ Container│────>│  Deploy  │
│  Code     │     │  (Vite)  │     │ (Docker) │     │  (K8s)   │
│           │     │          │     │          │     │          │
│ TypeScript│     │ • tsc    │     │ • Multi- │     │ • Helm   │
│ React     │     │ • Vite   │     │   stage  │     │ • kubectl│
│ Tailwind  │     │ • SWC    │     │ • Nginx  │     │ • Secrets│
│           │     │ • dist/  │     │ • :8080  │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## 10. Integration Architecture

### 10.1 External System Integrations

```
┌─────────────────────────────────────────────────────────────────┐
│                  INTEGRATION POINTS                              │
│                                                                 │
│  ┌─── AI Provider ───────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Edge Function ──HTTPS──> Google Gemini API               │ │
│  │                                                            │ │
│  │  • API Key: Encrypted (AES) in ai_provider_credentials   │ │
│  │  • Retry: 3 attempts, exponential backoff                │ │
│  │  • Fallback: Gemini 1.5 Flash if 2.5 Flash fails        │ │
│  │  • Monitoring: ai_health_monitoring, ai_usage_logs       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── Payment Provider ──────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Edge Function ──HTTPS──> Stripe API                      │ │
│  │                                                            │ │
│  │  • Config: payment_gateways table (test/live mode)       │ │
│  │  • Methods: payment_methods (card brand, last4)          │ │
│  │  • Webhooks: Stripe → edge function → DB update          │ │
│  │  • Keys: Encrypted, never client-exposed                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── Email Provider ────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Edge Function ──SMTP──> Email Server                     │ │
│  │                                                            │ │
│  │  • Templates: email_templates table                      │ │
│  │  • Types: Welcome, Verification, Invitation, Reminder,   │ │
│  │           Password Reset, Review Request                  │ │
│  │  • AI Enhancement: Optional AI-improved content          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── ATS Integration ───────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Webhook: ATS Provider ──HTTPS──> ats-webhook function   │ │
│  │  Sync:    sync-ats-candidates function ──> ats_candidates│ │
│  │                                                            │ │
│  │  • Config: ats_integrations table                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── Error Monitoring ──────────────────────────────────────┐ │
│  │                                                            │ │
│  │  React ErrorBoundary ──HTTPS──> Sentry                   │ │
│  │                                                            │ │
│  │  • Section tags: admin, partner, recruiting, assessment  │ │
│  │  • Breadcrumbs: navigation events                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Key Design Decisions

### 11.1 Architecture Decisions

| # | Decision | Rationale | Trade-offs |
|---|----------|-----------|------------|
| **AD-01** | Self-hosted Supabase instead of cloud | Full data sovereignty, no vendor lock-in, customizable | Higher operational overhead |
| **AD-02** | React SPA instead of SSR (Next.js) | Simpler deployment (static via Nginx), Capacitor mobile support | No server-side rendering (SEO via meta tags) |
| **AD-03** | Edge Functions (Deno) for business logic | Serverless scaling, language alignment (TypeScript), Supabase-native | Cold start latency for first calls |
| **AD-04** | PostgreSQL RLS for multi-tenant isolation | Database-level security, no application-level leaks | Query performance overhead per policy |
| **AD-05** | Client-side AI for proctoring | Reduced server load, real-time detection, no video streaming to server | Higher client CPU usage |
| **AD-06** | Deferred heavy AI analysis to post-interview | Better interview experience (no lag during exam) | Delayed proctoring reports |
| **AD-07** | Kong API Gateway | Centralized auth header forwarding, rate limiting, CORS | Configuration complexity |
| **AD-08** | PgBouncer for connection pooling | Handle 1000+ concurrent connections | Prepared statement limitations |
| **AD-09** | React Query for server state | Automatic caching, deduplication, optimistic updates | Learning curve, cache invalidation |
| **AD-10** | shadcn/ui component library | Customizable, accessible, no runtime dependency | Manual component management |

### 11.2 Data Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| **DD-01** | Session tokens (64-char) instead of incrementing IDs | Prevents attempt enumeration attacks |
| **DD-02** | SECURITY DEFINER functions for sensitive queries | Bypass RLS safely for candidate-facing queries |
| **DD-03** | AES encryption for API keys | Protect credentials at rest |
| **DD-04** | Immutable PII after attempt creation | Prevent post-submission tampering |
| **DD-05** | Separate correct_answer column with RLS | Candidates never see answers, even in API responses |

---

## 12. Scalability Strategy

### 12.1 Horizontal Scaling Points

```
┌─────────────────────────────────────────────────────────────┐
│                 SCALABILITY ARCHITECTURE                     │
│                                                             │
│  ┌──── Stateless (Scale Out) ────────────────────────────┐ │
│  │                                                        │ │
│  │  Frontend (Nginx)     → Add replicas behind LB        │ │
│  │  Edge Functions (Deno) → Horizontal auto-scale        │ │
│  │  PostgREST            → Multiple instances            │ │
│  │  GoTrue (Auth)        → Multiple instances            │ │
│  │  Kong (Gateway)       → Multiple instances            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──── Stateful (Scale Up / Optimize) ───────────────────┐ │
│  │                                                        │ │
│  │  PostgreSQL           → Read replicas, partitioning   │ │
│  │  PgBouncer            → Increase pool size            │ │
│  │  Storage              → S3-compatible backend         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──── Caching Layers ───────────────────────────────────┐ │
│  │                                                        │ │
│  │  Client: React Query (in-memory, stale-while-revalidate)│
│  │  CDN: Nginx static asset cache (1-year)               │ │
│  │  API: Kong response caching (configurable)            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──── Performance Optimizations ────────────────────────┐ │
│  │                                                        │ │
│  │  • Lazy loading for heavy pages (proctoring, editors) │ │
│  │  • Code splitting via React.lazy + Suspense           │ │
│  │  • Gzip compression on all text responses             │ │
│  │  • Chunked uploads for large recordings               │ │
│  │  • Background upload handler for reliability          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Security Architecture

### 13.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                  DEFENSE IN DEPTH                                │
│                                                                 │
│  Layer 1: NETWORK                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • HTTPS/TLS 1.2+ (all traffic)                          │ │
│  │  • Kong API Gateway (rate limiting, CORS)                │ │
│  │  • Nginx security headers (CSP, HSTS, X-Frame-Options)  │ │
│  │  • Non-root container execution                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 2: AUTHENTICATION                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • GoTrue (bcrypt passwords, JWT sessions)               │ │
│  │  • Email verification required                           │ │
│  │  • Automatic token refresh (60s buffer)                  │ │
│  │  • Session token validation (64-char per attempt)        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 3: AUTHORIZATION                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • 6 hierarchical roles, 38 granular permissions         │ │
│  │  • Route-level ProtectedRoute component                  │ │
│  │  • Component-level PermissionGate                        │ │
│  │  • 406 RLS policies on all database tables               │ │
│  │  • SECURITY DEFINER functions for sensitive ops          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 4: DATA PROTECTION                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • AES encryption for API keys at rest                   │ │
│  │  • Correct answers hidden from candidates via RLS        │ │
│  │  • PII immutability after attempt creation               │ │
│  │  • Service role key restricted to edge functions          │ │
│  │  • Error message sanitization (no PG errors to client)   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 5: MONITORING & AUDIT                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • Sentry error monitoring with section tags             │ │
│  │  • Audit logs for admin actions                          │ │
│  │  • Security event logs                                   │ │
│  │  • AI health and usage monitoring                        │ │
│  │  • Pre-interview check logging                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

*End of High-Level Design Document*
