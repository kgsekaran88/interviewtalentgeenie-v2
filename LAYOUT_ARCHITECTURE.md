# Layout Architecture Guide

## Overview
This project uses a hierarchical layout system to prevent duplicate navigation bars and ensure consistent UI structure.

## Layout Hierarchy

```
AppLayout (Base)
├── AppNavbar
├── RoleBreadcrumbs
└── Page Content

Hierarchical Layouts (Inherit AppNavbar + RoleBreadcrumbs)
├── AdminLayout
├── PartnerLayout (includes Recruiting)
├── InterviewerLayout
└── CandidateLayout
```

## Rules

### ✅ DO
- Use `AppLayout` for public pages (Landing, Auth, etc.)
- Use hierarchical layouts (AdminLayout, etc.) for role-protected pages
- Let the layout wrapper in `App.tsx` handle the layout structure

### ❌ DON'T
- Never wrap pages with `AppLayout` if they're already in a hierarchical layout
- Don't manually add `AppNavbar` to pages (it's in the layout)
- Don't create nested layout wrappers

## Layout Assignments

### AdminLayout Pages
- PlatformAdminHub
- OrganizationsList
- UnifiedUserManagement
- RoleAssignment
- AdvancedAnalytics
- PlatformSettings
- AdminTraining
- AutomatedTestSuite
- PerformanceBenchmark
- TestingHub
- PlatformAdminHub

### PartnerLayout Pages
- **Partner Management:**
  - OrganizationSettings
  - OrganizationAnalytics
  - OrganizationManagement
  - BillingManagement
  - PartnerPortal
  
- **Recruiting (Under Partner):**
  - CreateInterview (`/partner/recruiting/create-interview`)
  - Dashboard/Interviews (`/partner/recruiting/interviews`)
  - InterviewDetail (`/partner/recruiting/interview/:id`)
  - AssessmentReport (`/partner/recruiting/assessment/:id`)
  - ProctoringDashboard (`/partner/recruiting/proctoring`)
  - ProctoringSettings (`/partner/recruiting/proctoring-settings`)
  - QuestionRepository (`/partner/recruiting/question-repository`)
  - TemplatesLibrary (`/partner/recruiting/templates`)
  - ReportBuilder (`/partner/recruiting/report-builder`)

### InterviewerLayout Pages
- Dashboard
- InterviewDetail

### CandidateLayout Pages
- MyApplications
- Learning
- MyLearningPlan

## Development Safeguards

### 1. ESLint Rule
Custom rule `no-duplicate-layout-wrapper` prevents importing AppLayout in hierarchical pages.

```bash
# Will show error if you try to import AppLayout in hierarchical pages
import { AppLayout } from "@/components/AppLayout"; // ❌ Error!
```

### 2. Runtime Guard Hook
Use `useLayoutGuard` in development to detect duplicate layouts:

```typescript
import { useLayoutGuard } from '@/hooks/useLayoutGuard';

export const MyPage = () => {
  useLayoutGuard('AdminLayout'); // Checks for duplicates in dev mode
  // ...
};
```

### 3. Data Attributes
AppNavbar has `data-component="app-navbar"` for detection.

## Page Template

```typescript
// ✅ Correct - No AppLayout wrapper
import { SomeComponent } from '@/components/SomeComponent';

export const MyHierarchicalPage = () => {
  return (
    <div>
      <h1>Page Title</h1>
      {/* Page content */}
    </div>
  );
};

// ❌ Wrong - Don't wrap with AppLayout
import { AppLayout } from '@/components/AppLayout';

export const MyHierarchicalPage = () => {
  return (
    <AppLayout> {/* This causes duplicate navbar! */}
      <div>
        <h1>Page Title</h1>
      </div>
    </AppLayout>
  );
};
```

## Testing
Run ESLint to check for violations:
```bash
npm run lint
```

## References
- See `DUPLICATE_NAVBAR_FIX.md` for the history of this refactoring
- Check `eslint-rules/no-duplicate-layout-wrapper.js` for the custom rule implementation
