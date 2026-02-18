# Complete Configuration Guide

## Overview
This document lists ALL configurations needed for the Interview AI Platform, categorized by where they should be managed and when they're needed.

---

## 📋 Configuration Categories

### 1. **Platform Settings** (UI-Configurable in Admin Dashboard)
*Location: Platform Settings page → Database table `platform_config`*

| Configuration | Current Status | Category | Description |
|---------------|----------------|----------|-------------|
| AI Default Model | ✅ Configured | AI | Primary AI model for evaluations |
| AI Fallback Model | ✅ Configured | AI | Backup model if primary fails |
| Difficulty Easy % | ✅ Configured | Difficulty | Percentage of easy questions (default: 30%) |
| Difficulty Medium % | ✅ Configured | Difficulty | Percentage of medium questions (default: 50%) |
| Difficulty Hard % | ✅ Configured | Difficulty | Percentage of hard questions (default: 20%) |
| CPI Technical Weight | ✅ Configured | CPI | Weight for technical score (default: 40%) |
| CPI Problem Solving Weight | ✅ Configured | CPI | Weight for problem-solving (default: 30%) |
| CPI Integrity Weight | ✅ Configured | CPI | Weight for integrity score (default: 30%) |
| Recording Retention Days | ✅ Configured | Retention | Days to keep proctoring videos (default: 90) |
| Max Interview Duration | ✅ Configured | General | Maximum minutes per interview |
| Email Provider API Key | ✅ Configured | Email | Resend API key |
| Email From Address | ✅ Configured | Email | Sender email (e.g., noreply@domain.com) |
| Email From Name | ✅ Configured | Email | Sender display name |
| Password Link Expiry | ✅ Configured | Email | Hours before password setup link expires |

**Access:** Platform Admin only via `/platform-settings`

---

### 2. **Secrets** (Sensitive Keys via Lovable Cloud Secrets)
*Location: Lovable Cloud → Project Settings → Secrets*
*Used in: Edge Functions (backend only)*

| Secret Name | Purpose | Required For | Current Status |
|-------------|---------|--------------|----------------|
| GOOGLE_GEMINI_API_KEY | Google AI API | AI evaluations, question generation | ✅ Set |
| LOVABLE_API_KEY | Lovable AI API | AI features without external API | ✅ Set (Auto) |
| SUPABASE_URL | Database URL | All backend operations | ✅ Auto-set |
| SUPABASE_ANON_KEY | Public API key | Frontend database calls | ✅ Auto-set |
| SUPABASE_SERVICE_ROLE_KEY | Admin API key | Backend privileged operations | ✅ Auto-set |
| RESEND_API_KEY | Auth & Application emails | Email delivery (auth-email-hook) | ⚠️ Required |
| STRIPE_SECRET_KEY | Payment processing | Subscription billing | ❌ Not set |
| STRIPE_WEBHOOK_SECRET | Payment webhooks | Stripe event verification | ❌ Not set |

**Access:** Platform Admin via Lovable Cloud dashboard  
**Security:** Never exposed to frontend, only available in edge functions

---

### 2.1 **Auth Email Templates** (Database-Stored)
*Location: `email_templates` table → Editable via Email Template Editor*

| Template Key | Purpose | Variables |
|--------------|---------|-----------|
| auth_email_verification | Email verification on signup | platform_name, user_name, verify_url |
| auth_password_recovery | Password reset emails | platform_name, user_name, verify_url |
| auth_magic_link | Magic link login emails | platform_name, user_name, verify_url, email |
| auth_invite | User invitation emails | platform_name, user_name, verify_url |
| auth_email_change | Email change confirmation | platform_name, user_name, verify_url, email |

**How It Works:**
- The `auth-email-hook` edge function intercepts Supabase auth events
- Fetches the appropriate template from the database
- Replaces variables with actual values
- Sends branded email via Resend API
- Falls back to built-in templates if database template not found

**Access:** Platform Admin via Email Template Editor  
**Customization:** Full HTML editing, AI enhancement, preview available

---

### 3. **Environment Variables** (Frontend - Auto-managed by Lovable)
*Location: `.env` file (auto-generated, don't edit manually)*

| Variable | Purpose | Auto-Managed |
|----------|---------|--------------|
| VITE_SUPABASE_URL | Frontend Supabase endpoint | ✅ Yes |
| VITE_SUPABASE_PUBLISHABLE_KEY | Frontend API key | ✅ Yes |
| VITE_SUPABASE_PROJECT_ID | Project identifier | ✅ Yes |

**⚠️ WARNING:** These are auto-managed by Lovable Cloud. Do NOT edit manually.

---

### 4. **Database Configuration** (Managed via Migrations)
*Location: Supabase → Database migrations*

| Configuration Type | Examples | Managed By |
|--------------------|----------|------------|
| Row-Level Security (RLS) Policies | Access control per table | Database migrations |
| Database Functions | Custom SQL functions | Database migrations |
| Triggers | Auto-actions on data changes | Database migrations |
| Indexes | Query performance optimization | Database migrations |
| Table Schemas | Data structure definitions | Database migrations |

**Access:** Platform Admin via database migrations  
**Changes:** Must be done through migration tool

---

### 5. **Organization-Level Settings** (Per Organization)
*Location: Organization Settings pages + Database tables*

| Configuration | Table/Location | Scope |
|---------------|----------------|-------|
| Subscription Plans | `subscription_plans` | Platform-wide templates |
| Organization Subscription | `organization_subscriptions` | Per organization |
| Interview Limits | `organization_subscriptions.max_interviews` | Per plan |
| User Limits | `organization_subscriptions.max_users` | Per plan |
| AI Usage Limits | `organization_subscriptions.max_ai_usage` | Per plan |
| Custom Roles | `custom_roles` | Per organization |
| Data Retention Policies | `data_retention_policies` | Per organization |
| ATS Integrations | `ats_integrations` | Per organization |

---

### 6. **Not Yet Implemented** (Future/Production Configurations)

#### 6.1 Payment Processing (Stripe)
| Configuration | Type | Location | Priority |
|---------------|------|----------|----------|
| Stripe Publishable Key | Secret | Lovable Secrets | High |
| Stripe Secret Key | Secret | Lovable Secrets | High |
| Stripe Webhook Endpoint | URL | Stripe Dashboard | High |
| Stripe Webhook Secret | Secret | Lovable Secrets | High |
| Payment Methods Enabled | Setting | Platform Config | Medium |
| Invoice Prefix | Setting | Platform Config | Low |

**Implementation:** Enable via Lovable Stripe integration

#### 6.2 AWS Deployment (Production)
| Configuration | Type | Location | Priority |
|---------------|------|----------|----------|
| AWS Access Key ID | Secret | AWS/Deployment Config | High |
| AWS Secret Access Key | Secret | AWS/Deployment Config | High |
| AWS Region | Setting | Deployment Config | High |
| S3 Bucket Name | Setting | Deployment Config | Medium |
| CloudFront Distribution | Setting | Deployment Config | Medium |
| Load Balancer ARN | Setting | AWS Config | Medium |

**Location:** Deployment configuration files in `public/deployment-package/`

#### 6.3 SSO/SAML (Enterprise)
| Configuration | Type | Location | Priority |
|---------------|------|----------|----------|
| SAML Issuer URL | Setting | Platform Config | Low |
| SAML Certificate | Secret | Lovable Secrets | Low |
| SSO Callback URL | Setting | Platform Config | Low |
| OAuth Client ID | Secret | Lovable Secrets | Low |
| OAuth Client Secret | Secret | Lovable Secrets | Low |

**Implementation:** Future enhancement for enterprise customers

#### 6.4 Third-Party Integrations
| Configuration | Type | Location | Priority |
|---------------|------|----------|----------|
| Google Calendar OAuth | Secret | Lovable Secrets | Medium |
| Outlook Calendar API | Secret | Lovable Secrets | Medium |
| ATS Provider Keys | Secret | Per-org encrypted | High |
| Slack Webhook URL | Setting | Per-org | Low |
| Zoom API Credentials | Secret | Lovable Secrets | Medium |

---

## 🎯 Configuration Management Strategy

### For Development (Lovable Cloud)
1. ✅ **Platform Settings** → Use UI in `/platform-settings`
2. ✅ **Secrets** → Manage via Lovable Cloud Secrets
3. ✅ **Database** → Use migration tool
4. ✅ **Environment** → Auto-managed, don't touch

### For Production Deployment
1. **Export Configuration**
   - Export platform_config table
   - Document all secrets needed
   - Export database schema

2. **Set Up Production Environment**
   - AWS/Cloud infrastructure
   - Production Supabase project
   - Production Stripe account
   - Domain and SSL certificates

3. **Import Configuration**
   - Run migrations on production DB
   - Import platform_config settings
   - Set all secrets in production environment
   - Configure DNS and domain

4. **Verify All Systems**
   - Test AI evaluations
   - Test email delivery
   - Test payment processing
   - Test user authentication
   - Test proctoring features

---

## 📝 Recommended Configuration Management

### What Should Be in Platform Settings (Database)
✅ **Business Rules** - Things admins change regularly
- AI model selection
- Difficulty distributions
- Scoring weights
- Retention policies
- Email templates (future)
- Feature flags (future)

### What Should Be Secrets
✅ **Sensitive Credentials** - Never exposed, rarely changed
- API keys (AI, Email, Payment)
- Webhook secrets
- Service credentials
- OAuth secrets
- Database credentials

### What Should Be Environment Variables
✅ **Deployment Config** - Changes per environment
- Supabase endpoints
- Application URLs
- Port numbers
- Environment mode (dev/staging/prod)

### What Should Be in Database Tables
✅ **Structured Business Data** - Normalized, queryable
- Subscription plans
- Organization settings
- User preferences
- Integration configurations

---

## 🚀 Migration Checklist

When moving to production:

- [ ] Export all `platform_config` settings
- [ ] Document all secrets and their purposes
- [ ] Export database schema (migrations)
- [ ] Set up production Supabase project
- [ ] Configure production domain
- [ ] Set up production email service (Resend)
- [ ] Configure Stripe production keys
- [ ] Set up AWS infrastructure (if self-hosting)
- [ ] Configure CDN and storage
- [ ] Set up monitoring and alerts
- [ ] Configure backup and disaster recovery
- [ ] Set up CI/CD pipelines
- [ ] Configure SSL certificates
- [ ] Test all integrations in production
- [ ] Set up admin user access

---

## 🔍 Finding Configuration Locations

### To find where a config is used:
1. **Frontend:** Search for config key in React components
2. **Backend:** Search `Deno.env.get()` in edge functions
3. **Database:** Check `platform_config` table

### To modify a configuration:
1. **Platform Settings:** Use admin UI at `/platform-settings`
2. **Secrets:** Use Lovable Cloud Secrets UI
3. **Database:** Use migration tool
4. **Environment:** Contact Lovable support (auto-managed)

---

## 📞 Support & Questions

- **Lovable Cloud Issues:** Lovable support
- **Database Migrations:** Use migration tool in Lovable
- **Configuration Questions:** Refer to this document
- **Production Deployment:** See `DEPLOYMENT.md` and deployment package

---

**Last Updated:** 2025-11-17  
**Maintained By:** Platform Admin Team
