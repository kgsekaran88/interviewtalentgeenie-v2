# Configuration Matrix - Quick Reference

## 🎯 Where Should Each Configuration Live?

This matrix helps you decide where to put new configurations.

---

## Decision Tree

```
Is it a SECRET (password, API key, token)?
├─ YES → Lovable Cloud Secrets
└─ NO → Continue...

Does it change per ENVIRONMENT (dev/prod)?
├─ YES → Environment Variable
└─ NO → Continue...

Does PLATFORM ADMIN change it via UI?
├─ YES → Platform Settings (platform_config table)
└─ NO → Continue...

Is it PER ORGANIZATION?
├─ YES → Organization-specific table
└─ NO → Continue...

Is it INFRASTRUCTURE config?
└─ → Deployment configuration files
```

---

## Configuration Types Reference

### 🔐 Lovable Cloud Secrets
**When to use:**
- It's a password, API key, or token
- It must NEVER be exposed to frontend
- It's used in edge functions (backend)
- It changes rarely
- Security breach would be critical

**Examples:**
- Google Gemini API Key
- Stripe Secret Key
- Resend API Key (alternative)
- OAuth Client Secrets
- Webhook Secrets
- Database passwords

**How to access:**
- Backend: `Deno.env.get('SECRET_NAME')`
- Frontend: ❌ NOT accessible (by design)

---

### ⚙️ Platform Settings (platform_config)
**When to use:**
- Platform Admin changes it via UI
- It's a business rule (not infrastructure)
- Same value across all organizations
- Changes don't require deployment
- Non-sensitive configuration

**Examples:**
- AI model selection
- Difficulty percentages
- CPI weights
- Default retention days
- Max interview duration
- Email from address

**How to access:**
- UI: `/platform-settings`
- Database: Query `platform_config` table
- Backend: Read from database

---

### 🌍 Environment Variables (.env)
**When to use:**
- Different per environment (dev/staging/prod)
- Infrastructure-level setting
- Frontend needs access
- Auto-managed by Lovable

**Examples:**
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- APP_PORT
- NODE_ENV

**⚠️ WARNING:** 
- Auto-managed by Lovable Cloud
- DO NOT edit manually
- Exposed to frontend (public)

---

### 🏢 Organization Settings
**When to use:**
- Different per organization
- Organization admin can change
- Stored in database
- Needs to be queryable

**Examples:**
- Subscription plan
- Interview quotas
- Custom branding
- ATS integrations
- Data retention preferences

**How to access:**
- Stored in organization-specific tables
- Filtered by organization_id
- Subject to RLS policies

---

### 🗄️ Database Configuration
**When to use:**
- Structural changes
- Security policies
- Data validation rules
- Database-level logic

**Examples:**
- RLS policies
- Database functions
- Triggers
- Table schemas
- Indexes

**How to manage:**
- Use migration tool only
- Never manual SQL changes
- Versioned and tracked

---

## Common Configuration Scenarios

### Scenario 1: Adding a New AI Provider
```
1. API Key → Lovable Cloud Secrets ✅
2. Model selection → Platform Settings ✅
3. Fallback logic → Code change ✅
4. Usage tracking → Database table ✅
```

### Scenario 2: Adding Email Template Support
```
1. Email provider key → Already in Secrets ✅
2. Template storage → New database table ✅
3. Template selection → Platform Settings ✅
4. Sender config → Already in Platform Settings ✅
```

### Scenario 3: Adding Organization Branding
```
1. Logo upload → Supabase Storage ✅
2. Brand colors → Organization settings table ✅
3. Default settings → Platform Settings ✅
4. Custom domain → Environment/DNS config ✅
```

### Scenario 4: Adding Payment Gateway
```
1. Secret keys → Lovable Cloud Secrets ✅
2. Webhook URL → Environment Variable ✅
3. Enabled features → Platform Settings ✅
4. Per-org config → Organization settings ✅
```

---

## Migration Strategy

### From Lovable Cloud to Production

#### Step 1: Identify Configuration Types
```sql
-- Export platform settings
SELECT * FROM platform_config;

-- List organization-specific settings
SELECT DISTINCT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%organization%';
```

#### Step 2: Document Secrets
Create `secrets-checklist.txt`:
```
☐ GOOGLE_GEMINI_API_KEY (from Google Cloud Console)
☐ RESEND_API_KEY (from Resend Dashboard) - REQUIRED for auth emails
☐ STRIPE_SECRET_KEY (from Stripe Dashboard)
☐ AWS_ACCESS_KEY_ID (from AWS IAM)
☐ AWS_SECRET_ACCESS_KEY (from AWS IAM)
```

**Note:** Auth email templates are stored in the `email_templates` table (template keys starting with `auth_`).
The `auth-email-hook` edge function uses these templates + RESEND_API_KEY to send branded auth emails.

#### Step 3: Environment Variables
Create `.env.production`:
```bash
# Frontend
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-prod-anon-key
VITE_SUPABASE_PROJECT_ID=your-prod-project-id

# Backend
NODE_ENV=production
APP_PORT=8080
```

#### Step 4: Database Export
```bash
# Export schema
supabase db dump --schema public > schema.sql

# Export data (platform_config only)
supabase db dump --data-only --table platform_config > config-data.sql
```

---

## Configuration Validation Checklist

Before going to production:

### Secrets ✅
- [ ] All secrets are set in production environment
- [ ] No secrets in source code or .env files
- [ ] Secrets are different from dev/staging
- [ ] Service accounts have minimal permissions

### Platform Settings ✅
- [ ] All platform_config entries reviewed
- [ ] Production-appropriate values set
- [ ] No test/debug settings enabled
- [ ] Retention policies match legal requirements

### Environment Variables ✅
- [ ] All URLs point to production services
- [ ] NODE_ENV is 'production'
- [ ] No dev/debug flags enabled
- [ ] CORS origins restricted

### Database ✅
- [ ] All migrations applied
- [ ] RLS policies enabled
- [ ] Indexes created for performance
- [ ] Backup strategy configured

### Organization Settings ✅
- [ ] Default settings make sense
- [ ] Subscription plans configured
- [ ] Pricing is production-ready
- [ ] Feature limits set correctly

---

## Quick Commands

### View Current Configuration
```sql
-- Platform settings
SELECT category, key, value 
FROM platform_config 
ORDER BY category, key;

-- Organization limits
SELECT o.name, s.max_interviews, s.max_users, s.max_ai_usage
FROM organizations o
JOIN organization_subscriptions s ON s.organization_id = o.id;
```

### Add New Platform Setting
```sql
INSERT INTO platform_config (key, value, category, description, is_editable)
VALUES ('new_setting_key', 'default_value', 'category_name', 'Description here', true);
```

### Update Existing Setting
Use Platform Settings UI at `/platform-settings` or:
```sql
UPDATE platform_config 
SET value = 'new_value', updated_at = NOW()
WHERE key = 'setting_key';
```

---

## Common Pitfalls to Avoid

### ❌ DON'T:
1. Put secrets in platform_config table
2. Edit .env file manually in Lovable Cloud
3. Store organization-specific data in platform_config
4. Use environment variables for business logic
5. Bypass migration tool for database changes

### ✅ DO:
1. Use Lovable Cloud Secrets for all sensitive data
2. Let Lovable manage environment variables
3. Use organization tables for org-specific settings
4. Use platform_config for business rules
5. Always use migration tool for database

---

## Need Help?

**Adding configuration:**
1. Use decision tree at top of document
2. Check examples for similar configs
3. Follow the "Common Scenarios" section

**Moving to production:**
1. Follow migration strategy section
2. Use validation checklist
3. Refer to CONFIGURATION_GUIDE.md

**Troubleshooting:**
1. Check configuration is in right place
2. Verify permissions (RLS policies)
3. Check logs for access errors
4. Verify secrets are set correctly
