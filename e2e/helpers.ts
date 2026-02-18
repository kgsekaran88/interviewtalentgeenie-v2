/**
 * Shared test helpers and constants for E2E tests.
 * 
 * All environment config lives here so individual test files stay clean.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Environment ─────────────────────────────────────────────────────────────
export const BASE_URL      = 'http://localhost:5174';
export const API_URL       = 'http://localhost:8000';
export const ANON_KEY      = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE3NzE0MDQyMzcsICJleHAiOiAyMDg2NzY0MjM3fQ.0T9mbkTwe7N_N8bUT49a4-Jg_wP0VtyiSQuDB418m5o';
export const SERVICE_KEY   = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc3MTQwNDIzNywgImV4cCI6IDIwODY3NjQyMzd9.6_nqKXwhutXVE2LtPo26yjPILFBbTcv1LBzen3vaf2Y';

// ─── Test user credentials ───────────────────────────────────────────────────
export const TEST_USERS = {
  platformAdmin: {
    email: 'e2e-admin@talentgeenie.test',
    password: 'TestAdmin123!@#',
    fullName: 'E2E Platform Admin',
    role: 'platform_admin' as const,
  },
  partnerAdmin: {
    email: 'e2e-partner@talentgeenie.test',
    password: 'TestPartner123!@#',
    fullName: 'E2E Partner Admin',
    role: 'partner_admin' as const,
  },
  hrRecruiter: {
    email: 'e2e-hr@talentgeenie.test',
    password: 'TestHR123!@#',
    fullName: 'E2E HR Recruiter',
    role: 'hr_recruiter' as const,
  },
  techSpoc: {
    email: 'e2e-tech@talentgeenie.test',
    password: 'TestTech123!@#',
    fullName: 'E2E Tech SPOC',
    role: 'tech_spoc' as const,
  },
  guest: {
    email: 'e2e-guest@talentgeenie.test',
    password: 'TestGuest123!@#',
    fullName: 'E2E Guest User',
    role: 'guest' as const,
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

// ─── Supabase admin client (service_role) ────────────────────────────────────
let _adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(API_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _adminClient;
}

// ─── Helper: create or retrieve a test user ──────────────────────────────────
export async function ensureTestUser(
  userKey: TestUserKey,
): Promise<{ id: string; email: string }> {
  const admin = getAdminClient();
  const user = TEST_USERS[userKey];

  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === user.email);

  if (found) {
    return { id: found.id, email: found.email! };
  }

  // Create user (auto-confirms email)
  const { data: created, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });

  if (error) throw new Error(`Failed to create ${userKey}: ${error.message}`);
  return { id: created.user.id, email: created.user.email! };
}

// ─── Helper: assign role to a test user ──────────────────────────────────────
export async function assignRole(userId: string, role: string): Promise<void> {
  const admin = getAdminClient();

  // Check if role already assigned
  const { data: existing } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();

  if (existing) return; // Already has role

  const { error } = await admin
    .from('user_roles')
    .insert({ user_id: userId, role });

  if (error) throw new Error(`Failed to assign role ${role} to ${userId}: ${error.message}`);
}

// ─── Helper: create a profile for a test user ────────────────────────────────
export async function ensureProfile(userId: string, fullName: string, email: string): Promise<void> {
  const admin = getAdminClient();

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await admin
    .from('profiles')
    .insert({
      id: userId,
      full_name: fullName,
      email,
      email_verified: true,
      onboarding_completed: true,
    });

  if (error) throw new Error(`Failed to create profile for ${userId}: ${error.message}`);
}

// ─── Helper: create a test organization ──────────────────────────────────────
export async function ensureTestOrganization(): Promise<string> {
  const admin = getAdminClient();
  const orgName = 'E2E Test Organization';

  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('name', orgName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from('organizations')
    .insert({
      name: orgName,
      slug: 'e2e-test-org',
      industry: 'Technology',
      size: '11-50',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create org: ${error.message}`);
  return created.id;
}

// ─── Helper: add user to organization ────────────────────────────────────────
export async function ensureOrgMembership(
  organizationId: string,
  userId: string,
  _role: string,
): Promise<void> {
  const admin = getAdminClient();

  const { data: existing } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await admin
    .from('organization_members')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      status: 'active',
    });

  if (error) throw new Error(`Failed to add org member: ${error.message}`);
}
