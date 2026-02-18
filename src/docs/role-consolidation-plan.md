# Role Consolidation Plan

## Executive Summary

This document outlines a strategic plan to consolidate the current 11 roles into 6 core roles, reducing complexity while maintaining all necessary access controls and functionality.

---

## Current State Analysis

### Existing Roles (11 Total)

| Role | Usage | Primary Function | Status |
|------|-------|-----------------|--------|
| `platform_admin` | ✅ Active | Platform-wide administration | **Keep** |
| `partner_admin` | ✅ Active | Organization administration | **Keep** |
| `hr_recruiter` | ✅ Active | Hiring and recruiting | **Keep** |
| `ta_creator` | ✅ Active | Assessment creation | **Keep** |
| `interviewer` | ✅ Active | Interview management | **Keep** |
| `candidate` | ✅ Active | Taking assessments | **Keep** |
| `admin` | ⚠️ Legacy | Overlaps with platform_admin | **Merge** |
| `hr` | ⚠️ Legacy | Overlaps with hr_recruiter | **Merge** |
| `billing_contact` | ❓ Minimal | Payment management | **Evaluate** |
| `guest` | ❓ Minimal | Limited access | **Evaluate** |
| `user` | ❓ Generic | Basic authenticated user | **Remove** |

### Identified Issues

1. **Role Redundancy**: `admin` ≈ `platform_admin`, `hr` ≈ `hr_recruiter`
2. **Confusion**: Similar names cause developer and user confusion
3. **Maintenance Overhead**: 74 files reference these roles
4. **Inconsistent Enforcement**: Some pages check multiple equivalent roles

---

## Proposed Role Structure (6 Core Roles)

### 1. **platform_admin** - Platform Administrator
- **Inherits from**: `admin` (legacy)
- **Permissions**: Full system access, user management, pricing control
- **Access**: All platform features, analytics, system settings

### 2. **partner_admin** - Organization Administrator  
- **Permissions**: Org settings, team management, billing oversight
- **Access**: Organization dashboard, team management, subscription control

### 3. **hr_recruiter** - HR & Recruitment Manager
- **Inherits from**: `hr` (legacy)
- **Permissions**: Create/manage interviews, view candidates, hiring decisions
- **Access**: Interview creation, candidate pipeline, reports

### 4. **ta_creator** - Technical Assessment Creator
- **Permissions**: Question creation, test design, template management
- **Access**: Question repository, template library, assessment builder

### 5. **interviewer** - Interviewer/Evaluator
- **Permissions**: Conduct interviews, evaluate candidates, provide feedback
- **Access**: Interview sessions, candidate responses, scoring

### 6. **candidate** - Job Candidate
- **Permissions**: Take assessments, view own results
- **Access**: Assigned interviews, personal dashboard, feedback reports

### Roles to Remove/Merge

- ❌ **user** - Remove (too generic, no clear purpose)
- 🔀 **admin** → Merge into `platform_admin`
- 🔀 **hr** → Merge into `hr_recruiter`
- ❓ **billing_contact** - Evaluate usage, potentially merge into `partner_admin`
- ❓ **guest** - Evaluate usage, potentially remove or keep for demo access

---

## Migration Strategy

### Phase 1: Preparation (Week 1)
**Goal**: Set up infrastructure for safe migration

✅ **Tasks**:
1. Create `role_migration_log` table to track changes
2. Create database function `migrate_user_role(user_id, old_role, new_role)`
3. Add `is_legacy` flag to `user_roles` table
4. Create backup of current role assignments

```sql
-- Migration tracking table
CREATE TABLE role_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  migrated_at TIMESTAMPTZ DEFAULT now(),
  migrated_by UUID REFERENCES auth.users(id)
);
```

### Phase 2: Backend Migration (Week 2)
**Goal**: Update database policies and functions

✅ **Tasks**:
1. Update RLS policies to accept both old and new roles temporarily
2. Create role mapping function: `get_effective_role(user_id)`
3. Update database triggers to use new role names
4. Test all database operations with both role sets

**Example Policy Update**:
```sql
-- Temporary dual-role support
CREATE POLICY "hr_can_view_interviews"
ON interviews FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM user_roles 
    WHERE role IN ('hr_recruiter', 'hr') -- Support both
  )
);
```

### Phase 3: Frontend Migration (Week 3-4)
**Goal**: Update all UI components and route guards

✅ **Tasks by Area**:

#### 3.1 Update Route Protection (16 files)
- Replace: `hasRole(['admin', 'platform_admin'])` → `hasRole(['platform_admin'])`
- Replace: `hasRole(['hr', 'hr_recruiter'])` → `hasRole(['hr_recruiter'])`

**Files to Update**:
- `src/components/ProtectedRoute.tsx`
- `src/pages/*.tsx` (all protected pages)

#### 3.2 Update Navigation & UI (12 files)
- `src/components/AppSidebar.tsx`
- `src/components/AppNavigation.tsx`
- `src/hooks/useRoleBreadcrumbs.ts`

#### 3.3 Update Business Logic (46 files)
- All files in `src/pages/` that check roles
- Update conditional rendering based on roles
- Update role assignment dropdowns

### Phase 4: Data Migration (Week 5)
**Goal**: Migrate existing user role assignments

✅ **Migration Script**:
```sql
-- Migrate admin → platform_admin
UPDATE user_roles 
SET role = 'platform_admin', is_legacy = false
WHERE role = 'admin';

-- Migrate hr → hr_recruiter  
UPDATE user_roles
SET role = 'hr_recruiter', is_legacy = false
WHERE role = 'hr';

-- Log migrations
INSERT INTO role_migration_log (user_id, old_role, new_role)
SELECT user_id, 'admin', 'platform_admin' 
FROM user_roles WHERE role = 'admin';

-- Remove unused roles
DELETE FROM user_roles WHERE role = 'user';
```

### Phase 5: Cleanup (Week 6)
**Goal**: Remove legacy code and finalize

✅ **Tasks**:
1. Remove dual-role support from RLS policies
2. Remove legacy role checks from code
3. Update documentation
4. Remove `is_legacy` flag
5. Drop `role_migration_log` table (after backup)

---

## Implementation Checklist

### Pre-Migration
- [ ] Backup entire database
- [ ] Document all current role assignments (export CSV)
- [ ] Create rollback plan
- [ ] Test in staging environment

### During Migration  
- [ ] Monitor error logs continuously
- [ ] Keep communication channel open with users
- [ ] Have rollback script ready
- [ ] Test each phase before proceeding

### Post-Migration
- [ ] Verify all users can access their assigned features
- [ ] Run automated tests on all protected routes
- [ ] Update user documentation
- [ ] Archive legacy role documentation
- [ ] Monitor for 2 weeks for any issues

---

## Risk Assessment

### High Risk Areas
1. **Authentication Failures**: Users locked out if migration fails
   - **Mitigation**: Keep dual-role support during transition
   
2. **Data Access Issues**: Users can't see their data with new roles
   - **Mitigation**: Test RLS policies extensively before migration

3. **Application Crashes**: Hard-coded role checks cause errors
   - **Mitigation**: Search codebase for all role references

### Medium Risk Areas
1. **Permission Creep**: Users gain unintended access
   - **Mitigation**: Review all RLS policies post-migration
   
2. **Lost Functionality**: Features become inaccessible
   - **Mitigation**: Comprehensive testing checklist

### Low Risk Areas
1. **UI Inconsistencies**: Role names display incorrectly
   - **Mitigation**: Easy fix, won't break functionality

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback (< 1 hour)
```sql
-- Restore from role_migration_log
UPDATE user_roles ur
SET role = ml.old_role
FROM role_migration_log ml
WHERE ur.user_id = ml.user_id 
AND ur.role = ml.new_role;
```

### Full Rollback (< 4 hours)
1. Restore database from pre-migration backup
2. Redeploy previous code version
3. Clear application cache
4. Notify affected users

---

## Testing Strategy

### Unit Tests
- [ ] Test `get_effective_role()` function
- [ ] Test role migration function
- [ ] Test RLS policies with new roles

### Integration Tests  
- [ ] Test login with each role type
- [ ] Test navigation access per role
- [ ] Test CRUD operations per role

### User Acceptance Tests
- [ ] Platform admin can access all features
- [ ] Partner admin can manage their org
- [ ] HR recruiter can create interviews
- [ ] Candidates can take assessments

---

## Timeline Summary

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| Phase 1: Preparation | 1 week | Migration infrastructure ready |
| Phase 2: Backend | 1 week | Database policies updated |
| Phase 3: Frontend | 2 weeks | All UI components updated |
| Phase 4: Data Migration | 1 week | User roles migrated |
| Phase 5: Cleanup | 1 week | Legacy code removed |
| **Total** | **6 weeks** | **Complete consolidation** |

---

## Success Metrics

### Quantitative
- ✅ Reduce from 11 roles to 6 roles (45% reduction)
- ✅ Reduce role-checking code by ~30%
- ✅ Zero authentication errors post-migration
- ✅ 100% feature accessibility maintained

### Qualitative  
- ✅ Clearer role definitions for developers
- ✅ Easier onboarding for new team members
- ✅ Simplified permission management
- ✅ Better user experience (less confusion)

---

## Next Steps

1. **Review & Approve** this plan with stakeholders
2. **Schedule** migration for low-traffic period
3. **Assign** tasks to development team
4. **Communicate** timeline to users
5. **Begin** Phase 1 preparation

---

## Questions & Decisions Needed

1. **Billing Contact**: Keep separate or merge into `partner_admin`?
2. **Guest Role**: Remove entirely or keep for demo/trial access?
3. **Migration Window**: Weekend deployment or gradual rollout?
4. **Downtime**: Can we afford any downtime or must be zero-downtime?

---

## Contact

For questions about this consolidation plan:
- Technical Lead: [Assign]
- Project Manager: [Assign]  
- Timeline: 6 weeks starting [TBD]

---

*Document Version: 1.0*  
*Last Updated: 2025-11-11*  
*Status: Draft - Awaiting Approval*
