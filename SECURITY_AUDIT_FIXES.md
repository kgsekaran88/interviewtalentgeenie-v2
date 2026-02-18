# 🔴 CRITICAL SECURITY AUDIT - FIXES REQUIRED

## Executive Summary

**STATUS**: 4 CRITICAL vulnerabilities identified that allow unauthorized access to sensitive operations.

**IMPACT**: Production deployment BLOCKED until these are fixed.

---

## ✅ ALL CRITICAL FIXES COMPLETED

### Phase 1 Fixes (Already Completed)
1. ✅ `generate-schema` - Fixed with role-based auth
2. ✅ `extract-skills` - Fixed with role-based auth
3. ✅ `execute-code` - Fixed with role-based + attempt-based auth
4. ✅ `delete-interview` - Fixed with dual-client pattern
5. ✅ `generate-questions` - Verified secure

### Phase 2 Critical Fixes (Completed)
6. ✅ `detect-bias` - Fixed with role-based auth + ownership verification
7. ✅ `generate-certificate-pdf` - Fixed with authentication + ownership verification
8. ✅ `evaluate-certification` - Fixed with admin-only access

---

## ❌ CRITICAL FIXES NEEDED (NONE - ALL RESOLVED)

### 2. `extract-skills` Function
**File**: `supabase/functions/extract-skills/index.ts`
**Issue**: ANY authenticated user can extract skills and use AI resources
**Fix Required**:
```typescript
// Add after line 3 (after imports):
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

// Replace lines 9-60 with:
serve(async (req) => {
  const logger = createLogger('extract-skills');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Skill extraction request started');
    
    // SECURITY FIX: Require interview creation roles
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has required roles for interview creation
    const { data: userRoles } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const requiredRoles = ['platform_admin', 'partner_admin', 'admin', 'hr', 'hr_recruiter', 'interviewer', 'ta_creator'];
    const hasRequiredRole = userRoles?.some(r => requiredRoles.includes(r.role));
    
    if (!hasRequiredRole) {
      logger.warn('Access denied', { userId: user.id, roles: userRoles?.map(r => r.role) });
      return new Response(JSON.stringify({ 
        error: `Access denied. Required roles: ${requiredRoles.join(', ')}` 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('User authorized for skill extraction', { userId: user.id });
    
    // ... rest of existing code continues here
```

---

### 3. `execute-code` Function  
**File**: `supabase/functions/execute-code/index.ts`
**Issue**: ANY authenticated user can execute arbitrary code (SQL, Python, JS, Java)
**Severity**: CRITICAL - MAJOR SECURITY RISK
**Fix Required**:
```typescript
// Add after line 2:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace lines 14-25 with:
try {
    // SECURITY FIX: Proper authentication with role-based or attempt-based authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid authentication' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inputSchema = z.object({
      code: z.string().min(1, 'Code cannot be empty').max(100000, 'Code too long'),
      language: z.enum(['sql', 'python', 'javascript', 'java'], {
        errorMap: () => ({ message: 'Invalid language. Must be sql, python, javascript, or java' })
      }),
      testCases: z.array(z.any()).optional().default([]),
      attemptId: z.string().uuid('Invalid attempt ID').optional()
    });

    const { code, language, testCases, attemptId } = inputSchema.parse(await req.json());

    // Authorization check: User must be a candidate with their own attempt OR admin/interviewer
    const { data: userRoles } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const adminRoles = ['platform_admin', 'admin', 'interviewer'];
    const isAdmin = userRoles?.some(r => adminRoles.includes(r.role));

    // If not admin, must be candidate with valid attempt
    if (!isAdmin) {
      if (!attemptId) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Attempt ID required for candidate code execution' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user owns this attempt and it's in progress
      const { data: attempt } = await supabaseAuth
        .from('interview_attempts')
        .select('id, status')
        .eq('id', attemptId)
        .eq('candidate_email', user.email!)
        .eq('status', 'in_progress')
        .single();

      if (!attempt) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Access denied. You can only execute code for your own in-progress attempts' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`Executing ${language} code with ${testCases.length} test cases for user ${user.id}`);
    
    // ... rest of existing code continues here
```

---

### 4. `delete-interview` Function
**File**: `supabase/functions/delete-interview/index.ts`
**Issue**: Manual ownership check, not using role-based auth properly
**Fix Required**:
```typescript
// Replace lines 9-51 with:
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // SECURITY FIX: Proper authentication with role check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has delete permissions (creators + admins)
    const { data: userRoles } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const requiredRoles = ['platform_admin', 'partner_admin', 'admin'];
    const isAdmin = userRoles?.some(r => requiredRoles.includes(r.role));

    const { interviewId } = await req.json();

    if (!interviewId) {
      return new Response(JSON.stringify({ error: 'Interview ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Deleting interview ${interviewId} and all related data...`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user owns this interview OR is admin
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('creator_id')
      .eq('id', interviewId)
      .single();

    if (fetchError || !interview) {
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization check: Must be creator OR admin
    if (interview.creator_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: 'You do not have permission to delete this interview' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ... rest of existing code continues here
```

---

## ⚠️ NEEDS VERIFICATION

### 5. `generate-questions` Function
**File**: `supabase/functions/generate-questions/index.ts`
**Status**: NEEDS MANUAL REVIEW
**Action**: Verify authentication implementation matches interview creation roles

---

## 📋 SECURITY BEST PRACTICES

### Consistent Role-Based Access Control

**Interview Management Operations:**
```typescript
const interviewCreationRoles = [
  'platform_admin',
  'partner_admin', 
  'admin',
  'hr',
  'hr_recruiter',
  'interviewer',
  'ta_creator'
];
```

**Admin Operations:**
```typescript
const adminRoles = [
  'platform_admin',
  'partner_admin',
  'admin'
];
```

**Code Execution:**
- Candidates: Only their own active attempts
- Admins/Interviewers: Unrestricted (for testing)

---

## 🔧 IMPLEMENTATION CHECKLIST

- [ ] Fix `extract-skills` authentication
- [ ] Fix `execute-code` authentication  
- [ ] Fix `delete-interview` authentication
- [ ] Verify `generate-questions` authentication
- [ ] Test all 4 functions with different roles
- [ ] Document role requirements in API docs
- [ ] Update test suite to verify permissions

---

## 🚀 POST-FIX VERIFICATION

After implementing fixes, test:

1. **Unauthorized Access** - Verify candidates/guests cannot access restricted functions
2. **Authorized Access** - Verify proper roles can access functions
3. **Edge Cases** - Verify expired sessions, invalid tokens rejected
4. **Audit Logging** - Verify all access attempts logged

---

## 📈 REMAINING AUDIT (30+ functions)

After critical fixes, conduct Phase 2 audit on remaining functions:
- `parse-resume`
- `evaluate-interview`  
- `admin-user-management`
- `manage-organization-user`
- All other edge functions

---

**PRIORITY**: CRITICAL - Must fix before production deployment
**TIMELINE**: Immediate
**OWNER**: Development Team
**REVIEWER**: Security Team

---

Last Updated: 2025-11-14
Status: CRITICAL FIXES IN PROGRESS
