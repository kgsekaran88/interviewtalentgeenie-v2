# Role-Based Access Control (RBAC) System

## Overview
This document outlines the role-based permissions matrix for our AI-driven Interview Platform. The system uses hierarchical roles with organization-level data isolation to ensure secure, multi-tenant operations.

## Key Principles
- **Organization-Based Access**: All users (except platform_admin) must be linked to an organization
- **Platform Admin**: Linked to a "platform" organization with unrestricted access across ALL organizations
- **Partner Admin**: Gains `partner_admin` role upon partner registration for THEIR organization only
- **Multiple Roles**: Users can hold multiple roles simultaneously
- **Security**: All role checks are server-side validated with proper RLS policies

---

## Core Roles

### 1. Platform Admin (Super Admin)
**Level:** Platform-wide  
**Scope:** Unrestricted access across ALL organizations

**Organization Linkage:** Linked to a special "platform" organization with no restrictions

**How Assigned:** Can be assigned during partner registration or by existing platform_admin

**Permissions:**
- ✅ Manage ALL organizations and their data
- ✅ Create, update, delete any organization
- ✅ Manage ALL users across platform
- ✅ Assign/revoke/add/rename/delete any role to any user in any organization
- ✅ Access all audit logs and security events
- ✅ Configure platform-wide settings and features
- ✅ Manage subscription plans and pricing
- ✅ View cross-organization analytics
- ✅ Access all billing information
- ✅ Override organization-level restrictions
- ✅ Manage platform integrations
- ✅ Configure global RBAC rules
- ✅ Access ALL interview questions from ALL organizations
- ✅ View and manage global question repository
- ✅ No access restrictions whatsoever

**Primary Access:**
- Platform admin dashboard
- Global user management
- Organization management
- Role management (across all orgs)
- System settings
- Audit logs
- Platform analytics
- Global question repository

---

### 2. Partner Admin (Organization Admin)
**Level:** Organizational  
**Scope:** Full control over ONE organization

**How Assigned:** Automatically granted `partner_admin` role for the email used during partner registration

**Permissions:**
- ✅ Manage all users within their organization
- ✅ Assign/revoke/add/rename/delete roles for organization members
- ✅ View and manage organization settings
- ✅ Access organization billing and subscription
- ✅ View ALL interviews and assessments in their org
- ✅ Access organization analytics and reports
- ✅ Manage organization-level integrations
- ✅ Configure organization preferences
- ✅ View ALL candidate assessments in their org
- ❌ Access other organizations' data
- ❌ Manage platform-wide settings
- ❌ View cross-organization analytics
- ❌ Access question repository directly

**Primary Access:**
- Organization dashboard
- User management (org-specific)
- Role management (org-specific)
- Billing management (org-specific)
- Organization settings
- All organization interviews and data

---

### 3. HR Recruiter (Recruitment Focus)
**Level:** Organizational  
**Scope:** Organization-specific recruitment operations

**Permissions:**
- ✅ Create recruitment interviews using AI
- ✅ View ALL interviews in their organization (created by any HR Recruiter)
- ✅ Access candidate assessments **they created only**
- ✅ View proctoring reports for their interviews
- ✅ Schedule and invite candidates
- ✅ Generate interview links
- ✅ View interview analytics for own content
- ✅ Collaborate with other HR Recruiters in same org (view interviews)
- ❌ Manage billing or users
- ❌ Approve questions (requires Tech SPOC)
- ❌ Access organization settings
- ❌ View other HR Recruiters' candidate assessments

**Primary Access:**
- Interview creation dashboard
- Candidate management (own candidates only)
- Proctoring dashboard (own interviews)
- Scheduling tools
- Organization interview library (view only)

---

### 4. Tech SPOC (Technical Point of Contact)
**Level:** Organizational  
**Scope:** Organization-specific technical assessment validation

**Permissions:**
- ✅ Review and approve questions from HR Recruiters in their organization
- ✅ Validate technical accuracy of interview questions
- ✅ Suggest modifications to questions
- ✅ Regenerate questions if needed
- ✅ Access question repository ONLY for review/approval purposes
- ✅ Provide feedback on question quality
- ✅ View questions pending approval in their organization
- ❌ Create interviews directly
- ❌ Manage billing or users
- ❌ Access other organizations' content
- ❌ Direct access to question repository (only review workflow)

**Primary Access:**
- Question review/approval dashboard
- Pending questions queue
- Quality assurance tools

---

### 5. Interviewer
**Level**: Interview Conductor  
**Scope**: Own interviews only

**Permissions**:
- ✅ Create interviews
- ✅ Manage their own interviews only
- ✅ Send interview share links
- ✅ View results for interviews they created
- ✅ Access proctoring data for their interviews
- ✅ Use AI evaluation features
- ✅ Generate reports for their candidates
- ✅ Provide panel evaluations and feedback
- ❌ Cannot view other interviewers' content
- ❌ Cannot access organization-wide data
- ❌ Cannot manage users or settings

**Access**:
- Interview Creation (own only)
- Own Interview Dashboard
- Candidate Reports (own interviews)
- Proctoring Monitor (own interviews)

---

### 6. Candidate
**Level**: Assessment Taker  
**Scope**: Assigned assessments only

**Permissions**:
- ✅ Access interviews via secure share links
- ✅ Take assigned assessments
- ✅ View own assessment results (if permitted)
- ✅ Use AI learning coach (if enabled)
- ✅ Complete pre-interview checks
- ✅ Submit responses and code
- ❌ Cannot create interviews
- ❌ Cannot view other candidates' data
- ❌ Cannot access any administrative features

**Access**:
- Interview Taking Interface
- Assessment Submission
- Personal Results (if shared)
- Learning Resources

---

## Optional Roles

### 7. Billing Contact
**Level**: Finance Role  
**Scope**: Organization billing only

**Permissions**:
- ✅ View organization billing information
- ✅ Access invoices and payment history
- ✅ Update payment methods
- ✅ View usage tracking and limits
- ✅ Download financial reports
- ❌ Cannot create interviews or access assessments
- ❌ Cannot manage users
- ❌ No operational permissions

**Access**:
- Billing Dashboard
- Invoice Management
- Payment Settings
- Usage Reports

---

### 8. Guest
**Level**: Limited Observer  
**Scope**: Read-only, limited access

**Permissions**:
- ✅ View public content (if enabled)
- ✅ View assigned demo interviews
- ❌ Cannot create or modify anything
- ❌ No access to sensitive data
- ❌ Cannot take actual assessments

**Access**:
- Landing page
- Public resources
- Limited demo content

---

## Role Hierarchy

```
Platform Admin (Super User)
    ├── Partner Admin (Org Admin)
    │   ├── HR Recruiter (Recruitment)
    │   ├── TA Creator (Technical Assessments)
    │   └── Interviewer (Own Interviews)
    │       └── Candidate (Takes Assessments)
    ├── Billing Contact (Finance)
    └── Guest (Observer)
```

---

## Access Control Summary

| Feature | Platform Admin | Partner Admin | HR Recruiter | TA Creator | Interviewer | Candidate | Billing Contact | Guest |
|---------|----------------|---------------|--------------|------------|-------------|-----------|-----------------|-------|
| Manage Organizations | ✅ | Own only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ✅ (org) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign Roles | ✅ | ✅ (org) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Interviews | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Interviews | ✅ | ✅ (org) | ✅ (org) | Own | Own | ❌ | ❌ | ❌ |
| Take Assessments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Limited |
| View Proctoring | ✅ | ✅ (org) | ✅ (org) | Own | Own | ❌ | ❌ | ❌ |
| Access Billing | ✅ | ✅ (org) | ❌ | ❌ | ❌ | ❌ | ✅ (org) | ❌ |
| Platform Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Organization Settings | ✅ | ✅ (org) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AI Features | ✅ | ✅ | ✅ | ✅ | ✅ | Limited | ❌ | ❌ |
| Analytics | ✅ (all) | ✅ (org) | ✅ (org) | Own | Own | Own | ❌ | ❌ |

---

## Security Notes

1. **Organization Linkage**: ALL users must be linked to an organization (platform_admin linked to "platform" org)
2. **Multi-Tenancy**: All data is isolated by organization_id with strict RLS policies
3. **Server-Side Validation**: All role checks use security definer functions (never client-side)
4. **Audit Trails**: All privileged actions are logged with user_id, timestamp, and metadata
5. **Principle of Least Privilege**: Users only get access to what they need for their role
6. **Role Stacking**: Users can have multiple roles, inheriting permissions from all assigned roles
7. **Partner Registration**: New partners automatically get `partner_admin` role (NOT `platform_admin`)

---

## Common Role Combinations

- **Small Team Setup**: Partner Admin + Interviewer
- **Recruitment Team**: Partner Admin + HR Recruiter + Interviewer
- **Technical Team**: Partner Admin + TA Creator + Interviewer
- **Enterprise Setup**: Partner Admin + HR Recruiter + TA Creator + Interviewer + Billing Contact

---

## Migration from Legacy Roles

| Legacy Role | Maps To | Notes |
|------------|---------|-------|
| admin | platform_admin | Super admin privileges |
| hr | hr_recruiter | Recruitment-focused |
| technical_spoc | tech_spoc | Question validation (renamed from ta_creator) |
| ta_creator | tech_spoc | Role renamed for clarity |
| interviewer | interviewer | No change |
| candidate | candidate | No change |

---

*Last Updated: November 2025*
*Version: 2.0 (Post-Consolidation)*
