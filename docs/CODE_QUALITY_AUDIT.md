# 🔍 Code Quality Audit — March 2026

**Scope**: All files under `src/` — components, pages, hooks, utils, integrations  
**Focus**: TypeScript safety, component architecture, performance, error handling, best practices

---

## 1. Executive Summary

| Category | Status | Count | Severity |
|----------|--------|-------|----------|
| `any` type usage | 🔴 Poor | 732 instances across 301 files | 🟡 MEDIUM |
| Monolith components (>300 LOC) | 🟠 Needs work | 12+ files | 🟡 MEDIUM |
| `React.memo` usage | 🔴 Missing | ~1 instance (nearly zero) | 🟢 LOW |
| `catch (error: any)` pattern | 🟠 Pervasive | 100+ instances | 🟡 MEDIUM |
| Error boundaries | ✅ Good | App + section level | — |
| Logger abstraction | ✅ Good | Proper utility | — |
| ESLint compliance | ✅ Good | 1 disable | — |
| TODO/FIXME markers | ✅ Clean | 0 instances | — |
| Input validation | ✅ Strong | 12 Zod schemas | — |

---

## 2. 🔴 `any` Type Usage — 732 Instances Across 301 Files

### 2.1 Impact

The pervasive use of `any` creates:
- **Type-safety holes** — runtime errors that TypeScript should catch at compile time
- **Masked exceptions** — `catch (error: any)` hides error type information
- **Schema drift** — `as any` casts on database operations hide mismatches between the Supabase type definitions and actual usage
- **Security blind spots** — untrusted data cast to `any` bypasses type checking that could catch injection or malformed input

### 2.2 Top Offenders — Pages

| # | File | `any` Count | Primary Patterns |
|---|------|-------------|-----------------|
| 1 | `src/pages/interviews/take/TakeInterviewPage.tsx` | **~75** | `catch (error: any)`, `as any` DB casts, response typing |
| 2 | `src/pages/InterviewCreationPage.tsx` | **~24** | `as any` on form data, DB inserts |
| 3 | `src/pages/InterviewResultsPage.tsx` | **~21** | `as any` response casting, error handling |
| 4 | `src/pages/TrainingPage.tsx` | **~19** | `as any` on CRUD operations |
| 5 | `src/pages/PromotionsPage.tsx` | **~18** | `as any` on form/DB casts |
| 6 | `src/pages/LearningAssessmentsPage.tsx` | **~17** | `as any` on assessment data |
| 7 | `src/pages/ATSPage.tsx` | **~17** | `as any` on integration data |
| 8 | `src/pages/CertificationsPage.tsx` | **~17** | `as any` on cert operations |
| 9 | `src/pages/CostTrackingPage.tsx` | **~13** | `as any` on cost aggregation |
| 10 | `src/pages/AdminHubPage.tsx` | **~12** | `as any` on admin operations |
| 11 | `src/pages/LearningPage.tsx` | **~11** | `as any` on learning data |
| 12 | `src/pages/InterviewManagementPage.tsx` | **~11** | `as any` on interview data |
| 13 | `src/pages/ProctoringDashboardPage.tsx` | **~11** | `as any` on proctoring data |
| 14 | `src/pages/ReportsPage.tsx` | **~10** | `as any` on report generation |
| 15 | `src/pages/BillingPage.tsx` | **~9** | `as any` on billing data |

### 2.3 Top Offenders — Hooks

| # | File | `any` Count | Primary Patterns |
|---|------|-------------|-----------------|
| 1 | `src/hooks/useInterviewCreation.ts` | **~21** | `as any` on form state, DB operations |
| 2 | `src/hooks/useInterviewFilters.ts` | **~5** | `as any` on filter state |
| 3 | `src/hooks/useLearningAssessments.ts` | **~4** | `as any` on assessment data |
| 4 | `src/hooks/useProctoring.ts` | **~4** | `as any` on proctoring state |
| 5 | `src/hooks/useOrganization.ts` | **~4** | `as any` on org data |

### 2.4 Common Anti-Patterns

**Pattern 1: `catch (error: any)` — ~100+ instances**
```typescript
// BAD: Loses error type information
} catch (error: any) {
  toast({ title: 'Error', description: error.message });
}

// GOOD: Type-safe error handling
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  toast({ title: 'Error', description: message });
}
```

**Pattern 2: `as any` on Supabase DB operations — ~80+ instances**
```typescript
// BAD: Hides schema mismatch
const { data } = await supabase
  .from('interviews' as any)
  .select('*')
  .eq('id', id as any);

// GOOD: Fix the type definition
const { data } = await supabase
  .from('interviews')
  .select('*')
  .eq('id', id);
```

**Pattern 3: `} as any)` on INSERT/UPDATE — ~30+ instances**
```typescript
// BAD: Bypasses insert type checking
await supabase.from('interviews').insert({
  ...formData,
  created_by: user.id,
} as any);

// GOOD: Type the insert data properly
const insertData: Database['public']['Tables']['interviews']['Insert'] = {
  ...formData,
  created_by: user.id,
};
await supabase.from('interviews').insert(insertData);
```

### 2.5 Recommended Fix Strategy

1. **Phase 1**: Fix `catch (error: any)` → `catch (error: unknown)` with type guards across all files
2. **Phase 2**: Regenerate Supabase types (`supabase gen types typescript`) and fix schema mismatches revealed by removing `as any` casts
3. **Phase 3**: Create proper TypeScript interfaces for all form data, API responses, and component props
4. **Phase 4**: Enable `"noImplicitAny": true` in `tsconfig.json` to prevent new `any` usage

---

## 3. 🟠 Monolith Components (>300 Lines)

### 3.1 Worst Offenders

| # | File | Est. Lines | Issue | Decomposition Suggestion |
|---|------|-----------|-------|--------------------------|
| 1 | `src/pages/interviews/take/TakeInterviewPage.tsx` | ~3,466 | Interview taking, video, network checks, proctoring — all in one | Split into: `InterviewSession`, `VideoCapture`, `NetworkMonitor`, `ProctoringOverlay`, `QuestionDisplay`, `AnswerInput` |
| 2 | `src/pages/InterviewCreationPage.tsx` | ~2,500+ | Complex form with type distributions, templates, question rules | Split into: `InterviewForm`, `QuestionRules`, `TypeDistribution`, `TemplateSelector`, `CreationWizardSteps` |
| 3 | `src/pages/InterviewResultsPage.tsx` | ~2,000+ | Assessment display, proctoring, violation display | Split into: `ResultsSummary`, `ProctoringReview`, `ViolationList`, `ScoreBreakdown`, `FeedbackPanel` |
| 4 | `src/pages/LandingPage.tsx` | ~1,500 | Full marketing page in single component | Split into: `HeroSection`, `FeaturesGrid`, `PricingTable`, `TestimonialsCarousel`, `CTASection`, `Footer` |
| 5 | `src/pages/TrainingPage.tsx` | ~1,000 | Training CRUD with topic/material management | Split into: `TrainingList`, `TopicManager`, `MaterialEditor`, `AssignmentPanel` |
| 6 | `src/pages/CostTrackingPage.tsx` | ~800 | Cost tracking across 10+ categories | Split into: `CostOverview`, `CategoryBreakdown`, `CostChart`, `BudgetAlerts` |
| 7 | `src/pages/CertificationsPage.tsx` | ~800 | Multi-step wizard | Split into: `CertWizard`, `CertList`, `CertDetails`, `AssessmentRunner` |
| 8 | `src/pages/AdminHubPage.tsx` | ~600 | Admin hub with CRUD for applications | Split into: `AdminDashboard`, `ApplicationList`, `SystemHealth`, `UserManagement` |
| 9 | `src/pages/UserManagementPage.tsx` | ~900 | User management with bulk operations | Split into: `UserTable`, `BulkActions`, `RoleEditor`, `UserDetails` |
| 10 | `src/pages/LearningAssessmentsPage.tsx` | ~700 | Assessment CRUD | Split into: `AssessmentList`, `AssessmentEditor`, `QuestionBank`, `AttemptReview` |
| 11 | `src/pages/PromotionsPage.tsx` | ~600 | Promotions management | Split into: `PromotionList`, `PromotionForm`, `UsageStats` |
| 12 | `src/pages/ProctoringDashboardPage.tsx` | ~600 | Proctoring monitoring | Split into: `SessionList`, `ViolationAlerts`, `LiveMonitor`, `SessionReplay` |

### 3.2 Edge Function Monoliths

| # | Function | Est. Lines | Issue |
|---|----------|-----------|-------|
| 1 | `generate-architecture-docs/index.ts` | ~1,900 | Hardcoded diagram templates mixed with logic |
| 2 | `generate-questions/index.ts` | ~1,500 | Question generation with AI prompt engineering |
| 3 | `analyze-proctoring-video/index.ts` | ~1,300 | Video analysis pipeline |

---

## 4. 🔴 Missing `React.memo` Usage

### 4.1 Current State

**~1 `memo()` import found** across the entire `src/` directory — effectively zero meaningful usage of `React.memo`.

### 4.2 High-Impact Candidates for `React.memo`

Components that are frequently re-rendered due to parent state changes and would benefit from memoization:

| Component Category | Examples | Why Memo Helps |
|-------------------|----------|----------------|
| Dashboard cards | `StatCard`, `ChartCard`, `MetricWidget` | Re-render on any dashboard state change |
| Table rows | `InterviewRow`, `CandidateRow`, `UserRow` | Re-render on table sort/filter changes |
| Form fields | Reusable input components | Re-render on any form state change |
| Sidebar/Navigation | `Sidebar`, `NavItem`, `BreadcrumbTrail` | Re-render on route changes |
| Modal content | `ConfirmDialog`, `DetailPanel` | Re-render on parent state |

### 4.3 `useMemo`/`useCallback` Usage

**~111 instances found** — decent coverage in hooks and some pages, but notably absent in:
- `src/pages/PromotionsPage.tsx` — lists, filters, stats without memoization
- `src/pages/TrainingPage.tsx` — large CRUD operations
- `src/pages/ProctoringDashboardPage.tsx` — dashboard with multiple data fetches
- `src/pages/CertificationsPage.tsx` — complex state management
- `src/pages/AdminHubPage.tsx` — heavy data aggregation

---

## 5. ✅ Positive Findings

### 5.1 Error Boundaries — Properly Implemented
**File**: `src/components/ErrorBoundary.tsx`
- React error boundary class component
- Wraps entire app in `App.tsx`
- Section-specific boundaries for dashboard routes
- Has unit tests

### 5.2 Logger Abstraction — Clean
**File**: `src/utils/logger.ts` (6 instances — expected for the utility itself)
- Proper abstraction over `console.log`
- Production code has ~2 direct `console.log` calls (in retry logic — acceptable)
- All other logging goes through the logger

### 5.3 ESLint Compliance — Excellent
- Only **1 `eslint-disable`** in entire codebase:
  - `src/contexts/AuthContext.tsx`: `// eslint-disable-next-line react-hooks/exhaustive-deps`
  - Intentional dependency omission to avoid auth loop — documented

### 5.4 Zero Technical Debt Markers
- **0 TODO comments** in `src/`
- **0 FIXME comments** in `src/`
- **0 HACK comments** in `src/`

### 5.5 Input Validation — Strong
**File**: `src/lib/validationSchemas.ts`
12 Zod schemas covering:
- `signUpSchema` — email, password (min 8, uppercase, lowercase, number), name
- `signInSchema` — email, password
- `organizationSchema` — org creation/update
- `interviewSchema` — interview creation
- `profileUpdateSchema` — profile changes
- `answerSchema` — interview answer submission
- `passwordChangeSchema` — password change
- `emailCheckSchema` — email verification
- `passwordResetRequestSchema` — reset request
- `passwordResetSchema` — reset execution
- `roleAssignmentSchema` — role changes
- `invitationSchema` — interview invitations

---

## 6. ESLint Configuration Gaps

**File**: `eslint.config.js`

### 6.1 Current Rules
- Extends `@typescript-eslint/recommended` + React hooks
- Custom rule: `no-duplicate-layout-wrapper`
- Disabled: `@typescript-eslint/no-unused-vars: "off"` ⚠️

### 6.2 Missing Security Rules
- **No `eslint-plugin-security`** — catches common security anti-patterns
- **No `eslint-plugin-no-unsanitized`** — catches unsafe DOM manipulation (`innerHTML`, etc.)
- **No `eslint-plugin-react/jsx-no-target-blank`** — catches missing `noopener noreferrer`

### 6.3 Missing Quality Rules
- `@typescript-eslint/no-explicit-any` — not enforced (would flag 200+ violations)
- `@typescript-eslint/no-unused-vars` — explicitly disabled
- `react/no-danger` — not enforced (would flag `dangerouslySetInnerHTML`)

### 6.4 Recommended ESLint Additions
```json
{
  "plugins": ["security", "no-unsanitized"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "no-unsanitized/method": "error",
    "no-unsanitized/property": "error",
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-unsafe-regex": "error"
  }
}
```

---

## 7. Performance Patterns

### 7.1 Data Fetching — Mixed Patterns

> **⚠️ Re-Audit Correction**: The original audit incorrectly claimed "No Query Library". **TanStack Query (React Query) v5.83.0 IS installed and actively used** with 101 occurrences of `useQuery`/`useMutation` across the codebase.

**Pattern A — TanStack Query (preferred, ~101 occurrences)**:
Many pages and hooks already use TanStack Query with proper caching, background refresh, and automatic deduplication.

**Pattern B — Manual `useEffect` + `useState` (legacy, still present)**:
Some older pages still use a `loadData()` pattern inside `useEffect`:
```typescript
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('table').select('*');
      setData(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```

**Issues with Pattern B**:
- No query caching — redundant re-fetches on component remount
- No stale-while-revalidate pattern
- No optimistic updates
- Sequential queries in some pages (e.g., `CostTrackingPage.tsx` makes 10+ separate `supabase.from()` calls)

### 7.2 Migration Opportunity — Convert Remaining Manual Fetches to TanStack Query

Since TanStack Query ^5.83.0 is already installed, the remaining manual `useEffect` + `useState` data fetching should be migrated to `useQuery`/`useMutation` for consistency. This is a code quality improvement, not a new dependency adoption.

**Recommendation**: Audit remaining pages using Pattern B and convert to TanStack Query hooks.

---

## 8. Prioritized Actions

| Priority | Action | Impact | Effort |
|----------|--------|--------|--------|
| 🟡 P2 | Replace `catch (error: any)` with `catch (error: unknown)` | Type safety | 2 days |
| 🟡 P2 | Remove `as any` casts by fixing Supabase types | Schema safety | 3 days |
| 🟡 P2 | Decompose top 5 monolith pages | Maintainability | 1 week |
| 🟢 P3 | Add `React.memo` to frequently re-rendered components | Performance | 2 days |
| 🟢 P3 | Add security ESLint plugins | Prevention | 2 hours |
| 🟢 P3 | Enable `no-explicit-any` as warning | Prevention | 1 hour |
| 🟢 P3 | Migrate remaining manual fetches to TanStack Query (already installed) | Consistency | 3 days |
| 🟢 P3 | Add `useMemo` to 5 complex pages | Performance | 1 day |

*Total estimated effort: 2–3 weeks for full code quality remediation.*
