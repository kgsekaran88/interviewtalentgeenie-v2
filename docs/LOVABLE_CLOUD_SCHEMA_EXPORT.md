# Lovable Cloud Schema Export Guide

## Why You Need This

The production migration scripts were manually created and can drift from the actual Lovable Cloud database. This guide shows you how to export the **exact** schema from Lovable Cloud to use in production.

## Method 1: Use Supabase Dashboard (Recommended)

Since you have access to your production Supabase dashboard:

1. Go to your **Production Supabase Dashboard**
2. Navigate to **Settings → Database**
3. Click **Download backup** to get a full dump

Or use SQL Editor to export:

```sql
-- This generates CREATE TABLE statements for all tables
SELECT 
  'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' AS SELECT * FROM ' || schemaname || '.' || tablename || ' WHERE 1=0;'
FROM pg_tables 
WHERE schemaname = 'public';
```

## Method 2: Connect to Lovable Cloud and Export

Use `pg_dump` with your Lovable Cloud credentials:

```bash
# Get connection string from Lovable Cloud settings
pg_dump --schema-only --no-owner --no-privileges \
  "postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres" \
  > lovable_cloud_schema.sql
```

## Current Schema Summary (from Lovable Cloud)

### Tables (103 total)

| Category | Tables |
|----------|--------|
| **AI/ML** | ai_coach_sessions, ai_feature_alerts, ai_feature_configurations, ai_feature_health, ai_health_alerts, ai_health_checks, ai_health_monitoring, ai_model_configurations, ai_model_performance, ai_provider_credentials, ai_providers, ai_usage_logs |
| **Analytics** | analytics_snapshots, comparative_analytics, predictive_analytics |
| **ATS** | ats_candidates, ats_integrations, ats_sync_logs |
| **Billing** | invoices, payment_gateways, payment_methods, payment_transactions, promotion_applicable_orgs, promotion_applicable_plans, promotion_usages, promotions, subscription_plans |
| **Certifications** | certificate_badges, certificates, certification_assessments, certification_attempts, certification_global_config, certification_topics |
| **Interviews** | interview_attempts, interview_invitations, interview_operation_logs, interview_panel_members, interview_schedules, interview_templates, interviews, questions, attempt_questions |
| **Learning** | learning_assessment_attempts, learning_assessment_feedback, learning_assessment_questions, learning_assessment_usage, learning_assessments, learning_materials, learning_payments, learning_plans, learning_subscriptions |
| **Organizations** | organization_members, organization_subscriptions, organizations, partner_applications |
| **Proctoring** | proctoring_sessions, proctoring_settings, proctoring_violations, preinterview_check_logs |
| **Security** | audit_logs, consent_records, data_deletion_requests, data_retention_policies, security_events |
| **System** | circuit_breaker_state, failed_jobs, idempotency_keys, platform_configurations, rate_limit_buckets, system_config |
| **Users** | profiles, user_roles, user_custom_roles, custom_roles, role_permissions, user_badges, onboarding_progress |
| **Other** | activity_feed, approval_workflows, architecture_documents, assessments, bias_detection_results, candidate_performance_index, chatbot_knowledge, collaboration_threads, documentation, email_logs, email_templates, generated_reports, notifications, password_setup_invitations, platform_documentation, platform_documentation_versions, report_templates, resume_parsing_results, test_results, test_runs, test_suites, training_plans, training_topics, usage_tracking, user_topic_progress, user_training_assignments |

### Enum Types

```sql
CREATE TYPE app_role AS ENUM (
  'admin',
  'hr', 
  'interviewer',
  'contributor',
  'candidate',
  'guest',
  'platform_admin',
  'partner_admin',
  'hr_recruiter',
  'ta_creator',
  'billing_contact',
  'tech_spoc'
);
```

### Storage Buckets

| Bucket | Public | Allowed Types | Size Limit |
|--------|--------|---------------|------------|
| certificates | Yes | PDF, PNG, JPEG | 10MB |
| consent-documents | No | PDF, PNG, JPEG | 10MB |
| documentation | No | PDF | 10MB |
| proctoring-recordings | No | All | Unlimited |

### Key Helper Functions

All functions are defined in the database with `SECURITY DEFINER` and `search_path = 'public'`:

- `has_role(_user_id, _role)` - Check if user has specific role
- `has_any_role(_user_id, _roles[])` - Check if user has any of the roles
- `has_any_role_with_hierarchy(_user_id, _roles[])` - Check roles with hierarchy
- `user_is_org_member(_user_id, _org_id)` - Check org membership
- `user_is_org_admin(_user_id, _org_id)` - Check org admin status
- `can_access_org_data(_user_id, _org_id)` - Check data access permission
- `generate_slug(text)` - Generate URL-friendly slugs
- `generate_certificate_number()` - Generate unique cert numbers
- `generate_invoice_number()` - Generate sequential invoice numbers
- `calculate_cpi_score(technical, problem_solving, integrity)` - Calculate CPI

## Next Steps

1. Export the schema from Lovable Cloud using Method 1 or 2
2. Compare with your production database
3. Apply missing objects to production

The exported schema will be the **definitive source of truth** since it comes directly from the running system.
