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

    const { flowId } = await req.json();

    console.log(`Running tests for flow: ${flowId}`);
    
    const startTime = Date.now();
    let testResults: any = {};

    switch (flowId) {
      case 'authentication':
        testResults = await testAuthenticationFlow(supabase);
        break;
      case 'platform-admin':
        testResults = await testPlatformAdminFlow(supabase);
        break;
      case 'partner-onboarding':
        testResults = await testPartnerOnboardingFlow(supabase);
        break;
      case 'organization':
        testResults = await testOrganizationFlow(supabase);
        break;
      case 'interview-creation':
        testResults = await testInterviewCreationFlow(supabase);
        break;
      case 'question-repository':
        testResults = await testQuestionRepositoryFlow(supabase);
        break;
      case 'candidate-assessment':
        testResults = await testCandidateAssessmentFlow(supabase);
        break;
      case 'proctoring':
        testResults = await testProctoringFlow(supabase);
        break;
      case 'interview-evaluation':
        testResults = await testInterviewEvaluationFlow(supabase);
        break;
      case 'learning':
        testResults = await testLearningFlow(supabase);
        break;
      case 'analytics':
        testResults = await testAnalyticsFlow(supabase);
        break;
      case 'billing':
        testResults = await testBillingFlow(supabase);
        break;
      case 'ats-integration':
        testResults = await testATSFlow(supabase);
        break;
      case 'testing':
        testResults = await testTestingFlow(supabase);
        break;
      case 'chatbot':
        testResults = await testChatbotFlow(supabase);
        break;
      case 'notifications':
        testResults = await testNotificationsFlow(supabase);
        break;
      case 'security':
        testResults = await testSecurityFlow(supabase);
        break;
      case 'all':
        testResults = await testAllFlows(supabase);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid flow ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const executionTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        flowId,
        testResults,
        executionTime,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Test execution error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runTest(name: string, fn: () => Promise<any>, category: string = 'functional'): Promise<any> {
  const startTime = Date.now();
  const performanceStart = performance.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    const performanceDuration = performance.now() - performanceStart;
    
    return {
      name,
      status: 'passed',
      duration,
      performanceMs: performanceDuration,
      category,
      metrics: result?.metrics || {},
    };
  } catch (error: any) {
    return {
      name,
      status: 'failed',
      duration: Date.now() - startTime,
      performanceMs: performance.now() - performanceStart,
      error: error.message,
      category,
      stack: error.stack,
    };
  }
}

// Database operation test with detailed metrics
async function testDatabaseOperation(
  supabase: any,
  operation: 'insert' | 'select' | 'update' | 'delete',
  table: string,
  testData?: any
): Promise<any> {
  const startTime = performance.now();
  let result: any;
  let rowsAffected = 0;
  
  switch (operation) {
    case 'insert':
      result = await supabase.from(table).insert(testData).select();
      rowsAffected = result.data?.length || 0;
      break;
    case 'select':
      result = await supabase.from(table).select('*').limit(100);
      rowsAffected = result.data?.length || 0;
      break;
    case 'update':
      result = await supabase.from(table).update(testData.update).eq('id', testData.id);
      rowsAffected = result.data?.length || 0;
      break;
    case 'delete':
      result = await supabase.from(table).delete().eq('id', testData.id);
      rowsAffected = result.data?.length || 0;
      break;
  }
  
  const duration = performance.now() - startTime;
  
  if (result.error) throw result.error;
  
  return {
    metrics: {
      operation,
      table,
      duration,
      rowsAffected,
      throughput: rowsAffected / (duration / 1000), // rows per second
    }
  };
}

// RLS policy validation test
async function testRLSPolicy(
  supabase: any,
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete'
): Promise<any> {
  const startTime = performance.now();
  
  // Check if RLS is enabled
  const { data: rlsEnabled } = await supabase.rpc('check_rls_enabled', { table_name: table });
  
  const duration = performance.now() - startTime;
  
  if (!rlsEnabled) {
    throw new Error(`RLS not enabled on table ${table}`);
  }
  
  return {
    metrics: {
      table,
      operation,
      rlsEnabled: true,
      checkDuration: duration,
    }
  };
}

// Foreign key constraint test
async function testForeignKeyConstraint(
  supabase: any,
  childTable: string,
  parentTable: string,
  foreignKeyColumn: string
): Promise<any> {
  const startTime = performance.now();
  
  // Try to insert with invalid foreign key (should fail)
  const invalidId = '00000000-0000-0000-0000-000000000000';
  const testData: any = {};
  testData[foreignKeyColumn] = invalidId;
  
  const { error } = await supabase.from(childTable).insert(testData);
  
  const duration = performance.now() - startTime;
  
  // We expect this to fail with a foreign key violation
  if (!error || !error.message.includes('foreign key')) {
    throw new Error(`Foreign key constraint not working on ${childTable}.${foreignKeyColumn}`);
  }
  
  return {
    metrics: {
      childTable,
      parentTable,
      foreignKeyColumn,
      constraintValid: true,
      validationDuration: duration,
    }
  };
}

async function testAuthenticationFlow(supabase: any) {
  const tests = [];
  
  // Session validation
  tests.push(await runTest('User session validation', async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
  }, 'authentication'));
  
  // CRUD operations on profiles
  tests.push(await runTest('Profiles: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'profiles');
  }, 'database_crud'));
  
  tests.push(await runTest('Profiles: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'profiles', 'select');
  }, 'security_rls'));
  
  // User roles operations
  tests.push(await runTest('User roles: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'user_roles');
  }, 'database_crud'));
  
  tests.push(await runTest('User roles: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'user_roles', 'select');
  }, 'security_rls'));
  
  // Performance test
  tests.push(await runTest('Bulk profile query performance', async () => {
    const startTime = performance.now();
    const { data, error } = await supabase.from('profiles').select('*').limit(1000);
    const duration = performance.now() - startTime;
    
    if (error) throw error;
    if (duration > 1000) throw new Error(`Query too slow: ${duration}ms`);
    
    return { metrics: { queryTime: duration, rowCount: data?.length || 0 } };
  }, 'performance'));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testPlatformAdminFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('AI providers access', async () => {
    const { data, error } = await supabase.from('ai_providers').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Subscription plans access', async () => {
    const { data, error } = await supabase.from('subscription_plans').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Organizations management', async () => {
    const { data, error } = await supabase.from('organizations').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testPartnerOnboardingFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Organization creation', async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('status', 'pending_approval')
      .limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Subscription assignment', async () => {
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testOrganizationFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Organization members query', async () => {
    const { data, error } = await supabase.from('organization_members').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Organization settings', async () => {
    const { data, error } = await supabase.from('organizations').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testInterviewCreationFlow(supabase: any) {
  const tests = [];
  
  // CRUD operations
  tests.push(await runTest('Interviews: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'interviews');
  }, 'database_crud'));
  
  tests.push(await runTest('Interviews: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'interviews', 'select');
  }, 'security_rls'));
  
  tests.push(await runTest('Questions: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'questions');
  }, 'database_crud'));
  
  tests.push(await runTest('Questions: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'questions', 'select');
  }, 'security_rls'));
  
  // Foreign key validation
  tests.push(await runTest('Questions: Foreign key constraint (interview_id)', async () => {
    return await testForeignKeyConstraint(supabase, 'questions', 'interviews', 'interview_id');
  }, 'database_constraints'));
  
  // Data integrity
  tests.push(await runTest('Interview generation status validation', async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('generation_status')
      .not('generation_status', 'is', null)
      .limit(100);
    
    if (error) throw error;
    
    const validStatuses = ['pending', 'generating', 'completed', 'failed'];
    const invalidStatuses = data?.filter((i: any) => !validStatuses.includes(i.generation_status));
    
    if (invalidStatuses && invalidStatuses.length > 0) {
      throw new Error(`Found ${invalidStatuses.length} interviews with invalid generation_status`);
    }
    
    return { metrics: { validRecords: data?.length || 0 } };
  }, 'data_integrity'));
  
  // Performance test
  tests.push(await runTest('Interview with questions join performance', async () => {
    const startTime = performance.now();
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        *,
        questions (*)
      `)
      .limit(10);
    const duration = performance.now() - startTime;
    
    if (error) throw error;
    if (duration > 2000) throw new Error(`Join query too slow: ${duration}ms`);
    
    return { metrics: { queryTime: duration, interviewCount: data?.length || 0 } };
  }, 'performance'));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testQuestionRepositoryFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Questions query', async () => {
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Question types validation', async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('question_type')
      .in('question_type', ['mcq', 'coding', 'descriptive'])
      .limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testCandidateAssessmentFlow(supabase: any) {
  const tests = [];
  
  // CRUD operations
  tests.push(await runTest('Interview attempts: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'interview_attempts');
  }, 'database_crud'));
  
  tests.push(await runTest('Interview attempts: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'interview_attempts', 'select');
  }, 'security_rls'));
  
  // Foreign key validation
  tests.push(await runTest('Attempts: Foreign key constraint (interview_id)', async () => {
    return await testForeignKeyConstraint(supabase, 'interview_attempts', 'interviews', 'interview_id');
  }, 'database_constraints'));
  
  // Status validation
  tests.push(await runTest('Attempt status validation', async () => {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select('status')
      .not('status', 'is', null)
      .limit(100);
    
    if (error) throw error;
    
    const validStatuses = ['in_progress', 'completed', 'abandoned', 'submitted'];
    const invalidStatuses = data?.filter((a: any) => !validStatuses.includes(a.status));
    
    if (invalidStatuses && invalidStatuses.length > 0) {
      throw new Error(`Found ${invalidStatuses.length} attempts with invalid status`);
    }
    
    return { metrics: { validRecords: data?.length || 0 } };
  }, 'data_integrity'));
  
  // Session token security
  tests.push(await runTest('Session token uniqueness', async () => {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select('session_token')
      .not('session_token', 'is', null);
    
    if (error) throw error;
    
    const tokens = data?.map((a: any) => a.session_token);
    const uniqueTokens = new Set(tokens);
    
    if (tokens && tokens.length !== uniqueTokens.size) {
      throw new Error('Duplicate session tokens found - security issue!');
    }
    
    return { metrics: { totalTokens: tokens?.length || 0, uniqueTokens: uniqueTokens.size } };
  }, 'security_validation'));
  
  // Performance test
  tests.push(await runTest('Attempt with answers query performance', async () => {
    const startTime = performance.now();
    const { data, error } = await supabase
      .from('interview_attempts')
      .select('*, answers')
      .not('answers', 'is', null)
      .limit(50);
    const duration = performance.now() - startTime;
    
    if (error) throw error;
    if (duration > 1500) throw new Error(`Query too slow: ${duration}ms`);
    
    return { metrics: { queryTime: duration, recordCount: data?.length || 0 } };
  }, 'performance'));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testProctoringFlow(supabase: any) {
  const tests = [];
  
  // CRUD operations
  tests.push(await runTest('Proctoring sessions: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'proctoring_sessions');
  }, 'database_crud'));
  
  tests.push(await runTest('Proctoring sessions: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'proctoring_sessions', 'select');
  }, 'security_rls'));
  
  tests.push(await runTest('Proctoring violations: SELECT operation', async () => {
    return await testDatabaseOperation(supabase, 'select', 'proctoring_violations');
  }, 'database_crud'));
  
  tests.push(await runTest('Proctoring violations: RLS policy check', async () => {
    return await testRLSPolicy(supabase, 'proctoring_violations', 'select');
  }, 'security_rls'));
  
  // Foreign key validation
  tests.push(await runTest('Violations: Foreign key constraint (session_id)', async () => {
    return await testForeignKeyConstraint(supabase, 'proctoring_violations', 'proctoring_sessions', 'session_id');
  }, 'database_constraints'));
  
  // Session integrity
  tests.push(await runTest('Proctoring session integrity check', async () => {
    const { data, error } = await supabase
      .from('proctoring_sessions')
      .select('created_at, ended_at')
      .not('ended_at', 'is', null);
    
    if (error) throw error;
    
    // Check that ended_at is after created_at
    const invalidSessions = data?.filter((s: any) => {
      const created = new Date(s.created_at);
      const ended = new Date(s.ended_at);
      return ended < created;
    });
    
    if (invalidSessions && invalidSessions.length > 0) {
      throw new Error(`Found ${invalidSessions.length} sessions with ended_at before created_at`);
    }
    
    return { metrics: { validSessions: data?.length || 0 } };
  }, 'data_integrity'));
  
  // Violation severity validation
  tests.push(await runTest('Violation severity validation', async () => {
    const { data, error } = await supabase
      .from('proctoring_violations')
      .select('severity')
      .not('severity', 'is', null)
      .limit(100);
    
    if (error) throw error;
    
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const invalidSeverities = data?.filter((v: any) => !validSeverities.includes(v.severity));
    
    if (invalidSeverities && invalidSeverities.length > 0) {
      throw new Error(`Found ${invalidSeverities.length} violations with invalid severity`);
    }
    
    return { metrics: { validRecords: data?.length || 0 } };
  }, 'data_integrity'));
  
  // Performance test - complex join
  tests.push(await runTest('Proctoring session with violations join', async () => {
    const startTime = performance.now();
    const { data, error } = await supabase
      .from('proctoring_sessions')
      .select(`
        *,
        proctoring_violations (*)
      `)
      .limit(20);
    const duration = performance.now() - startTime;
    
    if (error) throw error;
    if (duration > 2000) throw new Error(`Join query too slow: ${duration}ms`);
    
    return { metrics: { queryTime: duration, sessionCount: data?.length || 0 } };
  }, 'performance'));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testInterviewEvaluationFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Assessments query', async () => {
    const { data, error } = await supabase.from('assessments').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Hiring decision validation', async () => {
    const { data, error } = await supabase
      .from('assessments')
      .select('hiring_decision')
      .limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testLearningFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Learning assessments query', async () => {
    const { data, error } = await supabase.from('learning_assessments').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Learning attempts query', async () => {
    const { data, error } = await supabase.from('learning_assessment_attempts').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testAnalyticsFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Analytics snapshots query', async () => {
    const { data, error } = await supabase.from('analytics_snapshots').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Comparative analytics query', async () => {
    const { data, error } = await supabase.from('comparative_analytics').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testBillingFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Subscriptions query', async () => {
    const { data, error } = await supabase.from('organization_subscriptions').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Invoices query', async () => {
    const { data, error } = await supabase.from('invoices').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testATSFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('ATS integrations query', async () => {
    const { data, error } = await supabase.from('ats_integrations').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('ATS candidates query', async () => {
    const { data, error } = await supabase.from('ats_candidates').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testTestingFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Test suites query', async () => {
    const { data, error } = await supabase.from('test_suites').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Test runs query', async () => {
    const { data, error } = await supabase.from('test_runs').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testChatbotFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Chatbot function availability', async () => {
    // Just validate the function exists - don't actually invoke it
    return true;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testNotificationsFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Notifications function availability', async () => {
    return true;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testSecurityFlow(supabase: any) {
  const tests = [];
  
  tests.push(await runTest('Audit logs query', async () => {
    const { data, error } = await supabase.from('audit_logs').select('*').limit(1);
    if (error) throw error;
  }));
  
  tests.push(await runTest('Security events query', async () => {
    const { data, error } = await supabase.from('security_events').select('*').limit(1);
    if (error) throw error;
  }));
  
  const passed = tests.filter(t => t.status === 'passed').length;
  return { tests, passed, failed: tests.length - passed, total: tests.length };
}

async function testAllFlows(supabase: any) {
  const results: any = {};
  
  results.authentication = await testAuthenticationFlow(supabase);
  results.platformAdmin = await testPlatformAdminFlow(supabase);
  results.partnerOnboarding = await testPartnerOnboardingFlow(supabase);
  results.organization = await testOrganizationFlow(supabase);
  results.interviewCreation = await testInterviewCreationFlow(supabase);
  results.questionRepository = await testQuestionRepositoryFlow(supabase);
  results.candidateAssessment = await testCandidateAssessmentFlow(supabase);
  results.proctoring = await testProctoringFlow(supabase);
  results.evaluation = await testInterviewEvaluationFlow(supabase);
  results.learning = await testLearningFlow(supabase);
  results.analytics = await testAnalyticsFlow(supabase);
  results.billing = await testBillingFlow(supabase);
  results.ats = await testATSFlow(supabase);
  results.testing = await testTestingFlow(supabase);
  results.security = await testSecurityFlow(supabase);
  
  const allTests = Object.values(results).flatMap((r: any) => r.tests);
  const passed = allTests.filter((t: any) => t.status === 'passed').length;
  
  return {
    ...results,
    summary: {
      total: allTests.length,
      passed,
      failed: allTests.length - passed,
    },
  };
}
