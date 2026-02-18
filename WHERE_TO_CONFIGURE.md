# 🎛️ Where Do I Configure Things?

## Your Configuration Dashboard

You have **8 main pages** where you input settings and configurations. Everything else is operational pages where users work.

---

## 🎯 YOUR CONFIGURATION PAGES

### 1. **Platform Settings** `/platform-settings`
**🔑 Most Important Configuration Page**

**What You See:**
- 8 tabs with different settings
- Input fields and dropdowns
- Save button to apply changes

**What You Configure:**

| Section | What | Current Status | Action Needed |
|---------|------|----------------|---------------|
| **Organizations** | View all orgs | ✅ Read-only | None - just viewing |
| **Subscription Plans** | Create pricing tiers | ❌ Empty | **ADD YOUR PRICING** |
| **AI Configuration** | Select AI models | ✅ Set to Gemini | Change if needed |
| **Difficulty Rules** | Question mix (Easy/Medium/Hard) | ✅ Set to 30/50/20 | Adjust if needed |
| **CPI Weights** | Scoring formula weights | ✅ Set to 40/30/30 | Adjust if needed |
| **Recording Retention** | Video storage duration | ✅ Set to 90 days | Adjust if needed |
| **Email Configuration** | Email service settings | ⚠️ **NEEDS API KEY** | **ADD RESEND KEY** |
| **SSO & Integrations** | OAuth, SAML | ❌ Not active | Future |

**🎬 Go here NOW:**
1. Click "Email Configuration" tab
2. Add your Resend API key (get from resend.com)
3. Set your "From Address" and "From Name"
4. Save

---

### 2. **Pricing Management** `/pricing-management`
**💰 Create Your Subscription Plans**

**What You See:**
- List of plans (currently empty)
- "Create New Plan" button
- Form to add plan details

**What You Configure:**
```
Example Plan Input:
┌─────────────────────────────┐
│ Plan Name: Pro Plan         │
│ Type: Recurring             │
│ Interval: Monthly           │
│ Price: $99.00               │
│ Max Interviews: 100         │
│ Max Users: 20               │
│ Features:                   │
│  ☑ AI Evaluations           │
│  ☑ Proctoring               │
│  ☑ Analytics                │
│  ☑ Email Support            │
└─────────────────────────────┘
```

**🎬 Go here NOW:**
1. Click "Create New Plan"
2. Add at least 3 plans: Free, Pro, Enterprise
3. Set pricing and limits
4. Save each plan

---

### 3. **AI Configuration** `/ai-config`
**🤖 Advanced AI Settings**

**What You See:**
- AI provider selection
- Model configuration
- Health monitoring

**What You Configure:**

| Setting | Current | Options | When to Change |
|---------|---------|---------|----------------|
| Primary Provider | Lovable AI | Lovable / Gemini | Lovable is free, use this |
| Primary Model | gemini-2.5-flash | Various models | Change for better quality |
| Fallback Model | gemini-1.5-flash | Various models | Backup if primary fails |
| Enable Fallback | Yes | Yes/No | Keep as Yes |

**🎬 Action:**
- **Default is good** - Only change if you need specific AI behavior
- Monitor the "Health" section to ensure AI is working

---

### 4. **Role Permissions** `/role-permissions`
**👥 What Each User Type Can Do**

**What You See:**
- List of roles
- Permission checkboxes
- Capability definitions

**What You Configure:**
```
Role: HR Recruiter
Permissions:
☑ Create Interviews
☑ View All Candidates
☑ Delete Interviews
☑ Manage Questions
☐ Manage Users (admin only)
☐ Change Pricing (admin only)
```

**🎬 Action:**
- **Default permissions are good** for most cases
- Only change if you need custom role behavior

---

### 5. **Chatbot Management** `/chatbot-management`
**💬 Train Your AI Assistant**

**What You See:**
- Knowledge base articles
- Question-answer pairs
- Categories

**What You Configure:**
```
Example Knowledge Entry:
┌─────────────────────────────────────┐
│ Category: Getting Started           │
│ Question: How do I create interview?│
│ Answer: Go to Create Interview...   │
│ Tags: interview, create, guide      │
│ Active: ☑ Yes                       │
└─────────────────────────────────────┘
```

**🎬 Action:**
- Add knowledge articles about your platform
- Train chatbot to answer common questions
- **Optional** - Works without this too

---

### 6. **Organization Management** `/organization-management`
**🏢 Approve & Manage Organizations**

**What You See:**
- List of all organizations
- Status (pending/active/suspended)
- Approve/reject buttons

**What You Configure:**
- Approve new organization signups
- Assign subscription plans
- Suspend/reactivate orgs
- View org details

**🎬 Action:**
- **Wait for organizations to sign up**
- Review and approve them
- Assign a subscription plan (from your pricing)

---

### 7. **User Management** `/unified-user-management`
**👤 Manage All Users Across Platform**

**What You See:**
- List of all users
- Their roles and organizations
- Add/edit/deactivate buttons

**What You Configure:**
- Create new users manually
- Assign roles
- Assign to organizations
- Send password setup emails

**🎬 Action:**
- Add test users to try the platform
- Assign different roles to test
- **Users can also self-signup**

---

### 8. **Lovable Cloud Secrets** (External)
**🔐 Sensitive API Keys**

**Where:** Lovable Dashboard → Project Settings → Secrets

**What You Configure:**

| Secret Name | What It's For | Status | Where to Get |
|-------------|---------------|--------|--------------|
| GOOGLE_GEMINI_API_KEY | Google AI | ✅ Set | console.cloud.google.com |
| RESEND_API_KEY | Auth & Application emails | ⚠️ Required | resend.com |
| STRIPE_SECRET_KEY | Payments | ❌ Not set | stripe.com |

**🎬 Action:**
1. Go to Lovable Cloud dashboard
2. Open your project
3. Go to Settings → Secrets
4. Add `RESEND_API_KEY` (required for auth emails)

---

### 9. **Auth Email Templates** (Database-Managed)
**📧 Authentication Emails (Verification, Password Reset, etc.)**

**Where:** Managed in `email_templates` table via Email Template Editor

**What You Configure:**

| Template Key | Purpose | Editable |
|--------------|---------|----------|
| auth_email_verification | Email verification on signup | ✅ Yes |
| auth_password_recovery | Password reset emails | ✅ Yes |
| auth_magic_link | Magic link login emails | ✅ Yes |
| auth_invite | User invitation emails | ✅ Yes |
| auth_email_change | Email change confirmation | ✅ Yes |

**Available Variables:**
- `{{platform_name}}` - Your platform name
- `{{user_name}}` - Recipient's name
- `{{verify_url}}` - Action URL
- `{{email}}` - User's email address

**🎬 Action:**
1. Go to Email Template Editor (Platform Settings → Email)
2. Find templates starting with "Auth:"
3. Customize subject, styling, and content
4. Save changes

**How It Works:**
The `auth-email-hook` edge function fetches templates from the database and sends branded emails via Resend for all authentication actions.

---

## 🔄 LOVABLE MANAGED vs YOU CONTROL

### ⛔ **You CANNOT Configure** (Lovable Manages)

| Item | Why You Can't Change | Managed By |
|------|---------------------|------------|
| Database structure | Auto-generated from code | Lovable Cloud |
| Environment variables (.env) | Auto-managed | Lovable Cloud |
| Supabase URLs | Project-specific | Lovable Cloud |
| SSL certificates | Auto-provisioned | Lovable Cloud |
| Hosting infrastructure | Cloud platform | Lovable Cloud |

**💡 Think of this like:**
- Lovable = The building and electricity
- You = The furniture and decorations

---

### ✅ **You CAN Configure** (Your Control)

| What | Where | Why You Control |
|------|-------|-----------------|
| AI models | Platform Settings | Business decision |
| Pricing plans | Pricing Management | Your business model |
| Scoring rules | Platform Settings | Your evaluation criteria |
| Email settings | Platform Settings | Your email service |
| Permissions | Role Permissions | Your security rules |
| Content | Various pages | Your knowledge base |

---

## 📋 CONFIGURATION CHECKLIST

### Before You Launch

#### ✅ Mandatory (Do These First)
- [ ] **Add Email API Key** → Platform Settings → Email tab
- [ ] **Create 3 Subscription Plans** → Pricing Management
- [ ] **Test Interview Creation** → Create Interview page
- [ ] **Add Test Organization** → Organization Management
- [ ] **Assign Test Users** → User Management

#### ⚠️ Recommended (Do These Soon)
- [ ] Review AI Configuration → Check models
- [ ] Review Difficulty Rules → Adjust if needed
- [ ] Review CPI Weights → Adjust if needed
- [ ] Add Chatbot Knowledge → Help users
- [ ] Review Role Permissions → Customize if needed

#### ⭕ Optional (Do Later)
- [ ] Enable Stripe for real payments
- [ ] Add SSO/SAML (enterprise feature)
- [ ] Configure ATS integrations
- [ ] Set up custom branding

---

## 🎯 YOUR FIRST 30 MINUTES

**Goal:** Get platform ready for first organization

### Step 1: Email Setup (5 min)
1. Go to resend.com
2. Create free account
3. Get API key
4. Go to `/platform-settings` → Email Configuration
5. Paste API key, set from address
6. Save

### Step 2: Create Pricing (10 min)
1. Go to `/pricing-management`
2. Create "Free" plan:
   - $0/month
   - 10 interviews
   - 5 users
3. Create "Pro" plan:
   - $99/month
   - 100 interviews
   - 20 users
4. Create "Enterprise" plan:
   - $499/month
   - Unlimited
   - Unlimited
5. Save all plans

### Step 3: Test Interview (10 min)
1. Go to `/create-interview`
2. Fill in job title: "Test Position"
3. Set 10 questions, 30 minutes
4. Let AI generate questions
5. Save interview
6. Copy share link

### Step 4: Create Test Org (5 min)
1. Go to `/organization-management`
2. Click "Add Organization"
3. Name: "Test Company"
4. Assign "Free" plan
5. Create test user as admin
6. Send password setup email

**🎉 Done! You now have:**
- ✅ Working email system
- ✅ Pricing structure
- ✅ Sample interview
- ✅ Test organization

---

## 🆘 QUICK HELP

**"Where do I add my pricing?"**
→ `/pricing-management`

**"Where do I configure email?"**
→ `/platform-settings` → Email Configuration tab

**"Where do I add API keys?"**
→ Lovable Cloud → Project → Settings → Secrets

**"Where do I approve organizations?"**
→ `/organization-management`

**"Where do I manage all users?"**
→ `/unified-user-management`

**"What can't I change?"**
→ Database structure, environment variables, Supabase config (Lovable manages these)

**"What should I change first?"**
→ Email API key, then pricing plans

---

## 📊 CONFIGURATION DECISION TREE

```
Do you need to change it?
│
├─ Is it SENSITIVE (API key, password)?
│  └─ YES → Lovable Cloud Secrets
│
├─ Is it PRICING or PLANS?
│  └─ YES → Pricing Management page
│
├─ Is it AI BEHAVIOR?
│  └─ YES → AI Configuration page
│
├─ Is it SCORING RULES?
│  └─ YES → Platform Settings → Difficulty/CPI tabs
│
├─ Is it EMAIL SETUP?
│  └─ YES → Platform Settings → Email tab
│
├─ Is it USER PERMISSIONS?
│  └─ YES → Role Permissions page
│
├─ Is it DATABASE/INFRASTRUCTURE?
│  └─ NO → Lovable manages this (you can't change)
│
└─ EVERYTHING ELSE
   └─ Check Platform Settings first
```

---

## 🎓 UNDERSTANDING THE FLOW

### When Organization Signs Up:
1. **They do:** Fill signup form → Choose plan (from YOUR pricing)
2. **You do:** Review at `/organization-management` → Approve
3. **System does:** Creates org, sends welcome email, enables features per plan

### When They Create Interview:
1. **They do:** Go to `/create-interview` → Fill details
2. **System does:** Uses YOUR AI settings and difficulty rules
3. **They do:** Share link with candidates

### When Candidate Takes Interview:
1. **Candidate:** Clicks link → Takes interview
2. **System:** Uses YOUR CPI weights and scoring
3. **System:** Proctors per YOUR retention settings
4. **System:** Evaluates with YOUR AI model
5. **Recruiter:** Sees report

**YOUR configurations flow through the entire process!**

---

This is your control panel. Focus on the 8 configuration pages above, and everything else will work automatically! 🚀
