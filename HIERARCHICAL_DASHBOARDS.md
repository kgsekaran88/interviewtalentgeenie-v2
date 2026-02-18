# Hierarchical Dashboard Structure

## Overview
The application now uses a hierarchical dashboard structure with role-based access control (RBAC) enforced at the layout level. This provides better organization, clearer access control, and improved user experience.

## Route Structure

### Platform Admin Routes (`/admin/*`)
**Access:** `platform_admin` role only

Layout enforces RBAC through `AdminLayout` component.

**Main Hub:** `/admin` or `/admin/hub`
- Centralized dashboard with categorized sections
- Quick access to all administrative functions

**Available Routes:**
- `/admin/dashboard` - Platform Admin Dashboard
- `/admin/partner-management` - Manage Partner Organizations
- `/admin/user-management` - Manage All Users
- `/admin/role-assignment` - Configure Roles & Permissions
- `/admin/analytics` - Platform-wide Analytics
- `/admin/pricing-management` - Billing & Subscriptions
- `/admin/settings` - Platform Settings
- `/admin/training` - Training Management
- `/admin/automated-tests` - Automated Test Suite
- `/admin/performance-benchmark` - Performance Benchmarking
- `/admin/testing-hub` - Testing Hub
- `/admin/test-management` - Test Management

### Partner Admin Routes (`/partner/*`)
**Access:** `partner_admin` or `platform_admin` roles

Layout enforces RBAC through `PartnerLayout` component.

**Main Portal:** `/partner` or `/partner/portal`

**Available Routes:**
- `/partner/portal` - Partner Dashboard
- `/partner/settings` - Organization Settings
- `/partner/analytics` - Organization Analytics
- `/partner/users` - Organization User Management
- `/partner/manage/:organizationId` - Manage Specific Organization
- `/partner/billing` - Billing Management
- `/partner/onboarding` - Partner Onboarding (public)

### Recruiter Routes (`/recruiter/*`)
**Access:** `hr_recruiter`, `partner_admin`, or `platform_admin` roles, OR users with recruiter permissions

Layout enforces RBAC through `RecruiterLayout` component.

**Available Routes:**
- `/recruiter/create-interview` - Create New Interview
- `/recruiter/interviews` - View All Interviews
- `/recruiter/interview/:id` - Interview Details
- `/recruiter/assessment/:id` - Assessment Report
- `/recruiter/proctoring` - Proctoring Dashboard
- `/recruiter/question-repository` - Question Repository
- `/recruiter/templates` - Templates Library
- `/recruiter/report-builder` - Report Builder

### Interviewer Routes (`/interviewer/*`)
**Access:** `interviewer`, `tech_spoc`, `partner_admin`, or `platform_admin` roles, OR users with interviewer permissions

Layout enforces RBAC through `InterviewerLayout` component.

**Available Routes:**
- `/interviewer/create-interview` - Create New Interview
- `/interviewer/interviews` - View Assigned Interviews
- `/interviewer/interview/:id` - Interview Details
- `/interviewer/assessment/:id` - Assessment Report
- `/interviewer/proctoring` - Proctoring Dashboard
- `/interviewer/question-repository` - Question Repository
- `/interviewer/templates` - Templates Library

### Candidate Routes (`/candidate/*`)
**Access:** `candidate` role only

Layout enforces RBAC through `CandidateLayout` component.

**Available Routes:**
- `/candidate/applications` - My Applications
- `/candidate/learning` - Learning Modules
- `/candidate/learning-plan` - My Learning Plan

## Permission-Based Access

Each layout component checks:
1. **System Roles** - Traditional role-based access (`platform_admin`, `partner_admin`, etc.)
2. **Custom Role Permissions** - Granular permissions assigned through custom roles
3. **Hierarchical Access** - Higher-level roles (e.g., `platform_admin`) can access lower-level routes

Example from `RecruiterLayout`:
```typescript
const hasAccess = isHRRecruiter || isPartnerAdmin || isPlatformAdmin || 
  hasAnyPermission(['create_interviews', 'view_candidates', 'manage_interviews']);
```

## Backward Compatibility

All legacy routes still work and redirect appropriately. Users accessing old URLs will be seamlessly redirected to the hierarchical structure.

Examples:
- `/create-interview` → Works with role check (legacy)
- `/user-management` → Works with role check (legacy)
- `/platform-admin` → Works with role check (legacy)

## Benefits

### 1. **Clear Access Control**
- RBAC enforced at layout level
- Single point of authorization per role hierarchy
- Reduces code duplication

### 2. **Better Organization**
- Logical grouping by user role
- Easier to understand application structure
- Clearer navigation paths

### 3. **Improved Maintainability**
- Centralized layout management
- Easier to add new routes within role hierarchies
- Consistent structure across application

### 4. **Enhanced Security**
- Layout-level checks prevent unauthorized access
- Permission-based access alongside role-based access
- Support for custom roles and permissions

### 5. **Better UX**
- Role-specific navigation
- Contextual breadcrumbs
- Reduced navigation clutter

## Implementation Details

### Layout Components
Each role hierarchy has a dedicated layout component:
- `AdminLayout` - Platform admin functionality
- `PartnerLayout` - Partner admin functionality  
- `RecruiterLayout` - HR recruiter functionality
- `InterviewerLayout` - Interviewer functionality
- `CandidateLayout` - Candidate functionality

### Access Control Flow
```
User Request
    ↓
Layout Component
    ↓
Check Roles/Permissions via useUserRoles & usePermissions
    ↓
Grant Access OR Redirect to Dashboard
    ↓
Render Child Routes/Components
```

### Permission System Integration
The hierarchical structure integrates with the granular permission system defined in `src/lib/permissions.ts`:
- System roles have predefined permissions
- Custom roles can mix and match permissions
- Layouts check both role membership AND permission grants

## Migration Guide

For developers updating existing functionality:

1. **Adding a new admin route:**
   ```tsx
   <Route path="/admin/new-feature" element={<NewFeature />} />
   ```

2. **Adding a new partner route:**
   ```tsx
   <Route path="/partner/new-feature" element={<NewFeature />} />
   ```

3. **Using permission checks in components:**
   ```tsx
   import { PermissionGate } from '@/components/PermissionGate';
   
   <PermissionGate permissions={['create_interviews']}>
     <CreateInterviewButton />
   </PermissionGate>
   ```

## Future Enhancements

Potential improvements to consider:
- [ ] Add role-specific sidebars within each layout
- [ ] Implement breadcrumb navigation within hierarchies
- [ ] Add quick-switch between hierarchies for multi-role users
- [ ] Create role-specific dashboards with personalized widgets
- [ ] Implement analytics tracking per role hierarchy
