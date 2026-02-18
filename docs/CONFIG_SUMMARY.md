# Configuration Summary - Visual Guide

## 🎯 The Four Pillars of Configuration

```
┌─────────────────────────────────────────────────────────────┐
│                    LOVABLE CLOUD SECRETS                     │
│                           (🔐)                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ • API Keys      • Tokens       • Passwords          │    │
│  │ • OAuth Secrets • Webhook Keys • DB Credentials     │    │
│  └─────────────────────────────────────────────────────┘    │
│  WHEN: Sensitive, Backend-only, Rarely changes              │
│  ACCESS: Edge functions only via Deno.env.get()             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PLATFORM SETTINGS (Database)                    │
│                      (⚙️)                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ • AI Models     • Business Rules  • Scoring Weights │    │
│  │ • Percentages   • Durations      • Email Settings   │    │
│  └─────────────────────────────────────────────────────┘    │
│  WHEN: Admin editable, Business logic, Non-sensitive        │
│  ACCESS: UI at /platform-settings, platform_config table    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ENVIRONMENT VARIABLES (.env)                    │
│                          (🌍)                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ • Supabase URLs  • Project IDs   • Public Keys      │    │
│  │ • Port Numbers   • NODE_ENV      • App URLs         │    │
│  └─────────────────────────────────────────────────────┘    │
│  WHEN: Per environment, Infrastructure, Auto-managed        │
│  ACCESS: ⚠️ AUTO-MANAGED - DO NOT EDIT MANUALLY             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            DATABASE CONFIGURATION (Migrations)               │
│                         (🗄️)                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ • RLS Policies  • DB Functions   • Triggers          │    │
│  │ • Schemas       • Indexes        • Constraints       │    │
│  └─────────────────────────────────────────────────────┘    │
│  WHEN: Structural, Security policies, Data rules            │
│  ACCESS: Migration tool only, never manual SQL              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Current Configuration Status

### ✅ CONFIGURED (Ready to Use)

| Item | Location | Count | Status |
|------|----------|-------|--------|
| Platform Settings | platform_config table | 14 | ✅ Active |
| Secrets | Lovable Cloud Secrets | 2/7 | ⚠️ Partial |
| Environment Vars | .env (auto) | 3 | ✅ Active |
| Database Schema | Migrations | 80+ tables | ✅ Active |
| RLS Policies | Database | 100+ | ✅ Active |

### ⚠️ NEEDS ATTENTION

| Item | Issue | Action Required | Priority |
|------|-------|-----------------|----------|
| Resend API Key | In platform_config (should be secret) | Move to Secrets | High |
| Stripe Keys | Not configured | Add when enabling payments | Medium |
| AWS Credentials | Not configured | Needed for production | High |
| SSO/SAML | Not implemented | Future feature | Low |

---

## 🚀 Production Deployment Checklist

### Pre-Deployment
- [ ] **Export Configurations**
  ```bash
  # Export platform settings
  supabase db dump --data-only --table platform_config > platform-config.sql
  
  # Export database schema
  supabase db dump --schema public > database-schema.sql
  ```

- [ ] **Document All Secrets**
  - List all Lovable Cloud secrets
  - Note where to get production values
  - Prepare secrets for production environment

- [ ] **Review All Settings**
  - Check all platform_config values
  - Verify they're production-appropriate
  - Update email addresses, retention days, etc.

### Deployment
- [ ] **Set Up Infrastructure**
  - Provision production Supabase project
  - Set up AWS resources (if self-hosting)
  - Configure domain and DNS
  - Set up SSL certificates

- [ ] **Configure Production Environment**
  - Set all secrets in production
  - Update environment variables
  - Import database schema
  - Import platform_config settings

- [ ] **Verify Integrations**
  - Test AI API connections
  - Test email delivery
  - Test payment processing (if enabled)
  - Test authentication flows

### Post-Deployment
- [ ] **Monitor & Validate**
  - Check all edge functions work
  - Verify RLS policies enforce correctly
  - Test from different user roles
  - Monitor logs for errors

- [ ] **Security Audit**
  - Confirm no secrets in code
  - Verify RLS on all tables
  - Check API rate limits
  - Review access logs

---

## 🔍 Quick Lookup Table

### "Where do I put this new configuration?"

| Configuration Type | Example | Location | Public? |
|--------------------|---------|----------|---------|
| API Key/Token | Google API key | Secrets | ❌ No |
| Business Rule | Difficulty % | Platform Settings | ⚠️ Admin only |
| Infrastructure URL | Supabase URL | Environment Var | ✅ Yes |
| Per-Organization | Interview quota | Organization table | ⚠️ Org only |
| Security Policy | RLS rule | Migration | ✅ Yes |
| Frontend Config | Feature flag | Platform Settings | ⚠️ Admin only |

### "How do I access this configuration?"

| Location | Frontend | Backend | Admin UI |
|----------|----------|---------|----------|
| Secrets | ❌ No | ✅ Yes (`Deno.env.get()`) | ✅ Cloud UI |
| Platform Settings | ⚠️ Query DB | ✅ Query DB | ✅ /platform-settings |
| Environment Vars | ✅ Yes (`import.meta.env`) | ✅ Yes (`Deno.env.get()`) | ❌ Auto-managed |
| Database | ✅ Via Supabase | ✅ Via Supabase | ✅ Via migrations |

---

## 📊 Configuration Flow Diagram

```
┌──────────────┐
│   New Config │
│   Required   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│  Is it SENSITIVE?        │
│  (password, key, token)  │
└──────┬──────────┬────────┘
       │Yes       │No
       ▼          ▼
┌─────────────┐  ┌────────────────────┐
│   Lovable   │  │  Changes per ENV?  │
│   Secrets   │  │  (dev/prod)        │
└─────────────┘  └─────┬─────────┬────┘
                       │Yes      │No
                       ▼         ▼
                ┌────────────┐  ┌──────────────────┐
                │Environment │  │  Admin Editable? │
                │ Variables  │  │  (via UI)        │
                └────────────┘  └────┬──────────┬──┘
                                     │Yes       │No
                                     ▼          ▼
                              ┌─────────────┐ ┌──────────────┐
                              │  Platform   │ │ Organization │
                              │  Settings   │ │   or DB      │
                              └─────────────┘ └──────────────┘
```

---

## 💡 Best Practices

### DO ✅
1. **Use Secrets for All Sensitive Data**
   - API keys, tokens, passwords
   - Never commit to version control
   - Different values per environment

2. **Use Platform Settings for Business Rules**
   - Editable by admins without deployment
   - Non-sensitive configuration
   - Audit trail in database

3. **Let Lovable Manage Environment Variables**
   - Don't edit .env manually
   - Trust the auto-configuration
   - Use for infrastructure only

4. **Use Migrations for Database Changes**
   - Version controlled
   - Repeatable and testable
   - Rollback capability

### DON'T ❌
1. **Never Put Secrets in Platform Settings**
   - Visible in database
   - Could be accidentally exposed
   - No encryption at rest

2. **Never Edit .env Manually in Lovable**
   - Auto-regenerated
   - Will be overwritten
   - Causes sync issues

3. **Never Skip Migrations for DB Changes**
   - Causes drift between environments
   - No rollback path
   - Can break RLS policies

4. **Never Hardcode Configuration**
   - Makes changes require deployment
   - Different values per environment
   - Difficult to manage

---

## 🛠️ Configuration Management Tools

### Available Now
- ✅ Platform Settings UI (`/platform-settings`)
- ✅ Lovable Cloud Secrets (Lovable dashboard)
- ✅ Database Migration Tool (Lovable)
- ✅ Supabase Dashboard (database viewing)

### Coming Soon
- 🔄 Configuration Export/Import Tool
- 🔄 Configuration Validation Tool
- 🔄 Environment Comparison Tool
- 🔄 Configuration Backup Tool

---

## 📞 Get Help

**Problem:** Don't know where to put a config  
**Solution:** Use decision tree → Check examples → Ask in docs

**Problem:** Need to change environment variables  
**Solution:** Don't! They're auto-managed. If really needed, contact support.

**Problem:** Moving to production  
**Solution:** Follow CONFIGURATION_GUIDE.md migration section

**Problem:** Lost track of configurations  
**Solution:** This document + CONFIGURATION_GUIDE.md have full inventory

---

## 📁 Related Documents

- `CONFIGURATION_GUIDE.md` - Detailed guide with all configs
- `CONFIGURATION_MATRIX.md` - Decision matrix for new configs
- `DEPLOYMENT.md` - Production deployment guide
- `.env.example` - Environment variable template

---

**Quick Start:** New to configuration management?  
→ Read this document first  
→ Then dive into CONFIGURATION_GUIDE.md  
→ Use CONFIGURATION_MATRIX.md when adding new configs
