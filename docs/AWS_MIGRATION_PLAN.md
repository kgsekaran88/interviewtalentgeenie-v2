# TalentGeenie AWS Migration Plan
## Complete Platform Migration: Lovable/Supabase → AWS Self-Hosted

**Document Version:** 1.0  
**Created:** February 2026  
**Platform:** Interview-as-a-Service (IAS) - TalentGeenie  

---

## 📊 Executive Summary

| Metric | Count |
|--------|-------|
| **Database Tables** | 122 |
| **RLS Policies** | 393 |
| **Database Functions** | 121 |
| **Edge Functions** | 101 |
| **Frontend Pages** | 89 |
| **React Components** | 148 |
| **Custom Hooks** | 25 |
| **Contexts** | 3 |
| **Utility Libraries** | 37 |

### Total Estimated Effort

| Phase | Story Points | Hours | Team Size | Duration |
|-------|-------------|-------|-----------|----------|
| **Phase 1: Infrastructure Setup** | 55 SP | 220 hrs | 2 DevOps | 3 weeks |
| **Phase 2: Database Migration** | 89 SP | 356 hrs | 2 Backend | 4 weeks |
| **Phase 3: Backend Services** | 134 SP | 536 hrs | 3 Backend | 6 weeks |
| **Phase 4: Frontend Migration** | 98 SP | 392 hrs | 3 Frontend | 5 weeks |
| **Phase 5: Testing & QA** | 65 SP | 260 hrs | 2 QA | 4 weeks |
| **Phase 6: Deployment & Cutover** | 34 SP | 136 hrs | 2 DevOps | 2 weeks |
| **TOTAL** | **475 SP** | **1,900 hrs** | **8-10 devs** | **16-20 weeks** |

---

## 🏗️ Phase 1: AWS Infrastructure Setup

### 1.1 Core Infrastructure (IaC with Terraform)

| Component | Description | Story Points | Hours | Complexity |
|-----------|-------------|--------------|-------|------------|
| VPC Setup | Multi-AZ VPC with public/private subnets | 5 | 20 | Medium |
| Security Groups | Network security rules, ingress/egress | 3 | 12 | Low |
| IAM Roles & Policies | Service roles, cross-account access | 5 | 20 | Medium |
| Route 53 DNS | Hosted zones, domain configuration | 2 | 8 | Low |
| ACM Certificates | SSL/TLS certificate provisioning | 2 | 8 | Low |
| **Subtotal** | | **17** | **68** | |

### 1.2 Compute & Container Infrastructure

| Component | Description | Story Points | Hours | Complexity |
|-----------|-------------|--------------|-------|------------|
| ECS Cluster | Fargate cluster configuration | 5 | 20 | Medium |
| ECR Repositories | Container registry setup | 2 | 8 | Low |
| Application Load Balancer | ALB with target groups | 3 | 12 | Medium |
| Auto Scaling | ECS service auto-scaling policies | 3 | 12 | Medium |
| CloudFront CDN | Static asset distribution | 3 | 12 | Medium |
| **Subtotal** | | **16** | **64** | |

### 1.3 CI/CD Pipeline

| Component | Description | Story Points | Hours | Complexity |
|-----------|-------------|--------------|-------|------------|
| GitHub Actions / CodePipeline | Build & deploy workflows | 5 | 20 | Medium |
| CodeBuild Projects | Docker image builds | 3 | 12 | Medium |
| Secrets Manager Integration | CI/CD secrets injection | 2 | 8 | Low |
| Environment Management | Dev/Staging/Prod pipelines | 3 | 12 | Medium |
| **Subtotal** | | **13** | **52** | |

### 1.4 Monitoring & Observability

| Component | Description | Story Points | Hours | Complexity |
|-----------|-------------|--------------|-------|------------|
| CloudWatch Logs | Log aggregation setup | 2 | 8 | Low |
| CloudWatch Alarms | Critical alerts configuration | 3 | 12 | Medium |
| X-Ray Tracing | Distributed tracing | 3 | 12 | Medium |
| Prometheus/Grafana (Optional) | Custom dashboards | 4 | 16 | Medium |
| **Subtotal** | | **12** | **48** | |

**Phase 1 Total: 55 SP | 220 hours**

---

## 🗄️ Phase 2: Database Migration

### 2.1 RDS PostgreSQL Setup

| Task | Description | Story Points | Hours | Complexity |
|------|-------------|--------------|-------|------------|
| RDS Instance Provisioning | Multi-AZ PostgreSQL 15+ | 3 | 12 | Medium |
| Parameter Groups | Performance tuning | 2 | 8 | Low |
| Subnet Groups | Database network config | 1 | 4 | Low |
| Backup Configuration | Automated backups, PITR | 2 | 8 | Low |
| Read Replicas (Optional) | Read scaling | 3 | 12 | Medium |
| **Subtotal** | | **11** | **44** | |

### 2.2 Database Tables (122 Tables)

#### Core Business Tables (21 tables) - **28 SP | 112 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `organizations` | 15 | Base entity | 2 | 8 |
| `profiles` | 18 | FK: auth.users | 2 | 8 |
| `user_roles` | 5 | FK: profiles | 1 | 4 |
| `organization_members` | 8 | FK: orgs, profiles | 2 | 8 |
| `interviews` | 25 | FK: orgs, profiles | 3 | 12 |
| `interview_invitations` | 18 | FK: interviews | 2 | 8 |
| `interview_attempts` | 22 | FK: invitations | 3 | 12 |
| `questions` | 20 | FK: interviews | 2 | 8 |
| `attempt_questions` | 5 | Junction table | 1 | 4 |
| `assessments` | 15 | FK: attempts | 2 | 8 |
| `candidate_performance_index` | 20 | FK: attempts | 2 | 8 |
| `interview_schedules` | 12 | FK: interviews | 1 | 4 |
| `interview_panel_members` | 8 | FK: interviews | 1 | 4 |
| `panel_evaluations` | 12 | FK: attempts | 1 | 4 |
| `panel_consensus` | 8 | FK: attempts | 1 | 4 |
| `interview_templates` | 15 | FK: orgs | 1 | 4 |
| `interview_operation_logs` | 12 | Audit logging | 1 | 4 |
| `subscription_plans` | 18 | Billing core | 2 | 8 |
| `organization_subscriptions` | 12 | FK: orgs, plans | 2 | 8 |
| `invoices` | 15 | FK: subscriptions | 1 | 4 |
| `partner_applications` | 20 | Onboarding | 2 | 8 |

#### Proctoring & Recording Tables (12 tables) - **18 SP | 72 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `proctoring_sessions` | 25 | FK: attempts | 2 | 8 |
| `proctoring_violations` | 15 | FK: sessions | 2 | 8 |
| `proctoring_settings` | 20 | FK: orgs | 2 | 8 |
| `chunk_upload_logs` | 18 | FK: sessions | 2 | 8 |
| `merge_operation_logs` | 12 | FK: sessions | 1 | 4 |
| `storage_operation_logs` | 10 | Audit | 1 | 4 |
| `consent_records` | 12 | FK: attempts | 1 | 4 |
| `preinterview_check_logs` | 15 | FK: attempts | 2 | 8 |
| `live_stream_signals` | 10 | Realtime | 1 | 4 |
| `realtime_connection_logs` | 8 | Monitoring | 1 | 4 |
| `bias_detection_results` | 18 | FK: assessments | 2 | 8 |
| `resume_parsing_results` | 15 | FK: invitations | 1 | 4 |

#### Learning & Certification Tables (16 tables) - **22 SP | 88 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `certification_topics` | 18 | Base entity | 2 | 8 |
| `certification_assessments` | 15 | FK: topics | 2 | 8 |
| `certification_attempts` | 20 | FK: assessments | 2 | 8 |
| `certificates` | 18 | FK: attempts | 2 | 8 |
| `certificate_badges` | 12 | Gamification | 1 | 4 |
| `user_badges` | 8 | FK: profiles, badges | 1 | 4 |
| `certification_global_config` | 10 | Settings | 1 | 4 |
| `learning_assessments` | 15 | Practice mode | 2 | 8 |
| `learning_assessment_attempts` | 18 | FK: assessments | 2 | 8 |
| `learning_assessment_questions` | 12 | FK: attempts | 1 | 4 |
| `learning_assessment_feedback` | 15 | FK: attempts | 1 | 4 |
| `learning_assessment_usage` | 10 | Tracking | 1 | 4 |
| `learning_plans` | 15 | FK: orgs | 2 | 8 |
| `learning_subscriptions` | 12 | FK: profiles | 1 | 4 |
| `learning_payments` | 15 | FK: subscriptions | 1 | 4 |
| `learning_materials` | 12 | Content | 1 | 4 |

#### AI & Analytics Tables (18 tables) - **20 SP | 80 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `ai_providers` | 12 | Provider config | 1 | 4 |
| `ai_provider_credentials` | 10 | FK: providers | 1 | 4 |
| `ai_feature_configurations` | 15 | Feature flags | 2 | 8 |
| `ai_feature_health` | 20 | Health monitoring | 2 | 8 |
| `ai_health_alerts` | 12 | Alert system | 1 | 4 |
| `ai_health_checks` | 10 | Health logs | 1 | 4 |
| `ai_health_monitoring` | 12 | Monitoring | 1 | 4 |
| `ai_model_configurations` | 15 | Model settings | 1 | 4 |
| `ai_model_performance` | 18 | A/B testing | 2 | 8 |
| `ai_usage_logs` | 15 | Usage tracking | 1 | 4 |
| `ai_coach_sessions` | 12 | Interactive AI | 1 | 4 |
| `ai_feature_alerts` | 10 | Alerting | 1 | 4 |
| `analytics_snapshots` | 15 | Reporting | 1 | 4 |
| `comparative_analytics` | 12 | Comparisons | 1 | 4 |
| `predictive_analytics` | 15 | ML predictions | 2 | 8 |
| `question_generation_logs` | 12 | Gen tracking | 1 | 4 |
| `usage_tracking` | 10 | Platform usage | 1 | 4 |
| `generated_reports` | 15 | Report storage | 1 | 4 |

#### Admin & Configuration Tables (25 tables) - **18 SP | 72 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `platform_configurations` | 10 | System config | 1 | 4 |
| `system_config` | 8 | Global settings | 1 | 4 |
| `email_templates` | 15 | Email config | 1 | 4 |
| `email_logs` | 12 | Email tracking | 1 | 4 |
| `email_verification_tokens` | 8 | Auth tokens | 1 | 4 |
| `password_setup_invitations` | 10 | User setup | 1 | 4 |
| `notifications` | 15 | In-app notifications | 1 | 4 |
| `chatbot_knowledge` | 18 | Chatbot training | 2 | 8 |
| `admin_chat_context` | 10 | Admin chat | 1 | 4 |
| `admin_saved_queries` | 12 | Query library | 1 | 4 |
| `audit_logs` | 15 | Security audit | 1 | 4 |
| `security_events` | 12 | Security | 1 | 4 |
| `security_event_logs` | 10 | Event logs | 1 | 4 |
| `role_permissions` | 8 | RBAC | 1 | 4 |
| `custom_roles` | 12 | Custom RBAC | 1 | 4 |
| `user_custom_roles` | 5 | Junction | 1 | 4 |
| `documentation` | 15 | Docs | 1 | 4 |
| `platform_documentation` | 18 | Platform docs | 1 | 4 |
| `platform_documentation_versions` | 12 | Versioning | 1 | 4 |
| `architecture_documents` | 15 | Diagrams | 1 | 4 |
| `report_templates` | 12 | Reporting | 1 | 4 |
| `approval_workflows` | 15 | Workflow engine | 1 | 4 |
| `collaboration_threads` | 12 | Comments | 1 | 4 |
| `activity_feed` | 10 | Activity stream | 1 | 4 |
| `onboarding_progress` | 12 | User onboarding | 1 | 4 |

#### System & Infrastructure Tables (18 tables) - **12 SP | 48 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `failed_jobs` | 15 | Job queue | 1 | 4 |
| `evaluation_queue` | 12 | Async processing | 1 | 4 |
| `evaluation_queue_logs` | 10 | Queue logs | 1 | 4 |
| `cron_execution_logs` | 12 | Cron jobs | 1 | 4 |
| `circuit_breaker_state` | 15 | Resilience | 1 | 4 |
| `rate_limit_buckets` | 10 | Rate limiting | 1 | 4 |
| `idempotency_keys` | 8 | Deduplication | 1 | 4 |
| `test_suites` | 15 | Testing | 1 | 4 |
| `test_runs` | 12 | Test execution | 1 | 4 |
| `test_results` | 15 | Test output | 1 | 4 |
| `export_job_logs` | 12 | Data export | 1 | 4 |
| `data_deletion_requests` | 10 | GDPR | 1 | 4 |
| `data_retention_policies` | 12 | Compliance | 1 | 4 |
| `user_session_logs` | 10 | Session tracking | 1 | 4 |
| `user_portal_preferences` | 8 | UI preferences | 0.5 | 2 |
| `user_topic_progress` | 10 | Progress | 0.5 | 2 |
| `training_plans` | 12 | Training | 1 | 4 |
| `training_topics` | 10 | Topics | 0.5 | 2 |
| `user_training_assignments` | 8 | Assignments | 0.5 | 2 |

#### Payment & Billing Tables (12 tables) - **14 SP | 56 hrs**

| Table | Columns | Relationships | SP | Hours |
|-------|---------|---------------|-----|-------|
| `payment_gateways` | 15 | Gateway config | 2 | 8 |
| `payment_methods` | 12 | User payment | 1 | 4 |
| `payment_transactions` | 20 | Transactions | 2 | 8 |
| `promotions` | 18 | Discounts | 2 | 8 |
| `promotion_usages` | 10 | Usage tracking | 1 | 4 |
| `promotion_applicable_orgs` | 5 | Targeting | 1 | 4 |
| `promotion_applicable_plans` | 5 | Targeting | 1 | 4 |
| `ats_integrations` | 18 | ATS connect | 2 | 8 |
| `ats_candidates` | 20 | ATS sync | 2 | 8 |
| `ats_sync_logs` | 12 | Sync logs | 1 | 4 |

### 2.3 Database Functions (121 Functions) - **15 SP | 60 hrs**

| Category | Count | SP | Hours |
|----------|-------|-----|-------|
| Helper Functions | 25 | 3 | 12 |
| Trigger Functions | 35 | 5 | 20 |
| RLS Helper Functions | 20 | 3 | 12 |
| Aggregation Functions | 15 | 2 | 8 |
| Utility Functions | 26 | 2 | 8 |

### 2.4 RLS Policies (393 Policies) - **25 SP | 100 hrs**

| Category | Count | SP | Hours |
|----------|-------|-----|-------|
| Organization-based RLS | 120 | 8 | 32 |
| User-based RLS | 100 | 6 | 24 |
| Role-based RLS | 90 | 6 | 24 |
| Public Access Policies | 40 | 3 | 12 |
| Admin Override Policies | 43 | 2 | 8 |

### 2.5 Data Migration - **8 SP | 32 hrs**

| Task | Description | SP | Hours |
|------|-------------|-----|-------|
| Export Scripts | Python/Node data export | 3 | 12 |
| Transform Scripts | Data normalization | 2 | 8 |
| Import Scripts | Bulk loading | 2 | 8 |
| Verification | Data integrity checks | 1 | 4 |

**Phase 2 Total: 89 SP | 356 hours**

---

## ⚙️ Phase 3: Backend Services Migration

### 3.1 Authentication Service (Replacing Supabase Auth)

| Component | Description | SP | Hours | Complexity |
|-----------|-------------|-----|-------|------------|
| Cognito User Pool | User management | 5 | 20 | High |
| JWT Token Handler | Token validation middleware | 3 | 12 | Medium |
| OAuth2 Flows | Login, signup, refresh | 5 | 20 | High |
| Password Reset | Reset flow implementation | 3 | 12 | Medium |
| Email Verification | Token-based verification | 3 | 12 | Medium |
| Session Management | Redis-based sessions | 3 | 12 | Medium |
| Social Auth (Optional) | Google/LinkedIn OAuth | 5 | 20 | High |
| **Subtotal** | | **27** | **108** | |

### 3.2 Edge Functions → Lambda/ECS Services (101 Functions)

#### Core Interview Functions (18 functions) - **24 SP | 96 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `resolve-invitation` | Token resolution | 2 | 8 |
| `resolve-slug-invitation` | Slug-based resolution | 2 | 8 |
| `send-interview-invitations` | Email dispatch | 2 | 8 |
| `generate-questions` | AI question generation | 3 | 12 |
| `regenerate-questions` | Question regeneration | 2 | 8 |
| `regenerate-single-question` | Single question | 1 | 4 |
| `batch-regenerate-questions` | Bulk regeneration | 2 | 8 |
| `add-questions` | Manual question add | 1 | 4 |
| `approve-questions` | Question approval | 1 | 4 |
| `bulk-approve-questions` | Bulk approval | 1 | 4 |
| `get-approved-questions` | Fetch approved | 1 | 4 |
| `delete-interview` | Interview deletion | 1 | 4 |
| `schedule-interview` | Scheduling | 1 | 4 |
| `reassign-invitation-questions` | Question reassign | 1 | 4 |
| `reassign-all-invitation-questions` | Bulk reassign | 1 | 4 |
| `fix-pending-invitations` | Data fix | 1 | 4 |
| `create-from-template` | Template usage | 1 | 4 |
| `send-invitation-reminders` | Reminder emails | 1 | 4 |

#### Evaluation & Assessment Functions (12 functions) - **18 SP | 72 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `evaluate-interview` | AI evaluation | 3 | 12 |
| `evaluate-certification` | Cert evaluation | 2 | 8 |
| `evaluate-learning-assessment` | Learning eval | 2 | 8 |
| `process-evaluation-queue` | Queue processor | 3 | 12 |
| `auto-evaluate-trigger` | Auto trigger | 1 | 4 |
| `calculate-cpi` | CPI calculation | 2 | 8 |
| `detect-bias` | Bias detection | 2 | 8 |
| `refine-assessment-feedback` | Feedback AI | 1 | 4 |
| `generate-certificate-pdf` | PDF generation | 2 | 8 |
| `generate-comparative-report` | Comparisons | 1 | 4 |
| `generate-custom-report` | Custom reports | 1 | 4 |
| `generate-predictive-analytics` | ML predictions | 2 | 8 |

#### Proctoring Functions (14 functions) - **21 SP | 84 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `init-proctoring-session` | Session init | 2 | 8 |
| `update-proctoring-session` | Session update | 1 | 4 |
| `get-chunk-upload-url` | Signed URL gen | 2 | 8 |
| `get-proctoring-upload-url` | Upload URL | 2 | 8 |
| `upload-proctoring-chunk` | Chunk upload | 2 | 8 |
| `upload-proctoring-recording` | Recording upload | 2 | 8 |
| `upload-proctoring-screenshot` | Screenshot upload | 1 | 4 |
| `confirm-proctoring-upload` | Upload confirm | 1 | 4 |
| `merge-proctoring-chunks` | Video merge | 3 | 12 |
| `repair-webm-metadata` | WebM fix | 2 | 8 |
| `analyze-proctoring-video` | Video analysis | 2 | 8 |
| `analyze-violations` | Violation analysis | 1 | 4 |
| `log-proctoring-violation` | Violation logging | 1 | 4 |
| `cleanup-proctoring-chunks` | Chunk cleanup | 1 | 4 |

#### Email & Notification Functions (10 functions) - **12 SP | 48 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `send-email` | Generic email | 2 | 8 |
| `resend-email` | Email resend | 1 | 4 |
| `send-notification` | Push notifications | 2 | 8 |
| `send-review-request` | Review emails | 1 | 4 |
| `send-password-setup` | Password setup | 1 | 4 |
| `send-verification-email` | Verification | 1 | 4 |
| `auth-email-hook` | Auth email trigger | 2 | 8 |
| `enhance-email-content` | AI email enhance | 1 | 4 |
| `verify-email-token` | Token verify | 1 | 4 |

#### AI & Generation Functions (15 functions) - **20 SP | 80 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `generate-job-description` | JD generation | 2 | 8 |
| `enhance-job-description` | JD enhancement | 1 | 4 |
| `suggest-jd-content` | JD suggestions | 1 | 4 |
| `extract-skills` | Skill extraction | 2 | 8 |
| `parse-resume` | Resume parsing | 2 | 8 |
| `generate-certification-questions` | Cert questions | 2 | 8 |
| `generate-learning-questions` | Learning questions | 2 | 8 |
| `generate-training-plan` | Training plan | 1 | 4 |
| `chatbot-assist` | Chatbot AI | 3 | 12 |
| `enhance-content-with-ai` | Content AI | 1 | 4 |
| `test-ai-connection` | AI health check | 1 | 4 |
| `ai-health-monitor` | AI monitoring | 1 | 4 |
| `update-ai-feature-model` | Model update | 1 | 4 |
| `scan-ai-features` | Feature scan | 1 | 4 |
| `admin-log-analysis` | Log analysis AI | 2 | 8 |

#### Admin & Management Functions (15 functions) - **15 SP | 60 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `admin-user-management` | User CRUD | 2 | 8 |
| `manage-organization-user` | Org user mgmt | 1 | 4 |
| `delete-organization` | Org deletion | 2 | 8 |
| `approve-partner-application` | Partner approval | 1 | 4 |
| `complete-user-signup` | Signup complete | 1 | 4 |
| `complete-password-setup` | Password setup | 1 | 4 |
| `manage-scheduled-jobs` | Job management | 2 | 8 |
| `enforce-interview-deadlines` | Deadline cron | 1 | 4 |
| `scheduled-data-cleanup` | Data cleanup | 1 | 4 |
| `cleanup-stale-proctoring` | Stale cleanup | 1 | 4 |
| `cleanup-stuck-generations` | Gen cleanup | 1 | 4 |
| `auto-close-sessions` | Session close | 1 | 4 |
| `cleanup-all-except-admins` | User cleanup | 1 | 4 |
| `cleanup-test-data` | Test cleanup | 1 | 4 |

#### Documentation & Testing Functions (10 functions) - **10 SP | 40 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `generate-documentation` | Docs gen | 1 | 4 |
| `generate-documentation-from-code` | Code docs | 2 | 8 |
| `improve-documentation-format` | Format improve | 1 | 4 |
| `update-architecture-diagram` | Diagram update | 1 | 4 |
| `generate-architecture-docs` | Arch docs | 1 | 4 |
| `run-tests` | Test runner | 2 | 8 |
| `run-flow-tests` | Flow tests | 1 | 4 |
| `run-comprehensive-flow-test` | Full tests | 1 | 4 |
| `auto-fix-issue` | Auto fix | 1 | 4 |
| `analyze-test-error` | Error analysis | 1 | 4 |

#### Integration & Utility Functions (12 functions) - **11 SP | 44 hrs**

| Function | Purpose | SP | Hours |
|----------|---------|-----|-------|
| `ats-webhook` | ATS integration | 2 | 8 |
| `sync-ats-candidates` | ATS sync | 2 | 8 |
| `generate-invoice` | Invoice gen | 2 | 8 |
| `generate-schema` | Schema gen | 1 | 4 |
| `check-assessment-limit` | Limit check | 1 | 4 |
| `check-file-changes` | File monitoring | 1 | 4 |
| `test-configuration` | Config test | 1 | 4 |
| `validate-test-data` | Data validation | 1 | 4 |
| `seed-test-data` | Test seeding | 1 | 4 |
| `seed-flow-data` | Flow seeding | 1 | 4 |
| `submit-for-review` | Review submit | 1 | 4 |
| `scan-platform-features` | Feature scan | 1 | 4 |

### 3.3 Storage Service (S3)

| Task | Description | SP | Hours |
|------|-------------|-----|-------|
| S3 Bucket Setup | Recordings, documents | 3 | 12 |
| Presigned URL Service | Upload/download URLs | 3 | 12 |
| Lifecycle Policies | Retention, archival | 2 | 8 |
| CloudFront Integration | CDN for assets | 2 | 8 |
| **Subtotal** | | **10** | **40** |

### 3.4 Queue & Event Processing

| Task | Description | SP | Hours |
|------|-------------|-----|-------|
| SQS Queue Setup | Evaluation queue | 3 | 12 |
| Lambda Consumers | Queue processors | 3 | 12 |
| Dead Letter Queue | Failed job handling | 2 | 8 |
| EventBridge Rules | Event routing | 2 | 8 |
| **Subtotal** | | **10** | **40** |

**Phase 3 Total: 134 SP | 536 hours**

---

## 🖥️ Phase 4: Frontend Migration

### 4.1 Framework Setup

| Task | Description | SP | Hours |
|------|-------------|-----|-------|
| Vite to Next.js Migration (Optional) | SSR setup | 8 | 32 |
| Or: Keep Vite + Docker | Container setup | 3 | 12 |
| Environment Configuration | AWS endpoints | 2 | 8 |
| Auth Client Update | Cognito SDK | 5 | 20 |
| API Client Refactor | Supabase → REST/GraphQL | 8 | 32 |
| **Subtotal** | | **18** | **72** |

### 4.2 Pages Migration (89 Pages)

#### Authentication & Onboarding (8 pages) - **8 SP | 32 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `Auth.tsx` | High | 2 | 8 |
| `AuthVerify.tsx` | Medium | 1 | 4 |
| `VerifyEmail.tsx` | Low | 0.5 | 2 |
| `ResetPassword.tsx` | Medium | 1 | 4 |
| `ResetPasswordConfirm.tsx` | Medium | 1 | 4 |
| `PartnerOnboarding.tsx` | High | 2 | 8 |
| `PaymentSetup.tsx` | Medium | 1 | 4 |
| `Profile.tsx` | Medium | 1 | 4 |

#### Dashboard & Portal Pages (12 pages) - **14 SP | 56 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `Landing.tsx` | High | 2 | 8 |
| `Dashboard.tsx` | High | 2 | 8 |
| `UnifiedDashboard.tsx` | High | 2 | 8 |
| `PlatformAdminHub.tsx` | High | 2 | 8 |
| `PartnerPortal.tsx` | High | 2 | 8 |
| `Pricing.tsx` | Medium | 1 | 4 |
| `LearningPricing.tsx` | Medium | 1 | 4 |
| `Settings.tsx` | Medium | 1 | 4 |
| `Notifications.tsx` | Low | 0.5 | 2 |
| `NotFound.tsx` | Low | 0.5 | 2 |
| `RoleBasedRedirect.tsx` | Low | 0.5 | 2 |
| `MyApplications.tsx` | Medium | 1 | 4 |

#### Interview Management (15 pages) - **18 SP | 72 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `CreateInterview.tsx` | High | 2 | 8 |
| `JDBuilderWizard.tsx` | Very High | 3 | 12 |
| `QuickCreatePreview.tsx` | High | 2 | 8 |
| `InterviewDetail.tsx` | High | 2 | 8 |
| `InterviewQuestionsPreview.tsx` | Medium | 1 | 4 |
| `InterviewProgress.tsx` | Medium | 1 | 4 |
| `InterviewGenerationProgressPage.tsx` | Medium | 1 | 4 |
| `TakeInterview.tsx` | Very High | 3 | 12 |
| `InterviewComplete.tsx` | Low | 0.5 | 2 |
| `AssessmentReport.tsx` | High | 2 | 8 |
| `PendingReviews.tsx` | Medium | 1 | 4 |
| `QuestionRepository.tsx` | High | 2 | 8 |
| `TemplatesLibrary.tsx` | Medium | 1 | 4 |
| `ReportBuilder.tsx` | High | 2 | 8 |
| `InterviewOperationLogs.tsx` | Medium | 1 | 4 |

#### Proctoring Pages (4 pages) - **8 SP | 32 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `ProctoringDashboard.tsx` | Very High | 3 | 12 |
| `ProctoringSettings.tsx` | High | 2 | 8 |
| `ProctoringTestPage.tsx` | High | 2 | 8 |
| `PreInterviewCheckLogs.tsx` | Medium | 1 | 4 |

#### Learning & Certification (16 pages) - **18 SP | 72 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `LearningDashboard.tsx` | High | 2 | 8 |
| `Certifications.tsx` | High | 2 | 8 |
| `TakeCertification.tsx` | Very High | 3 | 12 |
| `TakeLearningAssessment.tsx` | Very High | 3 | 12 |
| `CertificationResult.tsx` | Medium | 1 | 4 |
| `MyCertificates.tsx` | Medium | 1 | 4 |
| `VerifyCertificate.tsx` | Low | 0.5 | 2 |
| `LearningProgress.tsx` | Medium | 1 | 4 |
| `LearningFeedback.tsx` | Medium | 1 | 4 |
| `LearningHistory.tsx` | Medium | 1 | 4 |
| `MyLearningPlan.tsx` | Medium | 1 | 4 |
| `PracticeAssessmentConfiguration.tsx` | Medium | 1 | 4 |
| `CertificationAdmin.tsx` | High | 2 | 8 |
| `CertificationAnalytics.tsx` | Medium | 1 | 4 |
| `CertificationConfiguration.tsx` | Medium | 1 | 4 |
| `PlatformAdminLearning.tsx` | Medium | 1 | 4 |

#### Admin Pages (22 pages) - **24 SP | 96 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `OrganizationsList.tsx` | High | 2 | 8 |
| `OrganizationManagement.tsx` | High | 2 | 8 |
| `OrganizationSettings.tsx` | Medium | 1 | 4 |
| `OrganizationAnalytics.tsx` | High | 2 | 8 |
| `OrganizationUserManagement.tsx` | High | 2 | 8 |
| `UnifiedUserManagement.tsx` | High | 2 | 8 |
| `RoleAssignment.tsx` | Medium | 1 | 4 |
| `RolePermissionsManagement.tsx` | High | 2 | 8 |
| `BillingManagement.tsx` | High | 2 | 8 |
| `PartnerBilling.tsx` | Medium | 1 | 4 |
| `PlanManagement.tsx` | Medium | 1 | 4 |
| `PromotionManagement.tsx` | Medium | 1 | 4 |
| `AIConfiguration.tsx` | High | 2 | 8 |
| `EmailConfiguration.tsx` | Medium | 1 | 4 |
| `ChatbotManagement.tsx` | Medium | 1 | 4 |
| `ChatbotTraining.tsx` | Medium | 1 | 4 |
| `AdvancedAnalytics.tsx` | High | 2 | 8 |
| `PartnerReports.tsx` | Medium | 1 | 4 |
| `PartnerCostMonitoring.tsx` | Medium | 1 | 4 |
| `PartnerApplicationsReview.tsx` | Medium | 1 | 4 |
| `PaymentGatewayManagement.tsx` | Medium | 1 | 4 |
| `LearningPlanManagement.tsx` | Medium | 1 | 4 |

#### Testing & DevOps Pages (8 pages) - **8 SP | 32 hrs**

| Page | Complexity | SP | Hours |
|------|------------|-----|-------|
| `TestingHub.tsx` | High | 2 | 8 |
| `AutomatedTestSuite.tsx` | Medium | 1 | 4 |
| `PerformanceBenchmark.tsx` | Medium | 1 | 4 |
| `DeploymentConfigurator.tsx` | Medium | 1 | 4 |
| `DeploymentDashboard.tsx` | Medium | 1 | 4 |
| `DeploymentHistory.tsx` | Low | 0.5 | 2 |
| `ArchitectureDocs.tsx` | Medium | 1 | 4 |
| `Documentation.tsx` | Low | 0.5 | 2 |
| `DocumentationGenerator.tsx` | Medium | 1 | 4 |

### 4.3 Components Migration (148 Components)

#### UI Components (51 components) - **10 SP | 40 hrs**
*Keep as-is, shadcn/ui compatible*

| Category | Count | SP | Hours |
|----------|-------|-----|-------|
| Form Controls | 15 | 2 | 8 |
| Layout Components | 12 | 2 | 8 |
| Feedback Components | 10 | 2 | 8 |
| Navigation Components | 8 | 2 | 8 |
| Data Display | 6 | 2 | 8 |

#### Business Components (97 components) - **35 SP | 140 hrs**

| Category | Count | SP | Hours |
|----------|-------|-----|-------|
| Interview Components | 12 | 5 | 20 |
| Proctoring Components | 13 | 6 | 24 |
| Assessment Components | 8 | 4 | 16 |
| Reports Components | 6 | 3 | 12 |
| Partner Components | 5 | 2 | 8 |
| Admin Components | 10 | 4 | 16 |
| JD Builder Components | 8 | 3 | 12 |
| Shared Components | 12 | 4 | 16 |
| Layout Components | 8 | 2 | 8 |
| Utility Components | 15 | 2 | 8 |

### 4.4 Hooks & Context Migration (28 items) - **14 SP | 56 hrs**

| Hook/Context | Complexity | SP | Hours |
|--------------|------------|-----|-------|
| `AuthContext.tsx` | High | 3 | 12 |
| `OrganizationContext.tsx` | Medium | 2 | 8 |
| `ProctoringContext.tsx` | High | 3 | 12 |
| `useProctoring.ts` | High | 2 | 8 |
| `useProctoringSession.ts` | High | 2 | 8 |
| `useChunkUploader.ts` | Medium | 1 | 4 |
| `usePermissions.ts` | Medium | 1 | 4 |
| `useUserRoles.ts` | Low | 0.5 | 2 |
| Other hooks (17) | Low-Medium | 3 | 12 |

### 4.5 Utilities & Libraries Migration (37 files) - **8 SP | 32 hrs**

| Category | Files | SP | Hours |
|----------|-------|-----|-------|
| API Utilities | 5 | 2 | 8 |
| Proctoring Utilities | 8 | 2 | 8 |
| Validation Utilities | 6 | 1 | 4 |
| Format Utilities | 8 | 1 | 4 |
| Error Handling | 5 | 1 | 4 |
| Logging | 5 | 1 | 4 |

**Phase 4 Total: 98 SP | 392 hours**

---

## 🧪 Phase 5: Testing & Quality Assurance

### 5.1 Unit Testing

| Area | Test Cases | SP | Hours |
|------|------------|-----|-------|
| Backend Services | 300+ | 15 | 60 |
| Frontend Components | 200+ | 10 | 40 |
| Utilities & Helpers | 100+ | 5 | 20 |
| **Subtotal** | | **30** | **120** |

### 5.2 Integration Testing

| Area | Test Cases | SP | Hours |
|------|------------|-----|-------|
| API Endpoints | 150+ | 10 | 40 |
| Database Operations | 100+ | 8 | 32 |
| Auth Flows | 30+ | 5 | 20 |
| **Subtotal** | | **23** | **92** |

### 5.3 End-to-End Testing

| Flow | Test Scenarios | SP | Hours |
|------|----------------|-----|-------|
| Interview Creation Flow | 20 | 3 | 12 |
| Candidate Assessment Flow | 25 | 4 | 16 |
| Proctoring Flow | 15 | 3 | 12 |
| Learning/Certification Flow | 20 | 3 | 12 |
| Admin Operations | 15 | 2 | 8 |
| **Subtotal** | | **15** | **60** |

### 5.4 Performance & Load Testing

| Test Type | SP | Hours |
|-----------|-----|-------|
| Load Testing | 3 | 12 |
| Stress Testing | 2 | 8 |
| Endurance Testing | 2 | 8 |

**Phase 5 Total: 65 SP | 260 hours**

---

## 🚀 Phase 6: Deployment & Cutover

### 6.1 Staging Deployment

| Task | SP | Hours |
|------|-----|-------|
| Staging Environment Setup | 5 | 20 |
| Data Migration Dry Run | 3 | 12 |
| Full System Testing | 5 | 20 |
| Performance Validation | 3 | 12 |
| **Subtotal** | **16** | **64** |

### 6.2 Production Deployment

| Task | SP | Hours |
|------|-----|-------|
| Production Infrastructure | 5 | 20 |
| DNS Cutover Planning | 2 | 8 |
| Data Migration (Final) | 3 | 12 |
| Rollback Procedures | 2 | 8 |
| **Subtotal** | **12** | **48** |

### 6.3 Post-Deployment

| Task | SP | Hours |
|------|-----|-------|
| Monitoring Setup | 3 | 12 |
| Documentation | 2 | 8 |
| Team Training | 2 | 8 |
| **Subtotal** | **6** | **24** |

**Phase 6 Total: 34 SP | 136 hours**

---

## 📋 Complete Inventory Summary

### Database Objects

| Type | Count |
|------|-------|
| Tables | 122 |
| RLS Policies | 393 |
| Database Functions | 121 |
| Triggers | ~80 |
| Indexes | ~200 |
| Foreign Keys | ~150 |

### Backend Services

| Type | Count |
|------|-------|
| Edge Functions (→ Lambda) | 101 |
| Scheduled Jobs | 8 |
| Webhooks | 3 |
| Storage Buckets | 4 |

### Frontend Assets

| Type | Count |
|------|-------|
| Pages | 89 |
| Components | 148 |
| Hooks | 25 |
| Contexts | 3 |
| Utility Libraries | 37 |
| CSS/Style Files | 5 |

---

## 💰 Cost Comparison

### Current (Supabase/Lovable)

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| Edge Functions | Usage-based |
| Storage | Usage-based |
| **Estimated Total** | **$50-200/mo** |

### AWS Self-Hosted (Medium Tier)

| Service | Monthly Cost |
|---------|-------------|
| RDS PostgreSQL (db.t3.medium) | $70 |
| ECS Fargate (2 tasks) | $100 |
| Lambda (1M invocations) | $20 |
| S3 (100GB) | $3 |
| CloudFront | $50 |
| ALB | $20 |
| Route 53 | $5 |
| Secrets Manager | $5 |
| CloudWatch | $30 |
| **Estimated Total** | **$300-600/mo** |

---

## 👥 Recommended Team Composition

| Role | Count | Duration |
|------|-------|----------|
| DevOps/Infrastructure Engineer | 2 | Full project |
| Backend Developer (Node.js/Python) | 3 | Phase 2-5 |
| Frontend Developer (React) | 3 | Phase 4-5 |
| QA Engineer | 2 | Phase 5-6 |
| Project Manager | 1 | Full project |
| **Total Team Size** | **11** | |

---

## ⚠️ Risk Factors

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data migration issues | High | Multiple dry runs, rollback plan |
| Auth system differences | High | Thorough testing, parallel running |
| Proctoring performance | Medium | Load testing, CDN optimization |
| AI service integration | Medium | API abstraction layer |
| Cost overruns | Medium | Phased approach, regular reviews |

---

## 📅 Recommended Timeline

| Phase | Duration | Parallel Activities |
|-------|----------|---------------------|
| Phase 1: Infrastructure | Weeks 1-3 | - |
| Phase 2: Database | Weeks 2-5 | Overlaps with Phase 1 |
| Phase 3: Backend | Weeks 4-9 | - |
| Phase 4: Frontend | Weeks 6-10 | Overlaps with Phase 3 |
| Phase 5: Testing | Weeks 9-12 | Overlaps with Phase 4 |
| Phase 6: Deployment | Weeks 13-14 | - |
| Buffer & Contingency | Weeks 15-16 | - |

**Total Duration: 16-20 weeks**

---

*Document generated from TalentGeenie Platform codebase analysis*  
*For questions, contact the development team*
