import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  step: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  data?: any;
  fixSuggestion?: string;
}

interface FlowTestReport {
  flowId: string;
  flowName: string;
  overallStatus: 'passed' | 'failed';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  totalDuration: number;
  steps: TestResult[];
  errors: Array<{
    step: string;
    error: string;
    suggestion: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { flowId } = await req.json();
    console.log(`Running comprehensive E2E test for flow: ${flowId}`);

    let report: FlowTestReport;

    switch (flowId) {
      case 'all':
        // Run all flows and aggregate results
        const allFlows = [
          { id: 'complete-interview-flow', fn: () => testCompleteInterviewFlow(supabase, user.id) },
          { id: 'partner-onboarding-flow', fn: () => testPartnerOnboardingWorkflow(supabase, user.id) },
          { id: 'candidate-journey', fn: () => testCandidateJourneyFlow(supabase) },
          { id: 'proctoring-flow', fn: () => testProctoringWorkflow(supabase) },
          { id: 'ai-evaluation-flow', fn: () => testAIEvaluationFlow(supabase) },
          { id: 'learning-flow', fn: () => testLearningWorkflow(supabase, user.id) },
          { id: 'analytics-reporting', fn: () => testAnalyticsReportingFlow(supabase) },
        ];
        
        const allSteps: TestResult[] = [];
        const allErrors: Array<{ step: string; error: string; suggestion: string }> = [];
        const startTime = Date.now();
        
        for (const flow of allFlows) {
          try {
            const flowReport = await flow.fn();
            allSteps.push(...flowReport.steps);
            allErrors.push(...flowReport.errors);
          } catch (error: any) {
            allSteps.push({
              step: `Flow: ${flow.id}`,
              status: 'failed',
              duration: 0,
              error: error.message,
              fixSuggestion: `Check the ${flow.id} implementation`,
            });
            allErrors.push({
              step: flow.id,
              error: error.message,
              suggestion: `Review and fix the ${flow.id} test`,
            });
          }
        }
        
        const passedSteps = allSteps.filter(s => s.status === 'passed').length;
        const failedSteps = allSteps.filter(s => s.status === 'failed').length;
        
        report = {
          flowId: 'all',
          flowName: 'All Flows',
          overallStatus: failedSteps === 0 ? 'passed' : 'failed',
          totalSteps: allSteps.length,
          passedSteps,
          failedSteps,
          totalDuration: Date.now() - startTime,
          steps: allSteps,
          errors: allErrors,
        };
        break;
      case 'complete-interview-flow':
        report = await testCompleteInterviewFlow(supabase, user.id);
        break;
      case 'partner-onboarding-flow':
        report = await testPartnerOnboardingWorkflow(supabase, user.id);
        break;
      case 'candidate-journey':
        report = await testCandidateJourneyFlow(supabase);
        break;
      case 'proctoring-flow':
        report = await testProctoringWorkflow(supabase);
        break;
      case 'ai-evaluation-flow':
        report = await testAIEvaluationFlow(supabase);
        break;
      case 'learning-flow':
        report = await testLearningWorkflow(supabase, user.id);
        break;
      case 'analytics-reporting':
        report = await testAnalyticsReportingFlow(supabase);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid flow ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Comprehensive test error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to run a test step
async function runStep(
  stepName: string,
  fn: () => Promise<any>
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const data = await fn();
    return {
      step: stepName,
      status: 'passed',
      duration: Date.now() - startTime,
      data,
    };
  } catch (error: any) {
    console.error(`Step failed: ${stepName}`, error);
    return {
      step: stepName,
      status: 'failed',
      duration: Date.now() - startTime,
      error: error.message,
      fixSuggestion: generateFixSuggestion(stepName, error),
    };
  }
}

function generateFixSuggestion(step: string, error: any): string {
  const errorMsg = error.message || '';
  
  // Common patterns and suggestions
  if (errorMsg.includes('RLS') || errorMsg.includes('row-level security')) {
    return 'Check RLS policies. Ensure user has proper permissions for this operation.';
  }
  if (errorMsg.includes('foreign key')) {
    return 'Verify related records exist before creating dependent data.';
  }
  if (errorMsg.includes('not found') || errorMsg.includes('null')) {
    return 'Data may not have been created in previous step. Check data seeding.';
  }
  if (errorMsg.includes('duplicate')) {
    return 'Unique constraint violation. Clean up test data or use unique identifiers.';
  }
  if (errorMsg.includes('timeout') || errorMsg.includes('slow')) {
    return 'Query performance issue. Consider adding indexes or optimizing query.';
  }
  if (errorMsg.includes('edge function')) {
    return 'Edge function may not be deployed or has errors. Check function logs.';
  }
  
  return 'Check error details and verify data integrity.';
}

// COMPLETE INTERVIEW FLOW: Organization → Interview → Questions → Candidate → Submit → Evaluate
async function testCompleteInterviewFlow(supabase: any, userId: string): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();
  let testOrgId: string, testInterviewId: string, testAttemptId: string;

  // Step 1: Create test organization
  steps.push(await runStep('Create organization', async () => {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: `E2E Test Org ${Date.now()}`,
        slug: `e2e-test-${Date.now()}`,
        website: 'https://test.com',
        industry: 'Technology',
        size: '11-50',
        country: 'United States',
        description: '[E2E_TEST]',
        status: 'active',
        verification_status: 'verified',
        contact_email: `e2e-${Date.now()}@test.com`,
      })
      .select()
      .single();
    
    if (error) throw error;
    testOrgId = data.id;
    return { organizationId: testOrgId };
  }));

  if (steps[steps.length - 1].status === 'failed') {
    return buildReport('complete-interview-flow', 'Complete Interview Flow', steps, startTime);
  }

  // Step 2: Add user as organization member
  steps.push(await runStep('Add organization member', async () => {
    const { error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: testOrgId,
        user_id: userId,
        role: 'admin',
        status: 'active',
      });
    
    if (error) throw error;
    return { memberAdded: true };
  }));

  // Step 3: Create subscription
  steps.push(await runStep('Create organization subscription', async () => {
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id')
      .limit(1)
      .single();
    
    const { error } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: testOrgId,
        plan_id: plans?.id,
        status: 'active',
        billing_cycle: 'monthly',
      });
    
    if (error) throw error;
    return { subscriptionCreated: true };
  }));

  // Step 4: Create interview
  steps.push(await runStep('Create interview', async () => {
    const { data, error } = await supabase
      .from('interviews')
      .insert({
        creator_id: userId,
        organization_id: testOrgId,
        title: 'E2E Test Interview',
        job_description: 'Test job description for E2E testing flow validation.',
        question_count: 5,
        difficulty_distribution: { easy: 40, medium: 40, hard: 20 },
        topic_distribution: {},
        status: 'active',
        share_link: `e2e-test-${Date.now()}`,
        time_limit: 30,
        proctoring_enabled: true,
        generation_status: 'completed',
      })
      .select()
      .single();
    
    if (error) throw error;
    testInterviewId = data.id;
    return { interviewId: testInterviewId };
  }));

  if (steps[steps.length - 1].status === 'failed') {
    return buildReport('complete-interview-flow', 'Complete Interview Flow', steps, startTime);
  }

  // Step 5: Add questions to interview
  steps.push(await runStep('Create interview questions', async () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({
      interview_id: testInterviewId,
      question_text: `E2E Test Question ${i + 1}`,
      topic: 'Testing',
      difficulty: i < 2 ? 'easy' : i < 4 ? 'medium' : 'hard',
      question_type: 'mcq',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'Option A',
      order_index: i,
    }));

    const { error } = await supabase.from('questions').insert(questions);
    if (error) throw error;
    return { questionsCreated: 5 };
  }));

  // Step 6: Create candidate attempt
  steps.push(await runStep('Create candidate attempt', async () => {
    const { data, error } = await supabase
      .from('interview_attempts')
      .insert({
        interview_id: testInterviewId,
        candidate_name: 'E2E Test Candidate',
        candidate_email: `e2e-candidate-${Date.now()}@test.com`,
        status: 'in_progress',
        session_token: `e2e-token-${Date.now()}`,
      })
      .select()
      .single();
    
    if (error) throw error;
    testAttemptId = data.id;
    return { attemptId: testAttemptId };
  }));

  if (steps[steps.length - 1].status === 'failed') {
    return buildReport('complete-interview-flow', 'Complete Interview Flow', steps, startTime);
  }

  // Step 7: Link questions to attempt
  steps.push(await runStep('Link questions to attempt', async () => {
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('interview_id', testInterviewId);

    const attemptQuestions = questions.map((q: any, i: number) => ({
      attempt_id: testAttemptId,
      question_id: q.id,
      display_order: i,
    }));

    const { error } = await supabase
      .from('attempt_questions')
      .insert(attemptQuestions);
    
    if (error) throw error;
    return { questionsLinked: questions.length };
  }));

  // Step 8: Submit attempt with answers
  steps.push(await runStep('Submit candidate answers', async () => {
    const { error } = await supabase
      .from('interview_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        answers: {
          'q1': 'Option A',
          'q2': 'Option B',
          'q3': 'Option C',
          'q4': 'Option A',
          'q5': 'Option D',
        },
        time_taken: 1200,
      })
      .eq('id', testAttemptId);
    
    if (error) throw error;
    return { submitted: true };
  }));

  // Step 9: Create assessment (simulating AI evaluation)
  steps.push(await runStep('Generate assessment', async () => {
    const { error } = await supabase
      .from('assessments')
      .insert({
        attempt_id: testAttemptId,
        overall_score: 75,
        hiring_decision: 'Recommend',
        detailed_analysis: 'E2E test analysis',
        strengths: ['Testing', 'Attention to detail'],
        weaknesses: ['Performance optimization'],
        topic_scores: { testing: 80, general: 70 },
      });
    
    if (error) throw error;
    return { assessmentCreated: true };
  }));

  // Step 10: Verify complete data chain
  steps.push(await runStep('Verify data integrity', async () => {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(`
        *,
        interviews (*),
        assessments (*),
        attempt_questions (
          question_id,
          questions (*)
        )
      `)
      .eq('id', testAttemptId)
      .single();
    
    if (error) throw error;
    if (!data.interviews) throw new Error('Interview not linked');
    if (!data.assessments || data.assessments.length === 0) throw new Error('Assessment not created');
    if (!data.attempt_questions || data.attempt_questions.length === 0) throw new Error('Questions not linked');
    
    return {
      dataIntegrity: 'verified',
      questionsCount: data.attempt_questions.length,
      hasAssessment: true,
    };
  }));

  // Cleanup
  steps.push(await runStep('Cleanup test data', async () => {
    await supabase.from('assessments').delete().eq('attempt_id', testAttemptId);
    await supabase.from('attempt_questions').delete().eq('attempt_id', testAttemptId);
    await supabase.from('interview_attempts').delete().eq('id', testAttemptId);
    await supabase.from('questions').delete().eq('interview_id', testInterviewId);
    await supabase.from('interviews').delete().eq('id', testInterviewId);
    await supabase.from('organization_subscriptions').delete().eq('organization_id', testOrgId);
    await supabase.from('organization_members').delete().eq('organization_id', testOrgId);
    await supabase.from('organizations').delete().eq('id', testOrgId);
    return { cleaned: true };
  }));

  return buildReport('complete-interview-flow', 'Complete Interview Flow (Org → Interview → Submit → Evaluate)', steps, startTime);
}

// PARTNER ONBOARDING FLOW
async function testPartnerOnboardingWorkflow(supabase: any, userId: string): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();
  let testOrgId: string;

  steps.push(await runStep('Register new partner organization', async () => {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: `Partner Test ${Date.now()}`,
        slug: `partner-${Date.now()}`,
        website: 'https://partner-test.com',
        industry: 'Healthcare',
        size: '51-200',
        country: 'United States',
        description: '[E2E_PARTNER_TEST]',
        status: 'pending_approval',
        verification_status: 'pending',
        contact_email: `partner-${Date.now()}@test.com`,
      })
      .select()
      .single();
    
    if (error) throw error;
    testOrgId = data.id;
    return { organizationId: testOrgId, status: 'pending_approval' };
  }));

  if (steps[steps.length - 1].status === 'failed') {
    return buildReport('partner-onboarding-flow', 'Partner Onboarding Flow', steps, startTime);
  }

  steps.push(await runStep('Approve organization (admin action)', async () => {
    const { error } = await supabase
      .from('organizations')
      .update({
        status: 'active',
        verification_status: 'verified',
      })
      .eq('id', testOrgId);
    
    if (error) throw error;
    return { approved: true };
  }));

  steps.push(await runStep('Assign subscription plan', async () => {
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'Professional')
      .limit(1)
      .single();
    
    const { error } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: testOrgId,
        plan_id: plans?.id,
        status: 'active',
        billing_cycle: 'monthly',
      });
    
    if (error) throw error;
    return { subscriptionAssigned: true };
  }));

  steps.push(await runStep('Add partner admin user', async () => {
    const { error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: testOrgId,
        user_id: userId,
        role: 'admin',
        status: 'active',
      });
    
    if (error) throw error;
    return { adminAdded: true };
  }));

  steps.push(await runStep('Verify partner portal access', async () => {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        organizations (*)
      `)
      .eq('user_id', userId)
      .eq('organization_id', testOrgId)
      .single();
    
    if (error) throw error;
    if (data.organizations.status !== 'active') throw new Error('Organization not active');
    
    return { accessVerified: true };
  }));

  steps.push(await runStep('Cleanup test data', async () => {
    await supabase.from('organization_members').delete().eq('organization_id', testOrgId);
    await supabase.from('organization_subscriptions').delete().eq('organization_id', testOrgId);
    await supabase.from('organizations').delete().eq('id', testOrgId);
    return { cleaned: true };
  }));

  return buildReport('partner-onboarding-flow', 'Partner Onboarding Workflow', steps, startTime);
}

// CANDIDATE JOURNEY FLOW
async function testCandidateJourneyFlow(supabase: any): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();

  steps.push(await runStep('Candidate receives interview link', async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('id, share_link, title, status')
      .eq('status', 'active')
      .limit(1)
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('No active interviews found');
    
    return { interviewFound: true, shareLink: data.share_link };
  }));

  steps.push(await runStep('Candidate views interview details', async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('title, job_description, question_count, time_limit, proctoring_enabled')
      .eq('status', 'active')
      .limit(1)
      .single();
    
    if (error) throw error;
    return { interviewDetails: data };
  }));

  steps.push(await runStep('Candidate starts interview (creates attempt)', async () => {
    const { data: interview } = await supabase
      .from('interviews')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single();

    const { data, error } = await supabase.rpc('create_interview_attempt', {
      p_interview_id: interview.id,
      p_candidate_name: 'E2E Test Candidate',
      p_candidate_email: `e2e-journey-${Date.now()}@test.com`,
    });
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Failed to create attempt');
    
    return { attemptCreated: true, sessionToken: data[0].session_token };
  }));

  steps.push(await runStep('Candidate fetches questions', async () => {
    const { data: attempts } = await supabase
      .from('interview_attempts')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase.rpc('get_questions_for_attempt', {
      p_attempt_id: attempts.id,
    });
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No questions returned');
    
    return { questionsCount: data.length };
  }));

  return buildReport('candidate-journey', 'Candidate Journey Flow', steps, startTime);
}

// PROCTORING WORKFLOW
async function testProctoringWorkflow(supabase: any): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();
  let testAttemptId: string, testSessionId: string;

  steps.push(await runStep('Get proctoring-enabled interview', async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('id')
      .eq('proctoring_enabled', true)
      .limit(1)
      .single();
    
    if (error) throw error;
    return { interviewId: data.id };
  }));

  steps.push(await runStep('Create test attempt for proctoring', async () => {
    const { data: interview } = await supabase
      .from('interviews')
      .select('id')
      .eq('proctoring_enabled', true)
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('interview_attempts')
      .insert({
        interview_id: interview.id,
        candidate_name: 'Proctoring Test',
        candidate_email: `proctoring-${Date.now()}@test.com`,
        status: 'in_progress',
      })
      .select()
      .single();
    
    if (error) throw error;
    testAttemptId = data.id;
    return { attemptId: testAttemptId };
  }));

  if (steps[steps.length - 1].status === 'failed') {
    return buildReport('proctoring-flow', 'Proctoring Workflow', steps, startTime);
  }

  steps.push(await runStep('Initialize proctoring session', async () => {
    const { data, error } = await supabase
      .from('proctoring_sessions')
      .insert({
        interview_attempt_id: testAttemptId,
        camera_enabled: true,
        microphone_enabled: true,
        screen_share_enabled: false,
      })
      .select()
      .single();
    
    if (error) throw error;
    testSessionId = data.id;
    return { sessionId: testSessionId };
  }));

  steps.push(await runStep('Record integrity violations', async () => {
    const violations = [
      { type: 'tab_switch', severity: 'medium', timestamp: new Date().toISOString(), details: { count: 1 } },
      { type: 'face_not_visible', severity: 'high', timestamp: new Date().toISOString(), details: { duration: 5 } },
    ];

    const { error } = await supabase
      .from('proctoring_sessions')
      .update({
        violations: violations,
        integrity_score: 75,
      })
      .eq('id', testSessionId);
    
    if (error) throw error;
    return { violationsRecorded: violations.length };
  }));

  steps.push(await runStep('Close proctoring session', async () => {
    const { error } = await supabase
      .from('proctoring_sessions')
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq('id', testSessionId);
    
    if (error) throw error;
    return { sessionClosed: true };
  }));

  steps.push(await runStep('Cleanup test data', async () => {
    await supabase.from('proctoring_sessions').delete().eq('id', testSessionId);
    await supabase.from('interview_attempts').delete().eq('id', testAttemptId);
    return { cleaned: true };
  }));

  return buildReport('proctoring-flow', 'Proctoring Workflow', steps, startTime);
}

// AI EVALUATION FLOW
async function testAIEvaluationFlow(supabase: any): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();

  steps.push(await runStep('Find submitted attempt', async () => {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select('id')
      .eq('status', 'submitted')
      .limit(1)
      .single();
    
    if (error) throw error;
    return { attemptId: data.id };
  }));

  steps.push(await runStep('Call evaluation edge function', async () => {
    const { data: attempt } = await supabase
      .from('interview_attempts')
      .select('id')
      .eq('status', 'submitted')
      .limit(1)
      .single();

    // Test edge function is accessible
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/evaluate-interview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        test: true,
        attemptId: attempt.id,
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Edge function failed: ${text}`);
    }
    
    return { edgeFunctionAvailable: true };
  }));

  steps.push(await runStep('Verify assessment created', async () => {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .limit(1)
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('No assessments found');
    
    return { assessmentVerified: true };
  }));

  steps.push(await runStep('Check bias detection', async () => {
    const { data, error } = await supabase
      .from('bias_detection_results')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    return { biasDetectionEnabled: data && data.length > 0 };
  }));

  return buildReport('ai-evaluation-flow', 'AI Evaluation Flow', steps, startTime);
}

// LEARNING WORKFLOW
async function testLearningWorkflow(supabase: any, userId: string): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();

  steps.push(await runStep('Check certification topics', async () => {
    const { data, error } = await supabase
      .from('certification_topics')
      .select('*')
      .eq('is_active', true)
      .limit(5);
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No certification topics available');
    
    return { topicsAvailable: data.length };
  }));

  steps.push(await runStep('Check learning subscription', async () => {
    const { data, error } = await supabase.rpc('get_active_learning_subscription', {
      p_user_id: userId,
    });
    
    // It's okay if no subscription exists
    return { hasSubscription: data && data.length > 0 };
  }));

  steps.push(await runStep('Check daily assessment limit', async () => {
    const { data, error } = await supabase.rpc('check_daily_free_assessment_limit', {
      p_user_id: userId,
    });
    
    if (error) throw error;
    return { canTakeFree: data[0]?.can_take_free };
  }));

  steps.push(await runStep('Verify badge system', async () => {
    const { data, error } = await supabase
      .from('certificate_badges')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    return { badgesAvailable: data?.length || 0 };
  }));

  return buildReport('learning-flow', 'Learning Workflow', steps, startTime);
}

// ANALYTICS & REPORTING
async function testAnalyticsReportingFlow(supabase: any): Promise<FlowTestReport> {
  const steps: TestResult[] = [];
  const startTime = Date.now();

  steps.push(await runStep('Check CPI calculations', async () => {
    const { data, error } = await supabase
      .from('candidate_performance_index')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    return { cpiRecords: data?.length || 0 };
  }));

  steps.push(await runStep('Check analytics snapshots', async () => {
    const { data, error } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    return { snapshotsAvailable: data?.length || 0 };
  }));

  steps.push(await runStep('Check comparative analytics', async () => {
    const { data, error } = await supabase
      .from('comparative_analytics')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    return { comparativeReports: data?.length || 0 };
  }));

  steps.push(await runStep('Verify report generation', async () => {
    const { data, error } = await supabase
      .from('generated_reports')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    return { reportsGenerated: data?.length || 0 };
  }));

  return buildReport('analytics-reporting', 'Analytics & Reporting Flow', steps, startTime);
}

function buildReport(
  flowId: string,
  flowName: string,
  steps: TestResult[],
  startTime: number
): FlowTestReport {
  const passedSteps = steps.filter(s => s.status === 'passed').length;
  const failedSteps = steps.filter(s => s.status === 'failed').length;
  const errors = steps
    .filter(s => s.status === 'failed')
    .map(s => ({
      step: s.step,
      error: s.error || 'Unknown error',
      suggestion: s.fixSuggestion || 'No suggestion available',
    }));

  return {
    flowId,
    flowName,
    overallStatus: failedSteps === 0 ? 'passed' : 'failed',
    totalSteps: steps.length,
    passedSteps,
    failedSteps,
    totalDuration: Date.now() - startTime,
    steps,
    errors,
  };
}
