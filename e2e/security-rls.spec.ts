/**
 * Security / RLS suite — API-level tenant isolation, anon denial, storage Kong
 * key-auth, and worker edge-function authorization.
 *
 * Run:
 *   npx playwright test e2e/security-rls.spec.ts --reporter=line
 *
 * Seeds an isolated "E2E Security Org B" so HR from Org A cannot cross-read.
 */
import { test, expect } from '@playwright/test';
import {
  API_URL,
  ANON_KEY,
  SERVICE_KEY,
  TEST_USERS,
  getAdminClient,
  ensureTestUser,
  ensureProfile,
  assignRole,
  ensureOrgMembership,
} from './helpers';

const ORG_A_NAME = 'E2E Test Organization';
const ORG_B_NAME = 'E2E Security Org B';

type Fixture = {
  orgAId: string;
  orgBId: string;
  orgBInterviewId: string;
  orgBAttemptId: string;
  orgBAssessmentId: string;
  orgBSessionToken: string;
  orgAAttemptId: string;
  orgASessionToken: string;
  hrToken: string;
  guestToken: string;
};

let fx: Fixture;

async function passwordToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Auth failed for ${email}: ${JSON.stringify(body)}`);
  }
  return body.access_token as string;
}

function anonHeaders() {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

function userHeaders(token: string) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

function serviceHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
}

test.setTimeout(90_000);

test.beforeAll(async () => {
  const admin = getAdminClient();

  // Ensure base users exist (idempotent with global setup)
  const hr = await ensureTestUser('hrRecruiter');
  const guest = await ensureTestUser('guest');
  const platformAdmin = await ensureTestUser('platformAdmin');
  await ensureProfile(hr.id, TEST_USERS.hrRecruiter.fullName, TEST_USERS.hrRecruiter.email);
  await ensureProfile(guest.id, TEST_USERS.guest.fullName, TEST_USERS.guest.email);
  await ensureProfile(platformAdmin.id, TEST_USERS.platformAdmin.fullName, TEST_USERS.platformAdmin.email);
  await assignRole(hr.id, 'hr_recruiter');
  await assignRole(guest.id, 'guest');
  await assignRole(platformAdmin.id, 'platform_admin');

  const { data: orgA } = await admin
    .from('organizations')
    .select('id')
    .eq('name', ORG_A_NAME)
    .maybeSingle();
  if (!orgA?.id) throw new Error('E2E Test Organization missing — run global setup first');

  // Org B — isolated tenant
  let orgBId: string;
  const { data: existingB } = await admin
    .from('organizations')
    .select('id')
    .eq('name', ORG_B_NAME)
    .maybeSingle();
  if (existingB?.id) {
    orgBId = existingB.id;
  } else {
    const { data: created, error } = await admin
      .from('organizations')
      .insert({
        name: ORG_B_NAME,
        slug: 'e2e-security-org-b',
        industry: 'Technology',
        size: '11-50',
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !created) throw new Error(`Failed to create Org B: ${error?.message}`);
    orgBId = created.id;
  }

  // Platform admins may belong to multiple orgs; partner_admin cannot.
  await ensureOrgMembership(orgBId, platformAdmin.id, 'admin');
  await ensureOrgMembership(orgA.id, hr.id, 'hr');

  // Ensure HR is NOT a member of Org B
  await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', orgBId)
    .eq('user_id', hr.id);

  // Org B interview + attempt + assessment
  const share = `e2e-sec-b-${Date.now()}`;
  let interviewId: string;
  const { data: existingInterview } = await admin
    .from('interviews')
    .select('id')
    .eq('organization_id', orgBId)
    .eq('title', 'E2E Security Isolated Interview')
    .maybeSingle();

  if (existingInterview?.id) {
    interviewId = existingInterview.id;
    await admin
      .from('interviews')
      .update({ status: 'active', share_link: share })
      .eq('id', interviewId);
  } else {
    const { data: interview, error } = await admin
      .from('interviews')
      .insert({
        title: 'E2E Security Isolated Interview',
        organization_id: orgBId,
        creator_id: platformAdmin.id,
        status: 'active',
        share_link: share,
        question_count: 1,
        time_limit: 30,
        proctoring_enabled: false,
        generation_status: 'completed',
        questions_status: 'approved',
      })
      .select('id')
      .single();
    if (error || !interview) throw new Error(`Org B interview: ${error?.message}`);
    interviewId = interview.id;
  }

  const sessionToken = `sec${crypto.randomUUID().replace(/-/g, '')}`;
  const { data: attempt, error: attemptErr } = await admin
    .from('interview_attempts')
    .insert({
      interview_id: interviewId,
      candidate_name: 'Security Candidate B',
      candidate_email: `sec-b-${Date.now()}@talentgeenie.test`,
      status: 'evaluated',
      session_token: sessionToken,
      submitted_at: new Date().toISOString(),
      time_taken: 12,
      answers: {},
    })
    .select('id')
    .single();
  if (attemptErr || !attempt) throw new Error(`Org B attempt: ${attemptErr?.message}`);

  const { data: assessment, error: assErr } = await admin
    .from('assessments')
    .insert({
      attempt_id: attempt.id,
      organization_id: orgBId,
      overall_score: 42,
      hiring_decision: 'not_recommended',
      strengths: ['fixture'],
      weaknesses: ['fixture'],
      topic_scores: {},
      question_scores: {},
      detailed_analysis: 'E2E security fixture',
    })
    .select('id')
    .single();
  if (assErr || !assessment) throw new Error(`Org B assessment: ${assErr?.message}`);

  // Org A attempt for session isolation (reuse latest evaluated if present)
  const { data: orgAAttempts } = await admin
    .from('interview_attempts')
    .select('id, session_token, interview_id')
    .not('session_token', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  let orgAAttemptId = attempt.id;
  let orgASessionToken = sessionToken;
  for (const row of orgAAttempts || []) {
    const { data: iv } = await admin
      .from('interviews')
      .select('organization_id')
      .eq('id', row.interview_id)
      .maybeSingle();
    if (iv?.organization_id === orgA.id && row.id !== attempt.id) {
      orgAAttemptId = row.id;
      orgASessionToken = row.session_token as string;
      break;
    }
  }

  const hrToken = await passwordToken(TEST_USERS.hrRecruiter.email, TEST_USERS.hrRecruiter.password);
  const guestToken = await passwordToken(TEST_USERS.guest.email, TEST_USERS.guest.password);

  fx = {
    orgAId: orgA.id,
    orgBId,
    orgBInterviewId: interviewId,
    orgBAttemptId: attempt.id,
    orgBAssessmentId: assessment.id,
    orgBSessionToken: sessionToken,
    orgAAttemptId,
    orgASessionToken,
    hrToken,
    guestToken,
  };
});

test.describe('Security / RLS — anonymous API', () => {
  test('anon cannot list interviews via REST', async ({ request }) => {
    const res = await request.get(`${API_URL}/rest/v1/interviews?select=id,title&limit=20`, {
      headers: anonHeaders(),
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('anon cannot read assessments by id', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/assessments?id=eq.${fx.orgBAssessmentId}&select=id,overall_score`,
      { headers: anonHeaders() },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('anon cannot read interview_attempts by id', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/interview_attempts?id=eq.${fx.orgBAttemptId}&select=id,candidate_email,session_token`,
      { headers: anonHeaders() },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('anon cannot read proctoring_sessions', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/proctoring_sessions?select=id,integrity_score&limit=10`,
      { headers: anonHeaders() },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('anon cannot update another candidate attempt', async ({ request }) => {
    const beforeRes = await request.get(
      `${API_URL}/rest/v1/interview_attempts?id=eq.${fx.orgBAttemptId}&select=id,status`,
      { headers: serviceHeaders() },
    );
    const before = (await beforeRes.json())[0];
    expect(before?.status).toBeTruthy();

    const res = await request.patch(
      `${API_URL}/rest/v1/interview_attempts?id=eq.${fx.orgBAttemptId}`,
      {
        headers: {
          ...anonHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: { status: 'in_progress' },
      },
    );

    // Prefer explicit deny; 503 from gateway must still leave the row unchanged.
    if ([200, 204].includes(res.status())) {
      const body = res.status() === 200 ? await res.json() : [];
      expect(Array.isArray(body) ? body.length : 0).toBe(0);
    } else {
      expect([401, 403, 404, 503]).toContain(res.status());
    }

    const afterRes = await request.get(
      `${API_URL}/rest/v1/interview_attempts?id=eq.${fx.orgBAttemptId}&select=id,status`,
      { headers: serviceHeaders() },
    );
    const after = (await afterRes.json())[0];
    expect(after?.status).toBe(before.status);
  });

  test('public candidate RPC still resolves active share links', async ({ request }) => {
    // Ensure Org B interview has a share_link
    const admin = getAdminClient();
    const { data: iv } = await admin
      .from('interviews')
      .select('share_link')
      .eq('id', fx.orgBInterviewId)
      .single();
    expect(iv?.share_link).toBeTruthy();

    const res = await request.post(`${API_URL}/rest/v1/rpc/get_interview_for_candidate`, {
      headers: { ...anonHeaders(), 'Content-Type': 'application/json' },
      data: { share_link_param: iv!.share_link },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows[0]?.id).toBe(fx.orgBInterviewId);
  });
});

test.describe('Security / RLS — cross-tenant HR', () => {
  test('HR in Org A cannot read Org B interview by id', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/interviews?id=eq.${fx.orgBInterviewId}&select=id,title,organization_id`,
      { headers: userHeaders(fx.hrToken) },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('HR in Org A cannot read Org B assessment by id', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/assessments?id=eq.${fx.orgBAssessmentId}&select=id,overall_score`,
      { headers: userHeaders(fx.hrToken) },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('HR in Org A cannot read Org B attempt PII', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/interview_attempts?id=eq.${fx.orgBAttemptId}&select=id,candidate_email`,
      { headers: userHeaders(fx.hrToken) },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('guest cannot read Org A or Org B interviews', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/interviews?select=id&organization_id=in.(${fx.orgAId},${fx.orgBId})`,
      { headers: userHeaders(fx.guestToken) },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

test.describe('Security — storage Kong key-auth', () => {
  test('storage object list without apikey is rejected', async ({ request }) => {
    const res = await request.post(`${API_URL}/storage/v1/object/list/proctoring-recordings`, {
      headers: { 'Content-Type': 'application/json' },
      data: { prefix: '', limit: 1 },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('signed upload URL PUT without apikey is rejected', async ({ request }) => {
    // Create a signed upload URL via service role, then strip apikey on PUT
    const path = `test-validation/security-${Date.now()}/deny.bin`;
    const signRes = await request.post(
      `${API_URL}/storage/v1/object/upload/sign/proctoring-recordings/${path}`,
      {
        headers: { ...serviceHeaders(), 'Content-Type': 'application/json' },
        data: {},
      },
    );
    // Some stacks use createSignedUploadUrl via functions; fall back to get-chunk-upload-url
    let signedUrl = '';
    if (signRes.ok()) {
      const body = await signRes.json();
      signedUrl = body.url || body.signedURL || body.signedUrl || '';
      if (signedUrl && signedUrl.startsWith('/')) {
        signedUrl = `${API_URL}/storage/v1${signedUrl}`;
      }
    }
    if (!signedUrl) {
      const fn = await request.post(`${API_URL}/functions/v1/get-chunk-upload-url`, {
        headers: { ...anonHeaders(), 'Content-Type': 'application/json' },
        data: {
          sessionId: 'test-validation',
          recordingType: 'video',
          chunkIndex: -1,
          isTest: true,
        },
      });
      expect(fn.ok()).toBeTruthy();
      const body = await fn.json();
      signedUrl = (body.signedUrl as string).replace('http://kong:8000', API_URL);
    }

    const put = await request.fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      data: Buffer.from([0, 1, 2, 3]),
    });
    expect([401, 403]).toContain(put.status());
  });
});

test.describe('Security — edge worker auth', () => {
  test('process-evaluation-queue rejects anon without worker secret', async ({ request }) => {
    const res = await request.post(`${API_URL}/functions/v1/process-evaluation-queue`, {
      headers: { ...anonHeaders(), 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(401);
  });

  test('process-evaluation-queue rejects missing apikey', async ({ request }) => {
    const res = await request.post(`${API_URL}/functions/v1/process-evaluation-queue`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect([401, 403]).toContain(res.status());
  });

  test('evaluate-interview rejects unauthenticated caller', async ({ request }) => {
    const res = await request.post(`${API_URL}/functions/v1/evaluate-interview`, {
      headers: { ...anonHeaders(), 'Content-Type': 'application/json' },
      data: { attemptId: fx.orgBAttemptId },
    });
    // Anon may be blocked at auth layer (401) or function business rules (400/403/401)
    expect([400, 401, 403, 500]).toContain(res.status());
    if (res.status() === 200) {
      // Must not silently evaluate another tenant's attempt for anon
      throw new Error('evaluate-interview must not succeed for anon key alone');
    }
  });
});

test.describe('Security — candidate session isolation', () => {
  test('session_token alone does not grant REST read of attempt row', async ({ request }) => {
    // Candidates authenticate via security-definer RPCs, not by presenting session_token as JWT.
    // Confirm REST with anon + known session_token query filter still returns nothing.
    const res = await request.get(
      `${API_URL}/rest/v1/interview_attempts?session_token=eq.${fx.orgBSessionToken}&select=id,candidate_email`,
      { headers: anonHeaders() },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('knowing Org B session_token does not expose Org A attempt via REST', async ({ request }) => {
    const res = await request.get(
      `${API_URL}/rest/v1/interview_attempts?id=eq.${fx.orgAAttemptId}&select=id,answers,session_token`,
      { headers: anonHeaders() },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
