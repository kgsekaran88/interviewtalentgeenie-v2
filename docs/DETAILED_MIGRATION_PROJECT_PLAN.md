# TalentGeenie AWS Migration - Detailed Project Plan

## Document Information
| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | February 2026 |
| Status | Planning Phase |
| Total Estimated Hours | 1,896 hours |
| Story Points | 474 SP (4 hours = 1 SP) |
| Recommended Team Size | 8-10 developers |
| Timeline | 16-20 weeks |

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Platform Inventory](#current-platform-inventory)
3. [Phase 1: Infrastructure Setup](#phase-1-infrastructure-setup)
4. [Phase 2: Database Migration](#phase-2-database-migration)
5. [Phase 3: Authentication & Authorization](#phase-3-authentication--authorization)
6. [Phase 4: Backend Services Migration](#phase-4-backend-services-migration)
7. [Phase 5: Frontend Migration](#phase-5-frontend-migration)
8. [Phase 6: Testing & QA](#phase-6-testing--qa)
9. [Phase 7: Deployment & Cutover](#phase-7-deployment--cutover)
10. [Risk Assessment](#risk-assessment)
11. [Resource Requirements](#resource-requirements)

---

## Executive Summary

### Current Stack
| Layer | Current Technology |
|-------|-------------------|
| Frontend | React 18.3.1 + Vite + TypeScript |
| Styling | Tailwind CSS + Shadcn/UI |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |

### Target AWS Stack
| Layer | Target Technology |
|-------|------------------|
| Frontend | S3 + CloudFront |
| Backend | ECS Fargate / Lambda |
| Database | RDS PostgreSQL |
| Authentication | AWS Cognito |
| Storage | S3 |
| Realtime | API Gateway WebSocket |
| CDN | CloudFront |
| DNS | Route 53 |

---

## Current Platform Inventory

### Summary Statistics
| Category | Count |
|----------|-------|
| Database Tables | 122 |
| RLS Policies | 393 |
| Database Functions | 121 |
| Edge Functions | 101 |
| Frontend Pages | 89 |
| React Components | 148 |
| Custom Hooks | 25 |
| Utility Libraries | 37 |
| Storage Buckets | 5 |
| React Contexts | 3 |

---

## Phase 1: Infrastructure Setup

**Phase Duration: 2-3 weeks**
**Total Phase Hours: 220 hours (55 SP)**

### 1.1 AWS Account & Organization Setup
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| INF-001 | AWS Organization setup with multi-account strategy | 8 | 2 | Medium | None |
| INF-002 | IAM policies & roles configuration | 16 | 4 | High | INF-001 |
| INF-003 | Service control policies (SCPs) | 8 | 2 | Medium | INF-001 |
| INF-004 | AWS SSO configuration | 8 | 2 | Medium | INF-002 |
| INF-005 | Cost allocation tags & budgets | 4 | 1 | Low | INF-001 |
| **Subtotal** | | **44** | **11** | | |

### 1.2 Networking (VPC)
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| INF-006 | VPC design & CIDR planning | 8 | 2 | Medium | INF-001 |
| INF-007 | Public/Private subnet configuration (3 AZs) | 12 | 3 | Medium | INF-006 |
| INF-008 | NAT Gateway configuration | 4 | 1 | Low | INF-007 |
| INF-009 | Internet Gateway setup | 2 | 0.5 | Low | INF-007 |
| INF-010 | Route tables configuration | 4 | 1 | Low | INF-007 |
| INF-011 | VPC Flow Logs | 4 | 1 | Low | INF-006 |
| INF-012 | Security Groups (base templates) | 8 | 2 | Medium | INF-006 |
| INF-013 | Network ACLs | 4 | 1 | Low | INF-006 |
| **Subtotal** | | **46** | **11.5** | | |

### 1.3 Compute Infrastructure
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| INF-014 | ECS Cluster setup | 8 | 2 | Medium | INF-007 |
| INF-015 | ECR repository configuration | 4 | 1 | Low | INF-001 |
| INF-016 | Application Load Balancer (ALB) | 8 | 2 | Medium | INF-007 |
| INF-017 | Target groups configuration | 4 | 1 | Low | INF-016 |
| INF-018 | Auto-scaling policies | 8 | 2 | Medium | INF-014 |
| INF-019 | Lambda function base setup | 8 | 2 | Medium | INF-002 |
| **Subtotal** | | **40** | **10** | | |

### 1.4 CI/CD Pipeline
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| INF-020 | CodePipeline setup | 12 | 3 | Medium | INF-015 |
| INF-021 | CodeBuild projects (frontend/backend) | 16 | 4 | Medium | INF-020 |
| INF-022 | GitHub Actions integration | 8 | 2 | Medium | INF-015 |
| INF-023 | Deployment stages (dev/staging/prod) | 12 | 3 | Medium | INF-020 |
| INF-024 | Artifact management | 4 | 1 | Low | INF-020 |
| **Subtotal** | | **52** | **13** | | |

### 1.5 Monitoring & Logging
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| INF-025 | CloudWatch Log Groups | 4 | 1 | Low | INF-001 |
| INF-026 | CloudWatch Dashboards | 8 | 2 | Medium | INF-025 |
| INF-027 | CloudWatch Alarms | 8 | 2 | Medium | INF-025 |
| INF-028 | X-Ray tracing setup | 8 | 2 | Medium | INF-014 |
| INF-029 | SNS topics for alerts | 4 | 1 | Low | INF-001 |
| INF-030 | CloudTrail configuration | 4 | 1 | Low | INF-001 |
| **Subtotal** | | **36** | **9** | | |

---

## Phase 2: Database Migration

**Phase Duration: 3-4 weeks**
**Total Phase Hours: 356 hours (89 SP)**

### 2.1 RDS PostgreSQL Setup
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DB-001 | RDS instance provisioning (Multi-AZ) | 8 | 2 | Medium | INF-007 |
| DB-002 | Parameter groups configuration | 4 | 1 | Low | DB-001 |
| DB-003 | Subnet groups configuration | 4 | 1 | Low | DB-001 |
| DB-004 | Security group rules | 4 | 1 | Low | DB-001 |
| DB-005 | Backup & retention policies | 4 | 1 | Low | DB-001 |
| DB-006 | Performance Insights setup | 4 | 1 | Low | DB-001 |
| DB-007 | Read replicas configuration | 8 | 2 | Medium | DB-001 |
| **Subtotal** | | **36** | **9** | | |

### 2.2 Schema Migration - Core Tables (122 Tables)

#### Authentication & User Management (12 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-008 | profiles | 4 | 1 | Medium | 9 |
| DB-009 | user_roles | 4 | 1 | Medium | 4 |
| DB-010 | custom_roles | 3 | 0.75 | Medium | 5 |
| DB-011 | user_custom_roles | 3 | 0.75 | Medium | 3 |
| DB-012 | role_permissions | 3 | 0.75 | Medium | 3 |
| DB-013 | email_verification_tokens | 2 | 0.5 | Low | 4 |
| DB-014 | password_setup_invitations | 2 | 0.5 | Low | 2 |
| DB-015 | user_session_logs | 2 | 0.5 | Low | 2 |
| DB-016 | onboarding_progress | 2 | 0.5 | Low | 3 |
| DB-017 | user_portal_preferences | 2 | 0.5 | Low | 2 |
| DB-018 | user_badges | 2 | 0.5 | Low | 3 |
| DB-019 | user_topic_progress | 2 | 0.5 | Low | 3 |
| **Subtotal** | | **31** | **7.75** | | **43** |

#### Organization & Partner Management (8 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-020 | organizations | 4 | 1 | High | 4 |
| DB-021 | organization_members | 4 | 1 | High | 4 |
| DB-022 | organization_subscriptions | 3 | 0.75 | Medium | 2 |
| DB-023 | partner_applications | 3 | 0.75 | Medium | 4 |
| DB-024 | subscription_plans | 2 | 0.5 | Low | 2 |
| DB-025 | invoices | 3 | 0.75 | Medium | 2 |
| DB-026 | usage_tracking | 2 | 0.5 | Low | 2 |
| DB-027 | analytics_snapshots | 2 | 0.5 | Low | 3 |
| **Subtotal** | | **23** | **5.75** | | **23** |

#### Interview System (12 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-028 | interviews | 5 | 1.25 | High | 4 |
| DB-029 | questions | 4 | 1 | High | 10 |
| DB-030 | interview_attempts | 5 | 1.25 | High | 14 |
| DB-031 | attempt_questions | 3 | 0.75 | Medium | 4 |
| DB-032 | assessments | 4 | 1 | High | 5 |
| DB-033 | interview_invitations | 4 | 1 | High | 8 |
| DB-034 | interview_templates | 3 | 0.75 | Medium | 2 |
| DB-035 | interview_schedules | 2 | 0.5 | Low | 1 |
| DB-036 | interview_operation_logs | 2 | 0.5 | Low | 3 |
| DB-037 | interview_panel_members | 3 | 0.75 | Medium | 3 |
| DB-038 | panel_evaluations | 3 | 0.75 | Medium | 3 |
| DB-039 | panel_consensus | 3 | 0.75 | Medium | 3 |
| **Subtotal** | | **41** | **10.25** | | **60** |

#### Proctoring System (8 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-040 | proctoring_sessions | 5 | 1.25 | High | 10 |
| DB-041 | proctoring_violations | 4 | 1 | High | 3 |
| DB-042 | proctoring_settings | 3 | 0.75 | Medium | 3 |
| DB-043 | preinterview_check_logs | 2 | 0.5 | Low | 3 |
| DB-044 | chunk_upload_logs | 3 | 0.75 | Medium | 3 |
| DB-045 | merge_operation_logs | 2 | 0.5 | Low | 3 |
| DB-046 | live_stream_signals | 3 | 0.75 | Medium | 5 |
| DB-047 | consent_records | 2 | 0.5 | Low | 3 |
| **Subtotal** | | **24** | **6** | | **33** |

#### Certification System (10 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-048 | certification_topics | 3 | 0.75 | Medium | 4 |
| DB-049 | certification_assessments | 3 | 0.75 | Medium | 2 |
| DB-050 | certification_attempts | 4 | 1 | High | 5 |
| DB-051 | certification_global_config | 2 | 0.5 | Low | 3 |
| DB-052 | certificates | 4 | 1 | High | 7 |
| DB-053 | certificate_badges | 2 | 0.5 | Low | 4 |
| DB-054 | candidate_performance_index | 4 | 1 | High | 7 |
| DB-055 | bias_detection_results | 3 | 0.75 | Medium | 2 |
| DB-056 | comparative_analytics | 2 | 0.5 | Low | 1 |
| DB-057 | predictive_analytics | 2 | 0.5 | Low | 1 |
| **Subtotal** | | **29** | **7.25** | | **36** |

#### Learning System (12 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-058 | learning_plans | 3 | 0.75 | Medium | 2 |
| DB-059 | learning_assessments | 3 | 0.75 | Medium | 4 |
| DB-060 | learning_assessment_questions | 3 | 0.75 | Medium | 2 |
| DB-061 | learning_assessment_attempts | 4 | 1 | High | 6 |
| DB-062 | learning_assessment_feedback | 3 | 0.75 | Medium | 3 |
| DB-063 | learning_assessment_usage | 3 | 0.75 | Medium | 5 |
| DB-064 | learning_subscriptions | 3 | 0.75 | Medium | 3 |
| DB-065 | learning_payments | 3 | 0.75 | Medium | 3 |
| DB-066 | learning_materials | 2 | 0.5 | Low | 2 |
| DB-067 | training_plans | 2 | 0.5 | Low | 2 |
| DB-068 | training_topics | 2 | 0.5 | Low | 2 |
| DB-069 | user_training_assignments | 2 | 0.5 | Low | 2 |
| **Subtotal** | | **33** | **8.25** | | **36** |

#### AI & Model Management (14 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-070 | ai_providers | 3 | 0.75 | Medium | 1 |
| DB-071 | ai_provider_credentials | 4 | 1 | High | 1 |
| DB-072 | ai_feature_configurations | 3 | 0.75 | Medium | 1 |
| DB-073 | ai_feature_health | 3 | 0.75 | Medium | 2 |
| DB-074 | ai_feature_alerts | 2 | 0.5 | Low | 3 |
| DB-075 | ai_health_monitoring | 2 | 0.5 | Low | 2 |
| DB-076 | ai_health_checks | 2 | 0.5 | Low | 1 |
| DB-077 | ai_health_alerts | 2 | 0.5 | Low | 2 |
| DB-078 | ai_model_configurations | 3 | 0.75 | Medium | 3 |
| DB-079 | ai_model_performance | 2 | 0.5 | Low | 2 |
| DB-080 | ai_usage_logs | 3 | 0.75 | Medium | 3 |
| DB-081 | ai_coach_sessions | 3 | 0.75 | Medium | 4 |
| DB-082 | question_generation_logs | 2 | 0.5 | Low | 3 |
| DB-083 | evaluation_queue | 3 | 0.75 | Medium | 2 |
| **Subtotal** | | **37** | **9.25** | | **30** |

#### ATS & Integration (5 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-084 | ats_integrations | 4 | 1 | High | 3 |
| DB-085 | ats_candidates | 4 | 1 | High | 3 |
| DB-086 | ats_sync_logs | 2 | 0.5 | Low | 2 |
| DB-087 | resume_parsing_results | 3 | 0.75 | Medium | 2 |
| DB-088 | approval_workflows | 3 | 0.75 | Medium | 1 |
| **Subtotal** | | **16** | **4** | | **11** |

#### Notification & Communication (6 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-089 | notifications | 3 | 0.75 | Medium | 4 |
| DB-090 | email_templates | 3 | 0.75 | Medium | 4 |
| DB-091 | email_logs | 2 | 0.5 | Low | 2 |
| DB-092 | chatbot_knowledge | 3 | 0.75 | Medium | 2 |
| DB-093 | collaboration_threads | 3 | 0.75 | Medium | 1 |
| DB-094 | activity_feed | 2 | 0.5 | Low | 1 |
| **Subtotal** | | **16** | **4** | | **14** |

#### Payment & Billing (8 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-095 | payment_gateways | 3 | 0.75 | Medium | 1 |
| DB-096 | payment_methods | 3 | 0.75 | Medium | 3 |
| DB-097 | payment_transactions | 4 | 1 | High | 3 |
| DB-098 | promotions | 3 | 0.75 | Medium | 2 |
| DB-099 | promotion_usages | 2 | 0.5 | Low | 3 |
| DB-100 | promotion_applicable_orgs | 2 | 0.5 | Low | 2 |
| DB-101 | promotion_applicable_plans | 2 | 0.5 | Low | 2 |
| DB-102 | invoices | 3 | 0.75 | Medium | 2 |
| **Subtotal** | | **22** | **5.5** | | **18** |

#### Documentation & Reports (7 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-103 | documentation | 2 | 0.5 | Low | 2 |
| DB-104 | platform_documentation | 3 | 0.75 | Medium | 4 |
| DB-105 | platform_documentation_versions | 2 | 0.5 | Low | 2 |
| DB-106 | architecture_documents | 3 | 0.75 | Medium | 2 |
| DB-107 | generated_reports | 2 | 0.5 | Low | 1 |
| DB-108 | report_templates | 2 | 0.5 | Low | 2 |
| DB-109 | export_job_logs | 2 | 0.5 | Low | 3 |
| **Subtotal** | | **16** | **4** | | **16** |

#### System & Configuration (12 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-110 | platform_configurations | 2 | 0.5 | Low | 3 |
| DB-111 | system_config | 2 | 0.5 | Low | 2 |
| DB-112 | audit_logs | 3 | 0.75 | Medium | 5 |
| DB-113 | security_events | 3 | 0.75 | Medium | 2 |
| DB-114 | security_event_logs | 2 | 0.5 | Low | 2 |
| DB-115 | data_retention_policies | 2 | 0.5 | Low | 2 |
| DB-116 | data_deletion_requests | 3 | 0.75 | Medium | 3 |
| DB-117 | idempotency_keys | 2 | 0.5 | Low | 1 |
| DB-118 | rate_limit_buckets | 2 | 0.5 | Low | 1 |
| DB-119 | circuit_breaker_state | 2 | 0.5 | Low | 1 |
| DB-120 | cron_execution_logs | 2 | 0.5 | Low | 3 |
| DB-121 | failed_jobs | 2 | 0.5 | Low | 1 |
| **Subtotal** | | **27** | **6.75** | | **26** |

#### Testing & QA (5 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-122 | test_suites | 2 | 0.5 | Low | 2 |
| DB-123 | test_runs | 2 | 0.5 | Low | 2 |
| DB-124 | test_results | 2 | 0.5 | Low | 2 |
| DB-125 | admin_chat_context | 2 | 0.5 | Low | 1 |
| DB-126 | admin_saved_queries | 2 | 0.5 | Low | 1 |
| **Subtotal** | | **10** | **2.5** | | **8** |

#### Misc Tables (5 tables)
| Task ID | Table | Hours | SP | Complexity | RLS Policies |
|---------|-------|-------|-----|------------|--------------|
| DB-127 | realtime_connection_logs | 2 | 0.5 | Low | 2 |
| DB-128 | storage_operation_logs | 2 | 0.5 | Low | 2 |
| DB-129 | evaluation_queue_logs | 2 | 0.5 | Low | 3 |
| **Subtotal** | | **6** | **1.5** | | **7** |

### 2.3 Database Functions Migration (121 Functions)
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DB-130 | Core auth functions (has_role, get_user_roles, etc.) - 15 functions | 16 | 4 | High | DB-008-019 |
| DB-131 | Interview functions (create_attempt, get_questions, etc.) - 12 functions | 16 | 4 | High | DB-028-039 |
| DB-132 | Proctoring functions - 8 functions | 12 | 3 | High | DB-040-047 |
| DB-133 | Certification functions - 10 functions | 12 | 3 | Medium | DB-048-057 |
| DB-134 | Organization functions - 8 functions | 10 | 2.5 | Medium | DB-020-027 |
| DB-135 | Notification functions - 6 functions | 8 | 2 | Medium | DB-089-094 |
| DB-136 | Payment functions - 8 functions | 10 | 2.5 | Medium | DB-095-102 |
| DB-137 | Utility functions (generate_token, cleanup, etc.) - 20 functions | 16 | 4 | Medium | All tables |
| DB-138 | Circuit breaker & rate limiting functions - 8 functions | 10 | 2.5 | Medium | DB-118-119 |
| DB-139 | Audit & security functions - 10 functions | 12 | 3 | Medium | DB-112-116 |
| DB-140 | ATS integration functions - 6 functions | 8 | 2 | Medium | DB-084-088 |
| DB-141 | CPI calculation functions - 5 functions | 8 | 2 | High | DB-054 |
| DB-142 | Badge & achievement functions - 5 functions | 6 | 1.5 | Low | DB-018 |
| **Subtotal** | | **134** | **33.5** | | |

### 2.4 Data Migration
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DB-143 | Data extraction scripts | 16 | 4 | High | All DB-* |
| DB-144 | Data transformation logic | 16 | 4 | High | DB-143 |
| DB-145 | Data validation scripts | 12 | 3 | Medium | DB-143 |
| DB-146 | Incremental sync mechanism | 16 | 4 | High | DB-143 |
| DB-147 | Rollback procedures | 12 | 3 | High | DB-143 |
| **Subtotal** | | **72** | **18** | | |

---

## Phase 3: Authentication & Authorization

**Phase Duration: 2 weeks**
**Total Phase Hours: 112 hours (28 SP)**

### 3.1 AWS Cognito Setup
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| AUTH-001 | User Pool configuration | 8 | 2 | Medium | INF-001 |
| AUTH-002 | Identity Pool setup | 6 | 1.5 | Medium | AUTH-001 |
| AUTH-003 | App client configuration | 4 | 1 | Low | AUTH-001 |
| AUTH-004 | Custom attributes for roles | 6 | 1.5 | Medium | AUTH-001 |
| AUTH-005 | Password policies | 4 | 1 | Low | AUTH-001 |
| AUTH-006 | MFA configuration | 6 | 1.5 | Medium | AUTH-001 |
| AUTH-007 | Email verification setup | 6 | 1.5 | Medium | AUTH-001 |
| AUTH-008 | Social login (OAuth) | 8 | 2 | Medium | AUTH-001 |
| **Subtotal** | | **48** | **12** | | |

### 3.2 Custom Auth Flows
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| AUTH-009 | Pre-signup Lambda trigger | 8 | 2 | Medium | AUTH-001 |
| AUTH-010 | Post-confirmation Lambda trigger | 8 | 2 | Medium | AUTH-001 |
| AUTH-011 | Pre-token generation trigger | 8 | 2 | Medium | AUTH-001 |
| AUTH-012 | Custom message trigger (email templates) | 8 | 2 | Medium | AUTH-001 |
| AUTH-013 | User migration trigger | 12 | 3 | High | AUTH-001 |
| **Subtotal** | | **44** | **11** | | |

### 3.3 Authorization Layer
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| AUTH-014 | API Gateway authorizers | 8 | 2 | Medium | AUTH-001 |
| AUTH-015 | Role-based access middleware | 12 | 3 | High | AUTH-001 |
| **Subtotal** | | **20** | **5** | | |

---

## Phase 4: Backend Services Migration

**Phase Duration: 4-5 weeks**
**Total Phase Hours: 536 hours (134 SP)**

### 4.1 API Layer Setup
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| BE-001 | API Gateway REST API setup | 12 | 3 | Medium | AUTH-014 |
| BE-002 | API Gateway WebSocket API (realtime) | 16 | 4 | High | BE-001 |
| BE-003 | Request validation schemas | 12 | 3 | Medium | BE-001 |
| BE-004 | Response formatting middleware | 8 | 2 | Medium | BE-001 |
| BE-005 | Error handling middleware | 8 | 2 | Medium | BE-001 |
| BE-006 | Rate limiting (API Gateway) | 8 | 2 | Medium | BE-001 |
| BE-007 | CORS configuration | 4 | 1 | Low | BE-001 |
| **Subtotal** | | **68** | **17** | | |

### 4.2 Edge Functions → Lambda/ECS Migration (101 Functions)

#### Interview & Question Functions (18 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-008 | generate-questions | 8 | 2 | High | BE-001 |
| BE-009 | evaluate-interview | 10 | 2.5 | High | BE-001 |
| BE-010 | extract-skills | 6 | 1.5 | Medium | BE-001 |
| BE-011 | add-questions | 4 | 1 | Low | BE-001 |
| BE-012 | approve-questions | 4 | 1 | Low | BE-001 |
| BE-013 | batch-regenerate-questions | 6 | 1.5 | Medium | BE-001 |
| BE-014 | bulk-approve-questions | 4 | 1 | Low | BE-001 |
| BE-015 | get-approved-questions | 4 | 1 | Low | BE-001 |
| BE-016 | regenerate-questions | 6 | 1.5 | Medium | BE-001 |
| BE-017 | regenerate-single-question | 4 | 1 | Low | BE-001 |
| BE-018 | delete-interview | 4 | 1 | Low | BE-001 |
| BE-019 | schedule-interview | 4 | 1 | Low | BE-001 |
| BE-020 | create-from-template | 4 | 1 | Low | BE-001 |
| BE-021 | reassign-invitation-questions | 4 | 1 | Low | BE-001 |
| BE-022 | reassign-all-invitation-questions | 4 | 1 | Low | BE-001 |
| BE-023 | resolve-invitation | 4 | 1 | Low | BE-001 |
| BE-024 | resolve-slug-invitation | 4 | 1 | Low | BE-001 |
| BE-025 | submit-for-review | 4 | 1 | Low | BE-001 |
| **Subtotal** | | **88** | **22** | | |

#### Proctoring Functions (15 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-026 | init-proctoring-session | 8 | 2 | High | BE-001 |
| BE-027 | update-proctoring-session | 6 | 1.5 | Medium | BE-001 |
| BE-028 | get-chunk-upload-url | 8 | 2 | High | BE-001, S3 |
| BE-029 | get-proctoring-upload-url | 6 | 1.5 | Medium | BE-001, S3 |
| BE-030 | confirm-proctoring-upload | 6 | 1.5 | Medium | BE-001 |
| BE-031 | upload-proctoring-recording | 8 | 2 | High | BE-001, S3 |
| BE-032 | upload-proctoring-screenshot | 6 | 1.5 | Medium | BE-001, S3 |
| BE-033 | merge-proctoring-chunks | 10 | 2.5 | High | BE-001, S3 |
| BE-034 | repair-webm-metadata | 8 | 2 | High | BE-001 |
| BE-035 | analyze-proctoring-video | 10 | 2.5 | High | BE-001 |
| BE-036 | analyze-violations | 8 | 2 | High | BE-001 |
| BE-037 | log-proctoring-violation | 4 | 1 | Low | BE-001 |
| BE-038 | cleanup-proctoring-chunks | 6 | 1.5 | Medium | BE-001, S3 |
| BE-039 | cleanup-stale-proctoring | 6 | 1.5 | Medium | BE-001 |
| BE-040 | auto-close-sessions | 6 | 1.5 | Medium | BE-001 |
| **Subtotal** | | **106** | **26.5** | | |

#### Evaluation & Assessment Functions (10 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-041 | process-evaluation-queue | 10 | 2.5 | High | BE-001, SQS |
| BE-042 | auto-evaluate-trigger | 8 | 2 | High | BE-001 |
| BE-043 | calculate-cpi | 8 | 2 | High | BE-001 |
| BE-044 | detect-bias | 8 | 2 | High | BE-001 |
| BE-045 | refine-assessment-feedback | 6 | 1.5 | Medium | BE-001 |
| BE-046 | generate-predictive-analytics | 8 | 2 | High | BE-001 |
| BE-047 | generate-comparative-report | 8 | 2 | High | BE-001 |
| BE-048 | generate-custom-report | 6 | 1.5 | Medium | BE-001 |
| BE-049 | evaluate-certification | 8 | 2 | High | BE-001 |
| BE-050 | evaluate-learning-assessment | 8 | 2 | High | BE-001 |
| **Subtotal** | | **78** | **19.5** | | |

#### Certificate & Learning Functions (8 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-051 | generate-certificate-pdf | 10 | 2.5 | High | BE-001, S3 |
| BE-052 | generate-certification-questions | 8 | 2 | High | BE-001 |
| BE-053 | generate-learning-questions | 8 | 2 | High | BE-001 |
| BE-054 | generate-training-plan | 8 | 2 | High | BE-001 |
| BE-055 | check-assessment-limit | 4 | 1 | Low | BE-001 |
| BE-056 | generate-invoice | 8 | 2 | High | BE-001 |
| BE-057 | parse-resume | 8 | 2 | High | BE-001 |
| BE-058 | execute-code | 10 | 2.5 | High | BE-001 |
| **Subtotal** | | **64** | **16** | | |

#### Email & Notification Functions (12 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-059 | send-email | 6 | 1.5 | Medium | BE-001, SES |
| BE-060 | resend-email | 4 | 1 | Low | BE-059 |
| BE-061 | send-notification | 6 | 1.5 | Medium | BE-001 |
| BE-062 | send-interview-invitations | 6 | 1.5 | Medium | BE-059 |
| BE-063 | send-invitation-reminders | 6 | 1.5 | Medium | BE-059 |
| BE-064 | send-password-setup | 4 | 1 | Low | BE-059 |
| BE-065 | send-review-request | 4 | 1 | Low | BE-059 |
| BE-066 | send-verification-email | 4 | 1 | Low | BE-059 |
| BE-067 | verify-email-token | 4 | 1 | Low | BE-001 |
| BE-068 | enhance-email-content | 6 | 1.5 | Medium | BE-001 |
| BE-069 | auth-email-hook | 6 | 1.5 | Medium | BE-059 |
| BE-070 | chatbot-assist | 8 | 2 | High | BE-001 |
| **Subtotal** | | **64** | **16** | | |

#### Admin & Management Functions (14 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-071 | admin-user-management | 8 | 2 | High | BE-001 |
| BE-072 | admin-log-analysis | 8 | 2 | High | BE-001 |
| BE-073 | approve-partner-application | 6 | 1.5 | Medium | BE-001 |
| BE-074 | delete-organization | 6 | 1.5 | Medium | BE-001 |
| BE-075 | manage-organization-user | 6 | 1.5 | Medium | BE-001 |
| BE-076 | complete-user-signup | 4 | 1 | Low | BE-001 |
| BE-077 | complete-password-setup | 4 | 1 | Low | BE-001 |
| BE-078 | fix-pending-invitations | 4 | 1 | Low | BE-001 |
| BE-079 | cleanup-all-except-admins | 6 | 1.5 | Medium | BE-001 |
| BE-080 | cleanup-stuck-generations | 4 | 1 | Low | BE-001 |
| BE-081 | manage-scheduled-jobs | 6 | 1.5 | Medium | BE-001 |
| BE-082 | enforce-interview-deadlines | 4 | 1 | Low | BE-001 |
| BE-083 | scheduled-data-cleanup | 6 | 1.5 | Medium | BE-001 |
| BE-084 | cleanup-test-data | 4 | 1 | Low | BE-001 |
| **Subtotal** | | **76** | **19** | | |

#### AI & Health Monitoring Functions (8 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-085 | ai-health-monitor | 8 | 2 | High | BE-001 |
| BE-086 | scan-ai-features | 6 | 1.5 | Medium | BE-001 |
| BE-087 | scan-platform-features | 6 | 1.5 | Medium | BE-001 |
| BE-088 | test-ai-connection | 4 | 1 | Low | BE-001 |
| BE-089 | test-configuration | 4 | 1 | Low | BE-001 |
| BE-090 | update-ai-feature-model | 4 | 1 | Low | BE-001 |
| BE-091 | analyze-test-error | 6 | 1.5 | Medium | BE-001 |
| BE-092 | auto-fix-issue | 6 | 1.5 | Medium | BE-001 |
| **Subtotal** | | **44** | **11** | | |

#### Documentation & Content Functions (10 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-093 | generate-documentation | 8 | 2 | High | BE-001 |
| BE-094 | generate-documentation-from-code | 8 | 2 | High | BE-001 |
| BE-095 | generate-architecture-docs | 8 | 2 | High | BE-001 |
| BE-096 | update-architecture-diagram | 6 | 1.5 | Medium | BE-001 |
| BE-097 | improve-documentation-format | 6 | 1.5 | Medium | BE-001 |
| BE-098 | enhance-content-with-ai | 6 | 1.5 | Medium | BE-001 |
| BE-099 | enhance-job-description | 6 | 1.5 | Medium | BE-001 |
| BE-100 | generate-job-description | 6 | 1.5 | Medium | BE-001 |
| BE-101 | suggest-jd-content | 6 | 1.5 | Medium | BE-001 |
| BE-102 | generate-schema | 6 | 1.5 | Medium | BE-001 |
| BE-103 | check-file-changes | 4 | 1 | Low | BE-001 |
| **Subtotal** | | **70** | **17.5** | | |

#### Testing & Integration Functions (8 functions)
| Task ID | Function | Hours | SP | Complexity | Dependencies |
|---------|----------|-------|-----|------------|--------------|
| BE-104 | run-tests | 8 | 2 | High | BE-001 |
| BE-105 | run-flow-tests | 8 | 2 | High | BE-001 |
| BE-106 | run-comprehensive-flow-test | 8 | 2 | High | BE-001 |
| BE-107 | seed-test-data | 6 | 1.5 | Medium | BE-001 |
| BE-108 | seed-flow-data | 6 | 1.5 | Medium | BE-001 |
| BE-109 | validate-test-data | 4 | 1 | Low | BE-001 |
| BE-110 | ats-webhook | 8 | 2 | High | BE-001 |
| BE-111 | sync-ats-candidates | 8 | 2 | High | BE-001 |
| **Subtotal** | | **56** | **14** | | |

### 4.3 Storage Migration
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| BE-112 | S3 bucket setup (5 buckets) | 8 | 2 | Medium | INF-001 |
| BE-113 | Bucket policies & IAM | 8 | 2 | Medium | BE-112 |
| BE-114 | Lifecycle rules | 4 | 1 | Low | BE-112 |
| BE-115 | CORS configuration | 4 | 1 | Low | BE-112 |
| BE-116 | Presigned URL generation service | 8 | 2 | Medium | BE-112 |
| BE-117 | Storage data migration scripts | 16 | 4 | High | BE-112 |
| **Subtotal** | | **48** | **12** | | |

---

## Phase 5: Frontend Migration

**Phase Duration: 3-4 weeks**
**Total Phase Hours: 392 hours (98 SP)**

### 5.1 Build & Deployment Setup
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| FE-001 | S3 static hosting setup | 4 | 1 | Low | INF-001 |
| FE-002 | CloudFront distribution | 8 | 2 | Medium | FE-001 |
| FE-003 | Build pipeline configuration | 8 | 2 | Medium | INF-020 |
| FE-004 | Environment configuration | 4 | 1 | Low | FE-003 |
| **Subtotal** | | **24** | **6** | | |

### 5.2 Auth Integration Refactor
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| FE-005 | Replace Supabase Auth with Cognito SDK | 16 | 4 | High | AUTH-001 |
| FE-006 | AuthContext refactor | 12 | 3 | High | FE-005 |
| FE-007 | Session management refactor | 8 | 2 | Medium | FE-005 |
| FE-008 | Token refresh logic | 8 | 2 | Medium | FE-005 |
| **Subtotal** | | **44** | **11** | | |

### 5.3 API Client Refactor
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| FE-009 | Create REST API client service | 16 | 4 | High | BE-001 |
| FE-010 | Replace Supabase client calls (122 tables) | 40 | 10 | High | FE-009 |
| FE-011 | WebSocket client for realtime | 16 | 4 | High | BE-002 |
| FE-012 | Error handling standardization | 8 | 2 | Medium | FE-009 |
| **Subtotal** | | **80** | **20** | | |

### 5.4 Pages Migration (89 Pages)

#### Authentication Pages (4 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-013 | Auth.tsx | 6 | 1.5 | Medium |
| FE-014 | AuthVerify.tsx | 4 | 1 | Low |
| FE-015 | ResetPassword.tsx | 4 | 1 | Low |
| FE-016 | ResetPasswordConfirm.tsx | 4 | 1 | Low |
| FE-017 | VerifyEmail.tsx | 4 | 1 | Low |
| **Subtotal** | | **22** | **5.5** | |

#### Dashboard & Landing Pages (5 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-018 | Landing.tsx | 6 | 1.5 | Medium |
| FE-019 | Dashboard.tsx | 8 | 2 | High |
| FE-020 | UnifiedDashboard.tsx | 8 | 2 | High |
| FE-021 | LearningDashboard.tsx | 6 | 1.5 | Medium |
| FE-022 | RoleBasedRedirect.tsx | 4 | 1 | Low |
| **Subtotal** | | **32** | **8** | |

#### Interview Management Pages (12 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-023 | CreateInterview.tsx | 8 | 2 | High |
| FE-024 | InterviewDetail.tsx | 8 | 2 | High |
| FE-025 | InterviewQuestionsPreview.tsx | 6 | 1.5 | Medium |
| FE-026 | InterviewGenerationProgressPage.tsx | 4 | 1 | Low |
| FE-027 | InterviewProgress.tsx | 6 | 1.5 | Medium |
| FE-028 | InterviewComplete.tsx | 4 | 1 | Low |
| FE-029 | InterviewOperationLogs.tsx | 6 | 1.5 | Medium |
| FE-030 | TakeInterview.tsx | 10 | 2.5 | High |
| FE-031 | QuestionRepository.tsx | 6 | 1.5 | Medium |
| FE-032 | QuickCreatePreview.tsx | 4 | 1 | Low |
| FE-033 | TemplatesLibrary.tsx | 6 | 1.5 | Medium |
| FE-034 | JDBuilderWizard.tsx | 8 | 2 | High |
| **Subtotal** | | **76** | **19** | |

#### Proctoring Pages (4 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-035 | ProctoringDashboard.tsx | 8 | 2 | High |
| FE-036 | ProctoringSettings.tsx | 6 | 1.5 | Medium |
| FE-037 | ProctoringTestPage.tsx | 6 | 1.5 | Medium |
| FE-038 | PreInterviewCheckLogs.tsx | 4 | 1 | Low |
| **Subtotal** | | **24** | **6** | |

#### Assessment & Reporting Pages (6 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-039 | AssessmentReport.tsx | 8 | 2 | High |
| FE-040 | ReportBuilder.tsx | 8 | 2 | High |
| FE-041 | AdvancedAnalytics.tsx | 8 | 2 | High |
| FE-042 | OrganizationAnalytics.tsx | 6 | 1.5 | Medium |
| FE-043 | PerformanceBenchmark.tsx | 6 | 1.5 | Medium |
| FE-044 | PendingReviews.tsx | 4 | 1 | Low |
| **Subtotal** | | **40** | **10** | |

#### Certification Pages (8 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-045 | Certifications.tsx | 6 | 1.5 | Medium |
| FE-046 | CertificationAdmin.tsx | 8 | 2 | High |
| FE-047 | CertificationAnalytics.tsx | 6 | 1.5 | Medium |
| FE-048 | CertificationConfiguration.tsx | 6 | 1.5 | Medium |
| FE-049 | CertificationResult.tsx | 4 | 1 | Low |
| FE-050 | TakeCertification.tsx | 8 | 2 | High |
| FE-051 | MyCertificates.tsx | 4 | 1 | Low |
| FE-052 | VerifyCertificate.tsx | 4 | 1 | Low |
| **Subtotal** | | **46** | **11.5** | |

#### Learning Pages (10 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-053 | LearningProgress.tsx | 6 | 1.5 | Medium |
| FE-054 | LearningHistory.tsx | 4 | 1 | Low |
| FE-055 | LearningFeedback.tsx | 4 | 1 | Low |
| FE-056 | LearningPricing.tsx | 4 | 1 | Low |
| FE-057 | LearningPlanManagement.tsx | 6 | 1.5 | Medium |
| FE-058 | MyLearningPlan.tsx | 6 | 1.5 | Medium |
| FE-059 | TakeLearningAssessment.tsx | 8 | 2 | High |
| FE-060 | PracticeAssessmentConfiguration.tsx | 6 | 1.5 | Medium |
| FE-061 | PlatformAdminLearning.tsx | 6 | 1.5 | Medium |
| FE-062 | AdminTraining.tsx | 6 | 1.5 | Medium |
| **Subtotal** | | **56** | **14** | |

#### Organization & Partner Pages (12 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-063 | OrganizationManagement.tsx | 8 | 2 | High |
| FE-064 | OrganizationSettings.tsx | 6 | 1.5 | Medium |
| FE-065 | OrganizationUserManagement.tsx | 6 | 1.5 | Medium |
| FE-066 | OrganizationsList.tsx | 4 | 1 | Low |
| FE-067 | PartnerPortal.tsx | 8 | 2 | High |
| FE-068 | PartnerOnboarding.tsx | 6 | 1.5 | Medium |
| FE-069 | PartnerApplicationsReview.tsx | 6 | 1.5 | Medium |
| FE-070 | PartnerBilling.tsx | 6 | 1.5 | Medium |
| FE-071 | PartnerCostMonitoring.tsx | 6 | 1.5 | Medium |
| FE-072 | PartnerReports.tsx | 6 | 1.5 | Medium |
| FE-073 | PartnerManageIndexRedirect.tsx | 2 | 0.5 | Low |
| FE-074 | MyApplications.tsx | 4 | 1 | Low |
| **Subtotal** | | **68** | **17** | |

#### Admin Pages (12 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-075 | PlatformAdminHub.tsx | 8 | 2 | High |
| FE-076 | AIConfiguration.tsx | 8 | 2 | High |
| FE-077 | admin/AIUsageMonitoring.tsx | 6 | 1.5 | Medium |
| FE-078 | admin/LogAnalysis.tsx | 6 | 1.5 | Medium |
| FE-079 | admin/ScheduledJobsAdmin.tsx | 6 | 1.5 | Medium |
| FE-080 | admin/SystemMonitoring.tsx | 8 | 2 | High |
| FE-081 | UnifiedUserManagement.tsx | 8 | 2 | High |
| FE-082 | RoleAssignment.tsx | 6 | 1.5 | Medium |
| FE-083 | RolePermissionsManagement.tsx | 6 | 1.5 | Medium |
| FE-084 | ChatbotManagement.tsx | 6 | 1.5 | Medium |
| FE-085 | ChatbotTraining.tsx | 6 | 1.5 | Medium |
| FE-086 | TestingHub.tsx | 6 | 1.5 | Medium |
| **Subtotal** | | **80** | **20** | |

#### Settings & Configuration Pages (8 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-087 | Settings.tsx | 6 | 1.5 | Medium |
| FE-088 | Profile.tsx | 4 | 1 | Low |
| FE-089 | Notifications.tsx | 4 | 1 | Low |
| FE-090 | EmailConfiguration.tsx | 6 | 1.5 | Medium |
| FE-091 | PaymentGatewayManagement.tsx | 6 | 1.5 | Medium |
| FE-092 | PaymentSetup.tsx | 6 | 1.5 | Medium |
| FE-093 | BillingManagement.tsx | 6 | 1.5 | Medium |
| FE-094 | Pricing.tsx | 4 | 1 | Low |
| **Subtotal** | | **42** | **10.5** | |

#### Documentation & Deployment Pages (6 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-095 | Documentation.tsx | 6 | 1.5 | Medium |
| FE-096 | DocumentationGenerator.tsx | 6 | 1.5 | Medium |
| FE-097 | ArchitectureDocs.tsx | 6 | 1.5 | Medium |
| FE-098 | DeploymentDashboard.tsx | 6 | 1.5 | Medium |
| FE-099 | DeploymentConfigurator.tsx | 8 | 2 | High |
| FE-100 | DeploymentHistory.tsx | 4 | 1 | Low |
| **Subtotal** | | **36** | **9** | |

#### Misc Pages (4 pages)
| Task ID | Page | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-101 | AutomatedTestSuite.tsx | 6 | 1.5 | Medium |
| FE-102 | PlanManagement.tsx | 6 | 1.5 | Medium |
| FE-103 | PromotionManagement.tsx | 6 | 1.5 | Medium |
| FE-104 | NotFound.tsx | 2 | 0.5 | Low |
| **Subtotal** | | **20** | **5** | |

### 5.5 Components Migration (148 Components)

#### UI Components (50 components - Shadcn/UI)
| Task ID | Task | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-105 | Migrate all 50 Shadcn/UI components (no changes needed) | 8 | 2 | Low |
| **Subtotal** | | **8** | **2** | |

#### Feature Components (98 custom components)
| Task ID | Component Group | Count | Hours | SP | Complexity |
|---------|----------------|-------|-------|-----|------------|
| FE-106 | Interview components | 12 | 24 | 6 | Medium |
| FE-107 | Proctoring components | 13 | 32 | 8 | High |
| FE-108 | Assessment components | 2 | 4 | 1 | Low |
| FE-109 | Reports components | 3 | 8 | 2 | Medium |
| FE-110 | Partner components | 1 | 2 | 0.5 | Low |
| FE-111 | Shared components | 5 | 10 | 2.5 | Medium |
| FE-112 | Layout components | 4 | 8 | 2 | Medium |
| FE-113 | Admin components | 1 | 2 | 0.5 | Low |
| FE-114 | JD Builder components | 1 | 4 | 1 | Low |
| FE-115 | Root-level components (47) | 47 | 72 | 18 | Medium |
| **Subtotal** | | **98** | **166** | **41.5** | |

### 5.6 Hooks Migration (25 Hooks)
| Task ID | Hook | Hours | SP | Complexity |
|---------|------|-------|-----|------------|
| FE-116 | useUserRoles | 4 | 1 | Medium |
| FE-117 | usePermissions | 4 | 1 | Medium |
| FE-118 | useProctoring | 6 | 1.5 | High |
| FE-119 | useProctoringSession | 6 | 1.5 | High |
| FE-120 | useChunkUploader | 6 | 1.5 | High |
| FE-121 | useUploadProgress | 4 | 1 | Medium |
| FE-122 | useUploadGuard | 4 | 1 | Medium |
| FE-123 | useRecordingValidator | 4 | 1 | Medium |
| FE-124 | useNetworkStatus | 2 | 0.5 | Low |
| FE-125 | useNotifications | 4 | 1 | Medium |
| FE-126 | useAIHealthMonitoring | 4 | 1 | Medium |
| FE-127 | useAutoRecovery | 4 | 1 | Medium |
| FE-128 | useEmailResend | 2 | 0.5 | Low |
| FE-129 | useInterviewConfiguration | 4 | 1 | Medium |
| FE-130 | useLayoutGuard | 2 | 0.5 | Low |
| FE-131 | useLogAnalysisChat | 4 | 1 | Medium |
| FE-132 | useOnboarding | 2 | 0.5 | Low |
| FE-133 | usePaymentGateway | 4 | 1 | Medium |
| FE-134 | usePortalCardOrder | 2 | 0.5 | Low |
| FE-135 | useRoleBreadcrumbs | 2 | 0.5 | Low |
| FE-136 | useUserFriendlyToast | 2 | 0.5 | Low |
| FE-137 | useCustomRoles | 4 | 1 | Medium |
| FE-138 | useCandidateBroadcast | 4 | 1 | Medium |
| FE-139 | use-mobile | 2 | 0.5 | Low |
| FE-140 | use-toast | 2 | 0.5 | Low |
| **Subtotal** | | **88** | **22** | |

### 5.7 Contexts Migration (3 Contexts)
| Task ID | Context | Hours | SP | Complexity |
|---------|---------|-------|-----|------------|
| FE-141 | AuthContext.tsx | 12 | 3 | High |
| FE-142 | OrganizationContext.tsx | 8 | 2 | Medium |
| FE-143 | ProctoringContext.tsx | 12 | 3 | High |
| **Subtotal** | | **32** | **8** | |

### 5.8 Utility Libraries Migration (37 Libraries)
| Task ID | Library Group | Hours | SP | Complexity |
|---------|--------------|-------|-----|------------|
| FE-144 | Proctoring utilities (face detection, gaze, liveness, voice) | 16 | 4 | High |
| FE-145 | Upload utilities (backgroundUploader, chunkUploader, etc.) | 12 | 3 | High |
| FE-146 | Logging utilities (logger, systemLogger, auditLogger) | 8 | 2 | Medium |
| FE-147 | Validation utilities | 4 | 1 | Low |
| FE-148 | Configuration utilities | 4 | 1 | Low |
| FE-149 | Error handling utilities | 6 | 1.5 | Medium |
| FE-150 | Permission utilities | 4 | 1 | Low |
| FE-151 | Export utilities (documentExport) | 4 | 1 | Low |
| FE-152 | Other utilities | 8 | 2 | Medium |
| **Subtotal** | | **66** | **16.5** | |

---

## Phase 6: Testing & QA

**Phase Duration: 2-3 weeks**
**Total Phase Hours: 260 hours (65 SP)**

### 6.1 Unit Testing
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| QA-001 | Database function tests | 24 | 6 | High | Phase 2 |
| QA-002 | Backend service tests | 32 | 8 | High | Phase 4 |
| QA-003 | Frontend component tests | 24 | 6 | Medium | Phase 5 |
| QA-004 | Hook tests | 16 | 4 | Medium | Phase 5 |
| **Subtotal** | | **96** | **24** | | |

### 6.2 Integration Testing
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| QA-005 | Auth flow integration tests | 16 | 4 | High | AUTH-* |
| QA-006 | Interview workflow tests | 24 | 6 | High | BE-008-025 |
| QA-007 | Proctoring workflow tests | 24 | 6 | High | BE-026-040 |
| QA-008 | Evaluation workflow tests | 16 | 4 | High | BE-041-050 |
| QA-009 | Certification workflow tests | 16 | 4 | High | BE-051-058 |
| QA-010 | Email notification tests | 8 | 2 | Medium | BE-059-070 |
| **Subtotal** | | **104** | **26** | | |

### 6.3 End-to-End Testing
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| QA-011 | Candidate interview E2E | 16 | 4 | High | All |
| QA-012 | Admin workflows E2E | 16 | 4 | High | All |
| QA-013 | Partner workflows E2E | 12 | 3 | Medium | All |
| QA-014 | Certification E2E | 12 | 3 | Medium | All |
| **Subtotal** | | **56** | **14** | | |

### 6.4 Performance Testing
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| QA-015 | Load testing setup | 8 | 2 | Medium | All |
| QA-016 | Load test execution | 8 | 2 | Medium | QA-015 |
| QA-017 | Performance optimization | 16 | 4 | High | QA-016 |
| **Subtotal** | | **32** | **8** | | |

---

## Phase 7: Deployment & Cutover

**Phase Duration: 1-2 weeks**
**Total Phase Hours: 136 hours (34 SP)**

### 7.1 Staging Environment
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DEP-001 | Staging infrastructure deployment | 16 | 4 | High | Phase 1 |
| DEP-002 | Staging data migration | 12 | 3 | High | Phase 2 |
| DEP-003 | Staging smoke tests | 8 | 2 | Medium | DEP-001-002 |
| **Subtotal** | | **36** | **9** | | |

### 7.2 Production Environment
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DEP-004 | Production infrastructure deployment | 16 | 4 | High | DEP-001-003 |
| DEP-005 | DNS configuration (Route 53) | 8 | 2 | Medium | DEP-004 |
| DEP-006 | SSL certificate setup (ACM) | 4 | 1 | Low | DEP-005 |
| DEP-007 | CDN configuration | 8 | 2 | Medium | DEP-004 |
| **Subtotal** | | **36** | **9** | | |

### 7.3 Data Migration & Cutover
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DEP-008 | Final data sync | 12 | 3 | High | DEP-004 |
| DEP-009 | DNS cutover | 4 | 1 | Low | DEP-008 |
| DEP-010 | Monitoring validation | 8 | 2 | Medium | DEP-009 |
| DEP-011 | Rollback plan execution test | 8 | 2 | Medium | DEP-008 |
| **Subtotal** | | **32** | **8** | | |

### 7.4 Post-Deployment
| Task ID | Task | Hours | SP | Complexity | Dependencies |
|---------|------|-------|-----|------------|--------------|
| DEP-012 | Hypercare support (3 days) | 24 | 6 | Medium | DEP-009 |
| DEP-013 | Documentation updates | 8 | 2 | Low | DEP-012 |
| **Subtotal** | | **32** | **8** | | |

---

## Summary by Phase

| Phase | Hours | Story Points | Duration |
|-------|-------|--------------|----------|
| Phase 1: Infrastructure Setup | 220 | 55 | 2-3 weeks |
| Phase 2: Database Migration | 356 | 89 | 3-4 weeks |
| Phase 3: Authentication | 112 | 28 | 2 weeks |
| Phase 4: Backend Services | 536 | 134 | 4-5 weeks |
| Phase 5: Frontend Migration | 392 | 98 | 3-4 weeks |
| Phase 6: Testing & QA | 260 | 65 | 2-3 weeks |
| Phase 7: Deployment | 136 | 34 | 1-2 weeks |
| **TOTAL** | **2,012** | **503** | **17-23 weeks** |

---

## Risk Assessment

### High Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Proctoring video upload complexity | High | High | Early POC for chunk upload to S3 |
| AI model integration delays | High | Medium | Use same AI providers, test early |
| Data migration data loss | Critical | Low | Multiple backup points, validation scripts |
| Performance degradation | High | Medium | Load testing in staging |

### Medium Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Auth migration user disruption | Medium | Medium | Parallel login period |
| Realtime feature parity | Medium | Medium | WebSocket testing plan |
| RLS to application-level security | Medium | High | Comprehensive security review |

---

## Resource Requirements

### Recommended Team Composition
| Role | Count | Responsibilities |
|------|-------|-----------------|
| Tech Lead / Architect | 1 | Architecture decisions, code reviews |
| Senior Backend Developer | 2 | Lambda/ECS migration, API development |
| Senior Frontend Developer | 2 | React refactoring, Cognito integration |
| DevOps Engineer | 1 | Infrastructure, CI/CD, monitoring |
| Database Engineer | 1 | RDS setup, data migration |
| QA Engineer | 2 | Testing automation, E2E testing |
| Project Manager | 1 | Coordination, tracking |
| **TOTAL** | **10** | |

### AWS Cost Estimate (Monthly)
| Service | Estimate |
|---------|----------|
| ECS Fargate | $150-300 |
| RDS PostgreSQL (Multi-AZ) | $200-400 |
| S3 Storage | $50-100 |
| CloudFront | $50-100 |
| Lambda | $20-50 |
| Cognito | $0-50 |
| Misc (Route 53, SES, etc.) | $30-50 |
| **TOTAL** | **$500-1,050/month** |

---

## Appendix A: Complete File Inventory

### Edge Functions (101 total)
```
add-questions
admin-log-analysis
admin-user-management
ai-health-monitor
analyze-proctoring-video
analyze-test-error
analyze-violations
approve-partner-application
approve-questions
ats-webhook
auth-email-hook
auto-close-sessions
auto-evaluate-trigger
auto-fix-issue
batch-regenerate-questions
bulk-approve-questions
calculate-cpi
chatbot-assist
check-assessment-limit
check-file-changes
cleanup-all-except-admins
cleanup-proctoring-chunks
cleanup-stale-proctoring
cleanup-stuck-generations
cleanup-test-data
complete-password-setup
complete-user-signup
confirm-proctoring-upload
create-from-template
delete-interview
delete-organization
detect-bias
enforce-interview-deadlines
enhance-content-with-ai
enhance-email-content
enhance-job-description
evaluate-certification
evaluate-interview
evaluate-learning-assessment
execute-code
extract-skills
fix-pending-invitations
generate-architecture-docs
generate-certificate-pdf
generate-certification-questions
generate-comparative-report
generate-custom-report
generate-documentation-from-code
generate-documentation
generate-invoice
generate-job-description
generate-learning-questions
generate-predictive-analytics
generate-questions
generate-schema
generate-training-plan
get-approved-questions
get-chunk-upload-url
get-proctoring-upload-url
improve-documentation-format
init-proctoring-session
log-proctoring-violation
manage-organization-user
manage-scheduled-jobs
merge-proctoring-chunks
parse-resume
process-evaluation-queue
reassign-all-invitation-questions
reassign-invitation-questions
refine-assessment-feedback
regenerate-questions
regenerate-single-question
repair-webm-metadata
resend-email
resolve-invitation
resolve-slug-invitation
run-comprehensive-flow-test
run-flow-tests
run-tests
scan-ai-features
scan-platform-features
schedule-interview
scheduled-data-cleanup
seed-flow-data
seed-test-data
send-email
send-interview-invitations
send-invitation-reminders
send-notification
send-password-setup
send-review-request
send-verification-email
submit-for-review
suggest-jd-content
sync-ats-candidates
test-ai-connection
test-configuration
update-ai-feature-model
update-architecture-diagram
update-proctoring-session
upload-proctoring-recording
upload-proctoring-screenshot
validate-test-data
verify-email-token
```

### Database Tables (122 total)
```
activity_feed
admin_chat_context
admin_saved_queries
ai_coach_sessions
ai_feature_alerts
ai_feature_configurations
ai_feature_health
ai_health_alerts
ai_health_checks
ai_health_monitoring
ai_model_configurations
ai_model_performance
ai_provider_credentials
ai_providers
ai_usage_logs
analytics_snapshots
approval_workflows
architecture_documents
assessments
ats_candidates
ats_integrations
ats_sync_logs
attempt_questions
audit_logs
bias_detection_results
candidate_performance_index
certificate_badges
certificates
certification_assessments
certification_attempts
certification_global_config
certification_topics
chatbot_knowledge
chunk_upload_logs
circuit_breaker_state
collaboration_threads
comparative_analytics
consent_records
cron_execution_logs
custom_roles
data_deletion_requests
data_retention_policies
documentation
email_logs
email_templates
email_verification_tokens
evaluation_queue
evaluation_queue_logs
export_job_logs
failed_jobs
generated_reports
idempotency_keys
interview_attempts
interview_invitations
interview_operation_logs
interview_panel_members
interview_schedules
interview_templates
interviews
invoices
learning_assessment_attempts
learning_assessment_feedback
learning_assessment_questions
learning_assessment_usage
learning_assessments
learning_materials
learning_payments
learning_plans
learning_subscriptions
live_stream_signals
merge_operation_logs
notifications
onboarding_progress
organization_members
organization_subscriptions
organizations
panel_consensus
panel_evaluations
partner_applications
password_setup_invitations
payment_gateways
payment_methods
payment_transactions
platform_configurations
platform_documentation
platform_documentation_versions
predictive_analytics
preinterview_check_logs
proctoring_sessions
proctoring_settings
proctoring_violations
profiles
promotion_applicable_orgs
promotion_applicable_plans
promotion_usages
promotions
question_generation_logs
questions
rate_limit_buckets
realtime_connection_logs
report_templates
resume_parsing_results
role_permissions
security_event_logs
security_events
storage_operation_logs
subscription_plans
system_config
test_results
test_runs
test_suites
training_plans
training_topics
usage_tracking
user_badges
user_custom_roles
user_portal_preferences
user_roles
user_session_logs
user_topic_progress
user_training_assignments
```

### Storage Buckets (5 total)
```
candidate-resumes (PDF, DOCX - 10MB limit)
certificates (Public)
consent-documents
documentation
proctoring-recordings
```

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Prepared For**: AWS Migration Project
