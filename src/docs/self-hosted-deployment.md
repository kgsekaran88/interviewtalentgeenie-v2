# Self-Hosted Deployment Guide: Complete Independence from Lovable

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Changes](#architecture-changes)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Cost Estimates](#cost-estimates)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete instructions for deploying TalentGeenie to your own infrastructure, independent of Lovable services. You'll migrate from Lovable Cloud to your own Supabase instance, integrate your own AI API keys, and deploy to AWS with a custom domain.

**What You'll Achieve:**
- ✅ Complete ownership of data and infrastructure
- ✅ Your own Supabase project (database, auth, storage, edge functions)
- ✅ Direct integration with OpenAI GPT or Google Gemini APIs
- ✅ AWS deployment with custom domain
- ✅ Production-grade security and monitoring
- ✅ Full control over costs and scaling

**Estimated Time:** 4-6 hours (first-time setup)

---

## Prerequisites

### Required Accounts
1. **GitHub Account** (for code repository)
2. **Supabase Account** (free tier available)
3. **AWS Account** (with billing enabled)
4. **Domain Registrar** (for custom domain)
5. **AI Provider Account** (choose one or both):
   - OpenAI Account (for GPT models)
   - Google Cloud Account (for Gemini API)

### Required Software
```bash
# Node.js and npm
node --version  # v18 or higher
npm --version   # v9 or higher

# Git
git --version

# Supabase CLI
npm install -g supabase

# AWS CLI (optional but recommended)
pip install awscli
aws --version
```

### Required Skills
- Basic command-line knowledge
- Understanding of environment variables
- Basic SQL knowledge
- AWS basic concepts (S3, CloudFront, EC2)

### Budget Requirements
- **Minimum:** $20-50/month
- **Recommended:** $50-150/month (for production with traffic)

---

## Architecture Changes

### Current Architecture (Lovable Cloud)
```
React Frontend (Lovable Hosting)
    ↓
Lovable Cloud (Supabase Backend)
    ↓
Lovable AI Gateway (GPT-5/Gemini)
```

### New Architecture (Self-Hosted)
```
React Frontend (AWS S3 + CloudFront)
    ↓
Your Supabase Instance (Self-hosted or Supabase Cloud)
    ↓
Direct AI API (OpenAI or Google Gemini)
```

---

## Step-by-Step Implementation

### Phase 1: Export Code from Lovable (30 minutes)

#### Step 1.1: Connect to GitHub
1. Open your Lovable project
2. Click **GitHub** button in top-right corner
3. Authorize Lovable to access your GitHub account
4. Create a new repository or select existing one
5. Click **Push to GitHub**
6. Wait for code to be pushed

#### Step 1.2: Clone Repository Locally
```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install dependencies
npm install
```

#### Step 1.3: Verify Local Setup
```bash
# This will fail initially - that's expected
npm run dev
```

---

### Phase 2: Set Up Your Own Supabase (60 minutes)

#### Step 2.1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project**
3. Sign in or create account
4. Click **New Project**
5. Fill in details:
   - **Name:** talentgeenie-prod
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Start with Free tier
6. Click **Create new project**
7. Wait 2-3 minutes for provisioning

#### Step 2.2: Configure Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Create new query
3. Copy ALL migration files from `supabase/migrations/` folder
4. Run each migration in chronological order (by filename)

**Important:** Run migrations in order! Example:
```sql
-- Run first migration
-- Copy content from supabase/migrations/00000000000000_init.sql
-- Click Run

-- Run second migration
-- Copy content from supabase/migrations/00000000000001_*.sql
-- Click Run

-- Continue for all migrations...
```

#### Step 2.3: Set Up Authentication
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL:** `https://yourdomain.com` (we'll set this up later)
5. Add **Redirect URLs:**
   - `https://yourdomain.com`
   - `https://yourdomain.com/auth`
   - `http://localhost:5173` (for development)
6. Go to **Authentication** → **Email Templates**
7. Customize email templates (optional)

#### Step 2.4: Disable Email Confirmation (Optional - for testing)
1. Go to **Authentication** → **Providers**
2. Click **Email** provider
3. Toggle OFF **Confirm email**
4. Click **Save**

**⚠️ Security Note:** Re-enable this for production!

#### Step 2.5: Set Up Storage Buckets
1. Go to **Storage**
2. Create bucket: `documentation`
   - Public: No
   - File size limit: 50MB
   - Allowed MIME types: `application/pdf, text/markdown`
3. Create bucket: `proctoring-recordings`
   - Public: No
   - File size limit: 500MB
   - Allowed MIME types: `video/webm, video/mp4`

#### Step 2.6: Configure Storage Policies
Go to **Storage** → **Policies** and add:

```sql
-- Policy: Users can upload their own recordings
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proctoring-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own recordings
CREATE POLICY "Users can view own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proctoring-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can view documentation
CREATE POLICY "Admins can view documentation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentation'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
```

#### Step 2.7: Get Supabase Credentials
1. Go to **Project Settings** → **API**
2. Copy and save these values:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...`
   - **service_role key:** `eyJhbGc...` (keep this secret!)
3. Go to **Project Settings** → **General**
4. Copy **Reference ID** (project ID)

---

### Phase 3: Set Up AI Integration (45 minutes)

You have two options: **OpenAI** or **Google Gemini** (or both)

#### Option A: OpenAI Integration

##### Step 3A.1: Get OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create account
3. Go to **API Keys** section
4. Click **Create new secret key**
5. Name it: `talentgeenie-prod`
6. Copy the key (starts with `sk-...`)
7. **Save it immediately** - you won't see it again!

##### Step 3A.2: Add Funds to OpenAI Account
1. Go to **Billing** → **Payment methods**
2. Add credit card
3. Go to **Billing** → **Usage limits**
4. Set monthly budget: $50-100 (recommended for starting)
5. Enable email notifications at 50%, 75%, 90%

##### Step 3A.3: Update Edge Functions for OpenAI
Edit `supabase/functions/generate-questions/index.ts`:

```typescript
// Replace Lovable AI Gateway with OpenAI
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4-turbo-preview", // or "gpt-3.5-turbo" for lower cost
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  }),
});
```

Apply similar changes to:
- `supabase/functions/evaluate-interview/index.ts`
- `supabase/functions/evaluate-learning-assessment/index.ts`
- `supabase/functions/generate-learning-questions/index.ts`
- `supabase/functions/generate-training-plan/index.ts`
- `supabase/functions/extract-skills/index.ts`
- `supabase/functions/add-questions/index.ts`
- `supabase/functions/regenerate-questions/index.ts`

#### Option B: Google Gemini Integration

##### Step 3B.1: Get Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google account
3. Click **Get API Key**
4. Create new project or select existing
5. Click **Create API Key**
6. Copy the key
7. Save it securely

##### Step 3B.2: Update Edge Functions for Gemini
Edit `supabase/functions/generate-questions/index.ts`:

```typescript
// Replace Lovable AI Gateway with Gemini
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: systemPrompt + "\n\n" + prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    }),
  }
);

const data = await response.json();
const generatedText = data.candidates[0].content.parts[0].text;
```

Apply similar changes to all edge functions listed in Option A.

---

### Phase 4: Deploy Edge Functions to Supabase (30 minutes)

#### Step 4.1: Link Local Project to Supabase
```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# When prompted, enter your database password
```

#### Step 4.2: Set Environment Secrets
```bash
# Set OpenAI key (if using OpenAI)
supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here

# OR set Gemini key (if using Gemini)
supabase secrets set GEMINI_API_KEY=your-gemini-key-here

# Set Supabase secrets (for edge functions)
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Step 4.3: Deploy Functions
```bash
# Deploy all edge functions
supabase functions deploy generate-questions
supabase functions deploy evaluate-interview
supabase functions deploy evaluate-learning-assessment
supabase functions deploy generate-learning-questions
supabase functions deploy generate-training-plan
supabase functions deploy extract-skills
supabase functions deploy execute-code
supabase functions deploy admin-user-management
supabase functions deploy add-questions
supabase functions deploy regenerate-questions

# Verify deployment
supabase functions list
```

#### Step 4.4: Test Edge Functions
```bash
# Test a function
supabase functions invoke generate-questions \
  --body '{"jobDescription":"Test","title":"Test","questionCount":5,"timeLimit":30,"difficulty":"medium"}'
```

---

### Phase 5: Update Frontend Environment Variables (15 minutes)

#### Step 5.1: Create Production .env File
Create `.env.production`:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

#### Step 5.2: Update .gitignore
Ensure `.env.production` is in `.gitignore`:

```
# Environment files
.env
.env.local
.env.production
.env.development
```

#### Step 5.3: Build Frontend
```bash
# Build for production
npm run build

# Test production build locally
npm run preview
```

---

### Phase 6: Deploy to AWS (90 minutes)

#### Step 6.1: Set Up S3 Bucket
```bash
# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Format (json)

# Create S3 bucket (bucket names must be globally unique)
aws s3 mb s3://talentgeenie-prod-yourname

# Enable static website hosting
aws s3 website s3://talentgeenie-prod-yourname \
  --index-document index.html \
  --error-document index.html
```

#### Step 6.2: Configure Bucket Policy
Create `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::talentgeenie-prod-yourname/*"
    }
  ]
}
```

Apply policy:
```bash
aws s3api put-bucket-policy \
  --bucket talentgeenie-prod-yourname \
  --policy file://bucket-policy.json
```

#### Step 6.3: Upload Build Files
```bash
# Upload dist folder to S3
aws s3 sync dist/ s3://talentgeenie-prod-yourname/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html"

# Upload index.html separately (no cache)
aws s3 cp dist/index.html s3://talentgeenie-prod-yourname/ \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"
```

#### Step 6.4: Set Up CloudFront Distribution
1. Go to AWS Console → **CloudFront**
2. Click **Create Distribution**
3. Configure:
   - **Origin Domain:** Select your S3 bucket
   - **Origin Path:** Leave empty
   - **Name:** talentgeenie-prod
   - **Viewer Protocol Policy:** Redirect HTTP to HTTPS
   - **Allowed HTTP Methods:** GET, HEAD, OPTIONS
   - **Cache Policy:** CachingOptimized
   - **Price Class:** Use Only North America and Europe (or All if global)
   - **Alternate Domain Names (CNAMEs):** yourdomain.com, www.yourdomain.com
   - **SSL Certificate:** Request new certificate (we'll do this next)
4. Click **Create Distribution**
5. Note the **Distribution Domain Name** (e.g., `d111111abcdef8.cloudfront.net`)

#### Step 6.5: Request SSL Certificate
1. Go to AWS Console → **Certificate Manager** (in us-east-1 region!)
2. Click **Request certificate**
3. Choose **Request a public certificate**
4. Enter domain names:
   - `yourdomain.com`
   - `www.yourdomain.com`
5. Validation method: **DNS validation**
6. Click **Request**
7. Click **Create records in Route 53** (if using Route 53)
   - OR manually add CNAME records to your domain DNS
8. Wait for validation (5-30 minutes)

#### Step 6.6: Attach Certificate to CloudFront
1. Go back to **CloudFront** → Your distribution
2. Click **Edit**
3. Under **Custom SSL Certificate**, select your certificate
4. Click **Save changes**
5. Wait for distribution to deploy (10-15 minutes)

---

### Phase 7: Configure Custom Domain (45 minutes)

#### Step 7.1: Configure DNS (Route 53)
If using AWS Route 53:

```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)

# Note the nameservers from output
```

Add A records pointing to CloudFront:
1. Go to **Route 53** → **Hosted Zones**
2. Select your domain
3. Click **Create Record**
4. Create alias record:
   - **Record name:** Leave empty (for root domain)
   - **Record type:** A
   - **Alias:** Yes
   - **Route traffic to:** Alias to CloudFront distribution
   - **Distribution:** Select your distribution
5. Repeat for `www`:
   - **Record name:** www
   - Same settings as above

#### Step 7.2: Configure DNS (Other Providers)
If using GoDaddy, Namecheap, etc.:

1. Log into your domain registrar
2. Go to DNS management
3. Add CNAME record:
   - **Type:** CNAME
   - **Name:** www
   - **Value:** d111111abcdef8.cloudfront.net (your CloudFront domain)
   - **TTL:** 3600
4. For root domain, create ALIAS or ANAME record:
   - **Type:** ALIAS (or ANAME)
   - **Name:** @
   - **Value:** d111111abcdef8.cloudfront.net
   - **TTL:** 3600

**Note:** Not all registrars support ALIAS records for root domains. In that case:
- Use Route 53 for DNS (free)
- Or use CloudFlare (free tier available)

#### Step 7.3: Update Supabase Redirect URLs
1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Update **Site URL:** `https://yourdomain.com`
3. Update **Redirect URLs:**
   - `https://yourdomain.com`
   - `https://yourdomain.com/auth`
   - `https://www.yourdomain.com`
4. Click **Save**

#### Step 7.4: Test Your Domain
```bash
# Wait for DNS propagation (can take 24-48 hours, usually 1-2 hours)
# Check DNS propagation
nslookup yourdomain.com

# Test HTTPS
curl -I https://yourdomain.com

# Should return 200 OK
```

---

### Phase 8: Create First Admin User (15 minutes)

#### Step 8.1: Sign Up Through UI
1. Go to `https://yourdomain.com/auth`
2. Create account with your email
3. Sign in

#### Step 8.2: Grant Admin Role via SQL
1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query:

```sql
-- Get your user ID first
SELECT id, email FROM auth.users;

-- Grant admin role (replace YOUR_USER_ID)
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'admin');

-- Verify
SELECT u.email, ur.role 
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id;
```

#### Step 8.3: Verify Admin Access
1. Refresh your browser
2. Navigate to `/dashboard`
3. You should see admin options

---

## Cost Estimates

### Monthly Costs (Estimated)

#### Minimal Setup (Testing/Small Team)
| Service | Cost |
|---------|------|
| Supabase (Free Tier) | $0 |
| AWS S3 (5GB storage, 10K requests) | $1 |
| AWS CloudFront (10GB transfer) | $1 |
| OpenAI API (GPT-3.5, ~100K tokens) | $10 |
| Domain Registration | $1-2/month |
| **Total** | **~$13-15/month** |

#### Small Production (100-500 users/month)
| Service | Cost |
|---------|------|
| Supabase Pro | $25 |
| AWS S3 (20GB storage, 100K requests) | $5 |
| AWS CloudFront (100GB transfer) | $8 |
| OpenAI API (GPT-4, ~500K tokens) | $50 |
| Domain Registration | $1-2/month |
| **Total** | **~$89-92/month** |

#### Medium Production (1000-5000 users/month)
| Service | Cost |
|---------|------|
| Supabase Pro | $25 |
| AWS S3 (100GB storage, 500K requests) | $15 |
| AWS CloudFront (500GB transfer) | $40 |
| OpenAI API (GPT-4, ~2M tokens) | $200 |
| Domain Registration | $1-2/month |
| **Total** | **~$281-284/month** |

### Cost Optimization Tips

1. **Use GPT-3.5-turbo instead of GPT-4** for non-critical operations
   - Savings: ~90% on AI costs
   - Trade-off: Slightly lower quality responses

2. **Use Gemini API** instead of OpenAI
   - Gemini Pro is free for up to 60 requests/minute
   - Savings: Could eliminate AI costs entirely

3. **Enable CloudFront caching aggressively**
   - Reduce S3 requests by 80-90%
   - Faster load times for users

4. **Use Supabase Free Tier** for development
   - Upgrade to Pro only when needed
   - Limitations: 500MB database, 1GB file storage, 2GB bandwidth

5. **Compress and optimize images**
   - Use WebP format
   - Lazy load images
   - Savings: 50-70% bandwidth reduction

---

## Security Hardening

### Production Checklist

#### Database Security
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Review all RLS policies
- [ ] Use service_role key only in edge functions
- [ ] Never expose service_role key to frontend
- [ ] Enable database backups (daily recommended)
- [ ] Set up database connection pooling
- [ ] Enable SSL for database connections

#### Authentication Security
- [ ] Enable email confirmation
- [ ] Set strong password requirements
- [ ] Enable MFA (Multi-Factor Authentication)
- [ ] Configure session timeouts (7 days recommended)
- [ ] Set up email rate limiting
- [ ] Configure CAPTCHA for signup (optional)

#### API Security
- [ ] Set rate limits on edge functions
- [ ] Implement request logging
- [ ] Use API keys rotation strategy
- [ ] Monitor API usage and costs
- [ ] Set up budget alerts
- [ ] Implement IP whitelisting (if needed)

#### Frontend Security
- [ ] Enable HTTPS only (enforce)
- [ ] Set up Content Security Policy (CSP)
- [ ] Enable HSTS headers
- [ ] Disable directory listing on S3
- [ ] Use CloudFront signed URLs for private content
- [ ] Implement XSS protection
- [ ] Add rate limiting on client side

#### Monitoring & Alerts
- [ ] Set up Supabase monitoring
- [ ] Configure AWS CloudWatch alarms
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Monitor API costs daily
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure backup alerts

---

## Monitoring & Maintenance

### Daily Tasks
- Check error logs in Supabase
- Review API costs (OpenAI/Gemini)
- Monitor user signups and activity

### Weekly Tasks
- Review security logs
- Check database performance
- Review and optimize slow queries
- Check backup status
- Review CloudFront cache hit ratio

### Monthly Tasks
- Review and optimize costs
- Update dependencies (`npm update`)
- Review and update edge functions
- Database maintenance (vacuum, analyze)
- Security audit
- Review user feedback

### Quarterly Tasks
- Major dependency updates
- Security penetration testing
- Performance optimization review
- Infrastructure scaling review
- Disaster recovery testing

---

## Troubleshooting

### Common Issues

#### Issue: "Authentication failed"
**Cause:** Redirect URLs not configured correctly
**Solution:**
1. Go to Supabase → Authentication → URL Configuration
2. Add your domain to redirect URLs
3. Clear browser cache and try again

#### Issue: "Edge function timeout"
**Cause:** AI API taking too long to respond
**Solution:**
1. Increase function timeout in `supabase/config.toml`:
```toml
[functions.generate-questions]
verify_jwt = true
timeout = 120  # seconds
```
2. Redeploy function: `supabase functions deploy generate-questions`

#### Issue: "CORS error"
**Cause:** CloudFront not configured for CORS
**Solution:**
1. Go to CloudFront → Behaviors → Edit
2. Add to allowed headers:
   - Authorization
   - Content-Type
   - X-Client-Info
   - apikey
3. Cache based on selected headers

#### Issue: "Database connection error"
**Cause:** Connection pooling exhausted
**Solution:**
1. Upgrade Supabase plan
2. Or optimize queries to close connections faster
3. Or implement connection pooling in edge functions

#### Issue: "High OpenAI costs"
**Cause:** Generating too many tokens
**Solution:**
1. Reduce `max_tokens` in API calls
2. Use GPT-3.5-turbo instead of GPT-4
3. Implement caching for common queries
4. Switch to Gemini API (cheaper/free)

#### Issue: "CloudFront not serving updated content"
**Cause:** Cache not invalidated
**Solution:**
```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

# Or just for index.html
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/index.html"
```

#### Issue: "Slow database queries"
**Cause:** Missing indexes
**Solution:**
```sql
-- Add indexes on frequently queried columns
CREATE INDEX idx_interviews_creator_id ON public.interviews(creator_id);
CREATE INDEX idx_interview_attempts_interview_id ON public.interview_attempts(interview_id);
CREATE INDEX idx_interview_attempts_status ON public.interview_attempts(status);
CREATE INDEX idx_questions_interview_id ON public.questions(interview_id);
```

---

## Automation Scripts

### Deployment Script
Create `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Build frontend
echo "📦 Building frontend..."
npm run build

# Upload to S3
echo "☁️ Uploading to S3..."
aws s3 sync dist/ s3://talentgeenie-prod-yourname/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://talentgeenie-prod-yourname/ \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"

# Invalidate CloudFront
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x deploy.sh
```

Use it:
```bash
./deploy.sh
```

### Database Backup Script
Create `backup-db.sh`:

```bash
#!/bin/bash
set -e

# Supabase project details
PROJECT_ID="your-project-id"
DB_PASSWORD="your-db-password"

# Backup filename
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"

# Create backup
pg_dump "postgresql://postgres:$DB_PASSWORD@db.$PROJECT_ID.supabase.co:5432/postgres" > "$BACKUP_FILE"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_FILE" s3://talentgeenie-backups/

echo "✅ Backup created: $BACKUP_FILE"
```

---

## Next Steps

After completing this guide:

1. **Monitor for 1 week** - Watch costs, errors, performance
2. **Enable email confirmation** - For production security
3. **Set up monitoring** - Sentry, LogRocket, or similar
4. **Create backups schedule** - Automated daily backups
5. **Document your setup** - For your team
6. **Scale as needed** - Upgrade Supabase/AWS as traffic grows

---

## Support Resources

### Official Documentation
- [Supabase Docs](https://supabase.com/docs)
- [AWS S3 Docs](https://docs.aws.amazon.com/s3/)
- [AWS CloudFront Docs](https://docs.aws.amazon.com/cloudfront/)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Google Gemini Docs](https://ai.google.dev/docs)

### Community
- Supabase Discord
- AWS Forums
- Stack Overflow (tag: supabase, aws, react)

### Professional Support
- Supabase Pro Support (included with Pro plan)
- AWS Enterprise Support (additional cost)
- Hire DevOps consultant for setup assistance

---

## Conclusion

You now have complete independence from Lovable services with your own infrastructure. This setup gives you:

- ✅ Full control over your data
- ✅ Ability to customize everything
- ✅ Production-grade security
- ✅ Predictable costs
- ✅ Scalability to millions of users

**Estimated Total Setup Cost:** $20-50 first month (including one-time setup)
**Estimated Ongoing Cost:** $13-$300/month (depending on usage)

Good luck with your production deployment! 🚀
