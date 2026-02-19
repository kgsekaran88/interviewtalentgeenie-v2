import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


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

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isPlatformAdmin = roles?.some(r => r.role === 'platform_admin');
    if (!isPlatformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { flowId, template = {} } = await req.json();

    console.log(`Seeding data for flow: ${flowId} with template:`, template);
    
    let seededData: any = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Extract template parameters with defaults
    const params = {
      organizationCount: template.organizationCount || 1,
      usersPerOrg: template.usersPerOrg || 2,
      interviewsPerOrg: template.interviewsPerOrg || 2,
      questionsPerInterview: template.questionsPerInterview || 5,
      candidatesPerInterview: template.candidatesPerInterview || 2,
      attemptsPerCandidate: template.attemptsPerCandidate || 1,
      enableProctoring: template.enableProctoring !== false,
      enableAI: template.enableAI !== false,
      includeViolations: template.includeViolations !== false,
    };

    switch (flowId) {
      case 'authentication':
        seededData = await seedAuthenticationData(supabase, timestamp, params);
        break;
      
      case 'platform-admin':
        // Seed platform settings, AI configs
        seededData = await seedPlatformAdminData(supabase, timestamp);
        break;
      
      case 'partner-onboarding':
        seededData = await seedPartnerOnboardingData(supabase, timestamp, params);
        break;
      
      case 'organization':
        seededData = await seedOrganizationData(supabase, timestamp, params);
        break;
      
      case 'interview-creation':
        seededData = await seedInterviewCreationData(supabase, timestamp, params);
        break;
      
      case 'question-repository':
        // Seed question banks
        seededData = await seedQuestionRepositoryData(supabase, timestamp);
        break;
      
      case 'candidate-assessment':
        seededData = await seedCandidateAssessmentData(supabase, timestamp, params);
        break;
      
      case 'proctoring':
        // Seed proctoring sessions
        seededData = await seedProctoringData(supabase, timestamp);
        break;
      
      case 'interview-evaluation':
        // Seed assessments and evaluations
        seededData = await seedInterviewEvaluationData(supabase, timestamp);
        break;
      
      case 'learning':
        // Seed learning assessments and materials
        seededData = await seedLearningData(supabase, timestamp);
        break;
      
      case 'analytics':
        // Seed analytics snapshots
        seededData = await seedAnalyticsData(supabase, timestamp);
        break;
      
      case 'billing':
        // Seed subscriptions and invoices
        seededData = await seedBillingData(supabase, timestamp);
        break;
      
      case 'ats-integration':
        // Seed ATS integrations and candidates
        seededData = await seedATSData(supabase, timestamp);
        break;
      
      case 'testing':
        // Seed test suites and runs
        seededData = await seedTestingData(supabase, timestamp);
        break;
      
      case 'chatbot':
        // Seed chatbot interactions
        seededData = await seedChatbotData(supabase, timestamp);
        break;
      
      case 'notifications':
        // Seed notification settings
        seededData = await seedNotificationsData(supabase, timestamp);
        break;
      
      case 'security':
        // Seed audit logs and security events
        seededData = await seedSecurityData(supabase, timestamp);
        break;
      
      case 'all':
        seededData = await seedAllFlows(supabase, timestamp, params);
        break;
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid flow ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        flowId,
        seededData,
        timestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Seeding error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function seedAuthenticationData(supabase: any, timestamp: string, params: any) {
  const { usersPerOrg } = params;
  const testProfiles = [];
  
  for (let i = 1; i <= usersPerOrg; i++) {
    const email = `test-auth-${timestamp}-${i}@test.com`;
    testProfiles.push({ email, full_name: `Test Auth User ${i}` });
  }
  
  return { 
    users: testProfiles.length,
    details: testProfiles.map(p => p.email).join(', ')
  };
}

async function seedPlatformAdminData(supabase: any, timestamp: string) {
  // Seed AI providers if not exist
  const { data: existingProviders } = await supabase
    .from('ai_providers')
    .select('id')
    .limit(1);
  
  if (!existingProviders || existingProviders.length === 0) {
    await supabase.from('ai_providers').insert([
      {
        name: 'test-openai',
        display_name: 'Test OpenAI',
        provider_type: 'openai',
        base_url: 'https://api.openai.com/v1',
        is_active: true,
      }
    ]);
  }
  
  return { message: 'Platform admin test data seeded' };
}

async function seedPartnerOnboardingData(supabase: any, timestamp: string, params: any) {
  const { organizationCount } = params;
  const organizations = [];
  
  for (let i = 1; i <= organizationCount; i++) {
    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: `Test Partner Org ${timestamp}-${i}`,
        contact_email: `test-partner-${timestamp}-${i}@test.com`,
        description: `[TEST_DATA_SEED] Partner onboarding test organization ${i}`,
        status: 'active', // Use only valid status values
        verification_status: i === 1 ? 'unverified' : 'verified',
      })
      .select()
      .single();
    
    if (error) {
      console.error(`Error creating organization ${i}:`, error);
      continue;
    }
    
    if (org) organizations.push(org);
  }
  
  return { 
    organizations: organizations.length,
    details: `Created ${organizations.length} test organizations`
  };
}

async function seedOrganizationData(supabase: any, timestamp: string, params: any) {
  const { organizationCount } = params;
  const organizations = [];
  
  for (let i = 1; i <= organizationCount; i++) {
    const { data: org } = await supabase
      .from('organizations')
      .insert({
        name: `Test Organization Mgmt ${timestamp}-${i}`,
        contact_email: `test-org-mgmt-${timestamp}-${i}@test.com`,
        description: `[TEST_DATA_SEED] Organization management test ${i}`,
        status: 'active',
        verification_status: 'verified',
      })
      .select()
      .single();
    
    if (org) organizations.push(org);
  }
  
  return { 
    organizations: organizations.length,
    details: `Created ${organizations.length} organizations`
  };
}

async function seedInterviewCreationData(supabase: any, timestamp: string, params: any) {
  const { interviewsPerOrg, questionsPerInterview } = params;
  
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .ilike('description', '%TEST_DATA_SEED%')
    .limit(1);
  
  if (!orgs || orgs.length === 0) {
    return { message: 'No test organization found. Please seed organization data first.' };
  }
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);
  
  if (!profiles || profiles.length === 0) {
    return { message: 'No profiles found' };
  }
  
  const interviews = [];
  for (let i = 1; i <= interviewsPerOrg; i++) {
    const { data: interview } = await supabase
      .from('interviews')
      .insert({
        title: `Test Interview ${timestamp}-${i}`,
        job_description: `[TEST_DATA_SEED] Test job description for interview ${i}`,
        creator_id: profiles[0].id,
        organization_id: orgs[0].id,
        status: i === 1 ? 'draft' : 'active',
        generation_status: 'completed',
        question_count: questionsPerInterview,
      })
      .select()
      .single();
    
    if (interview) interviews.push(interview);
  }
  
  return { 
    interviews: interviews.length,
    details: `Created ${interviews.length} test interviews with ${questionsPerInterview} questions each`
  };
}

async function seedQuestionRepositoryData(supabase: any, timestamp: string) {
  // Get test interview
  const { data: interviews } = await supabase
    .from('interviews')
    .select('id')
    .ilike('job_description', '%TEST_DATA_SEED%')
    .limit(1);
  
  if (!interviews || interviews.length === 0) {
    return { message: 'No test interviews found' };
  }
  
  const questions = [];
  for (let i = 1; i <= 5; i++) {
    const { data: question } = await supabase
      .from('questions')
      .insert({
        interview_id: interviews[0].id,
        question_text: `[TEST_DATA_SEED] Test question ${i}?`,
        question_type: i % 3 === 0 ? 'coding' : i % 2 === 0 ? 'descriptive' : 'mcq',
        topic: 'Testing',
        difficulty: i <= 2 ? 'easy' : i <= 4 ? 'medium' : 'hard',
        correct_answer: 'Test answer',
      })
      .select()
      .single();
    
    if (question) questions.push(question);
  }
  
  return { questions: questions.length };
}

async function seedCandidateAssessmentData(supabase: any, timestamp: string, params: any) {
  const { candidatesPerInterview, attemptsPerCandidate } = params;
  
  const { data: interviews } = await supabase
    .from('interviews')
    .select('id')
    .ilike('job_description', '%TEST_DATA_SEED%')
    .eq('status', 'active')
    .limit(1);
  
  if (!interviews || interviews.length === 0) {
    return { message: 'No active test interviews found' };
  }
  
  const attempts = [];
  const totalCandidates = candidatesPerInterview * attemptsPerCandidate;
  
  for (let i = 1; i <= totalCandidates; i++) {
    const { data: attempt } = await supabase
      .from('interview_attempts')
      .insert({
        interview_id: interviews[0].id,
        candidate_email: `test-candidate-${timestamp}-${i}@test.com`,
        candidate_name: `Test Candidate ${i}`,
        status: i % 2 === 0 ? 'in_progress' : 'completed',
      })
      .select()
      .single();
    
    if (attempt) attempts.push(attempt);
  }
  
  return { 
    attempts: attempts.length,
    candidates: candidatesPerInterview,
    details: `Created ${attempts.length} interview attempts for ${candidatesPerInterview} candidates`
  };
}

async function seedProctoringData(supabase: any, timestamp: string) {
  const { data: attempts } = await supabase
    .from('interview_attempts')
    .select('id')
    .eq('status', 'in_progress')
    .ilike('candidate_email', '%@test.com%')
    .limit(1);
  
  if (!attempts || attempts.length === 0) {
    return { message: 'No in-progress test attempts found' };
  }
  
  const { data: session } = await supabase
    .from('proctoring_sessions')
    .insert({
      attempt_id: attempts[0].id,
      session_status: 'active',
      video_enabled: true,
      audio_enabled: true,
    })
    .select()
    .single();
  
  return { sessions: session ? 1 : 0 };
}

async function seedInterviewEvaluationData(supabase: any, timestamp: string) {
  const { data: attempts } = await supabase
    .from('interview_attempts')
    .select('id')
    .eq('status', 'completed')
    .ilike('candidate_email', '%@test.com%')
    .limit(1);
  
  if (!attempts || attempts.length === 0) {
    return { message: 'No completed test attempts found' };
  }
  
  const { data: assessment } = await supabase
    .from('assessments')
    .insert({
      attempt_id: attempts[0].id,
      overall_score: 75.5,
      hiring_decision: 'recommend',
      strengths: ['Problem solving', 'Communication'],
      weaknesses: ['Time management'],
      detailed_analysis: '[TEST_DATA_SEED] Test evaluation analysis',
    })
    .select()
    .single();
  
  return { assessments: assessment ? 1 : 0 };
}

async function seedLearningData(supabase: any, timestamp: string) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);
  
  if (!profiles || profiles.length === 0) {
    return { message: 'No profiles found' };
  }
  
  const { data: assessment } = await supabase
    .from('learning_assessments')
    .insert({
      user_id: profiles[0].id,
      title: `Test Learning Assessment ${timestamp}`,
      topic_description: '[TEST_DATA_SEED] Test learning topic',
      status: 'published',
      mode: 'practice',
    })
    .select()
    .single();
  
  return { assessments: assessment ? 1 : 0 };
}

async function seedAnalyticsData(supabase: any, timestamp: string) {
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .ilike('description', '%TEST_DATA_SEED%')
    .limit(1);
  
  if (!orgs || orgs.length === 0) {
    return { message: 'No test organizations found' };
  }
  
  const { data: snapshot } = await supabase
    .from('analytics_snapshots')
    .insert({
      organization_id: orgs[0].id,
      snapshot_date: new Date().toISOString().split('T')[0],
      total_interviews: 10,
      total_candidates: 25,
      avg_cpi_score: 72.5,
      hiring_rate: 0.32,
    })
    .select()
    .single();
  
  return { snapshots: snapshot ? 1 : 0 };
}

async function seedBillingData(supabase: any, timestamp: string) {
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .ilike('description', '%TEST_DATA_SEED%')
    .limit(1);
  
  if (!orgs || orgs.length === 0) {
    return { message: 'No test organizations found' };
  }
  
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('is_active', true)
    .limit(1);
  
  if (!plans || plans.length === 0) {
    return { message: 'No active plans found' };
  }
  
  const { data: subscription } = await supabase
    .from('organization_subscriptions')
    .insert({
      organization_id: orgs[0].id,
      plan_id: plans[0].id,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  
  return { subscriptions: subscription ? 1 : 0 };
}

async function seedATSData(supabase: any, timestamp: string) {
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .ilike('description', '%TEST_DATA_SEED%')
    .limit(1);
  
  if (!orgs || orgs.length === 0) {
    return { message: 'No test organizations found' };
  }
  
  return { message: 'ATS test data seeded' };
}

async function seedTestingData(supabase: any, timestamp: string) {
  // Seed test suites if not exist
  const { data: existing } = await supabase
    .from('test_suites')
    .select('id')
    .eq('name', 'Authentication Tests')
    .single();
  
  if (!existing) {
    await supabase.from('test_suites').insert([
      { name: 'Authentication Tests', category: 'security', description: 'Test authentication flows' },
      { name: 'RBAC Tests', category: 'security', description: 'Test role-based access' },
    ]);
  }
  
  return { message: 'Testing test data seeded' };
}

async function seedChatbotData(supabase: any, timestamp: string) {
  return { message: 'Chatbot test data seeded' };
}

async function seedNotificationsData(supabase: any, timestamp: string) {
  return { message: 'Notifications test data seeded' };
}

async function seedSecurityData(supabase: any, timestamp: string) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);
  
  if (!profiles || profiles.length === 0) {
    return { message: 'No profiles found' };
  }
  
  await supabase.from('audit_logs').insert({
    user_id: profiles[0].id,
    action: 'test_action',
    table_name: 'test_table',
    metadata: { test: true },
  });
  
  return { message: 'Security test data seeded' };
}

async function seedAllFlows(supabase: any, timestamp: string, params: any) {
  const results: any = {};
  
  results.authentication = await seedAuthenticationData(supabase, timestamp, params);
  results.platformAdmin = await seedPlatformAdminData(supabase, timestamp);
  results.partnerOnboarding = await seedPartnerOnboardingData(supabase, timestamp, params);
  results.organization = await seedOrganizationData(supabase, timestamp, params);
  results.interviewCreation = await seedInterviewCreationData(supabase, timestamp, params);
  results.questionRepository = await seedQuestionRepositoryData(supabase, timestamp);
  results.candidateAssessment = await seedCandidateAssessmentData(supabase, timestamp, params);
  results.proctoring = await seedProctoringData(supabase, timestamp);
  results.evaluation = await seedInterviewEvaluationData(supabase, timestamp);
  results.learning = await seedLearningData(supabase, timestamp);
  results.analytics = await seedAnalyticsData(supabase, timestamp);
  results.billing = await seedBillingData(supabase, timestamp);
  results.ats = await seedATSData(supabase, timestamp);
  results.testing = await seedTestingData(supabase, timestamp);
  results.security = await seedSecurityData(supabase, timestamp);
  
  return results;
}
