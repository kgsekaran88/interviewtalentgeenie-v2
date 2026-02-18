import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestCase {
  name: string;
  description: string;
  test_type: string;
  expected_result: string;
  test_steps: any;
  severity: string;
  category: string;
}

interface TestSuite {
  name: string;
  description: string;
  category: string;
  test_cases: TestCase[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting comprehensive platform feature scan...');

    // Get database metadata
    const { data: features } = await supabase
      .from('ai_feature_health')
      .select('feature_name, edge_function, is_enabled');

    // Define comprehensive test suites based on platform architecture
    const testSuites: TestSuite[] = [
      {
        name: 'Authentication & Authorization',
        description: 'Complete auth flow and RBAC tests',
        category: 'security',
        test_cases: [
          {
            name: 'User Registration with Email Confirmation',
            description: 'Test complete signup flow with auto-confirm',
            test_type: 'e2e',
            expected_result: 'User registered and can immediately log in',
            test_steps: {
              steps: [
                'Navigate to /auth page',
                'Enter email and password',
                'Submit registration',
                'Verify user created in auth.users',
                'Login with credentials',
                'Verify session established'
              ],
              validation: [
                'Check user_roles table populated',
                'Verify default role assigned',
                'Check audit log entry'
              ]
            },
            severity: 'critical',
            category: 'authentication'
          },
          {
            name: 'Role-Based Access Control (RBAC)',
            description: 'Verify each role can only access authorized resources',
            test_type: 'security',
            expected_result: 'Unauthorized access blocked for all roles',
            test_steps: {
              steps: [
                'Create test users for each role',
                'platform_admin: Access all admin routes',
                'partner_admin: Access org management only',
                'hr_recruiter: Access interview management',
                'candidate: Access take interview only',
                'Attempt unauthorized route access',
                'Verify 403/redirect for unauthorized'
              ],
              validation: [
                'Check RLS policies enforced',
                'Verify route guards working',
                'Check permission checks in edge functions'
              ]
            },
            severity: 'critical',
            category: 'authorization'
          },
          {
            name: 'Password Reset Flow',
            description: 'Complete password reset via email',
            test_type: 'e2e',
            expected_result: 'User can reset password and login',
            test_steps: {
              steps: [
                'Click "Forgot Password"',
                'Enter email',
                'Receive reset link',
                'Click link and set new password',
                'Login with new password'
              ]
            },
            severity: 'high',
            category: 'authentication'
          },
          {
            name: 'Session Management',
            description: 'Test session expiry and refresh',
            test_type: 'security',
            expected_result: 'Sessions expire and refresh correctly',
            test_steps: {
              steps: [
                'Login and establish session',
                'Wait for token expiry',
                'Attempt API call',
                'Verify auto-refresh or re-auth',
                'Logout and verify session cleared'
              ]
            },
            severity: 'medium',
            category: 'session'
          }
        ]
      },
      {
        name: 'Interview Creation & Management',
        description: 'Complete interview lifecycle tests',
        category: 'functionality',
        test_cases: [
          {
            name: 'Create Interview with AI Questions',
            description: 'End-to-end interview creation with AI generation',
            test_type: 'e2e',
            expected_result: 'Interview created with AI-generated questions',
            test_steps: {
              steps: [
                'Login as hr_recruiter',
                'Navigate to /create-interview',
                'Enter job title and description',
                'Select difficulty: medium',
                'Set question count: 10',
                'Set time limit: 60 minutes',
                'Enable proctoring',
                'Submit creation form',
                'Wait for AI question generation',
                'Verify 10 questions created',
                'Verify interview status: active',
                'Check questions stored in database'
              ],
              validation: [
                'Verify interviews table entry',
                'Check questions table (10 rows)',
                'Verify organization_id matches',
                'Check ai_usage_logs for generation'
              ]
            },
            severity: 'critical',
            category: 'core_functionality'
          },
          {
            name: 'Interview Status Workflow',
            description: 'Test all status transitions',
            test_type: 'integration',
            expected_result: 'Interview moves through lifecycle correctly',
            test_steps: {
              steps: [
                'Create interview (status: draft)',
                'Activate interview (status: active)',
                'Invite candidate (status: scheduled)',
                'Candidate completes (status: completed)',
                'Archive interview (status: archived)'
              ],
              validation: [
                'Check status field updates',
                'Verify audit log entries',
                'Check email notifications sent'
              ]
            },
            severity: 'high',
            category: 'workflow'
          },
          {
            name: 'Question Repository Integration',
            description: 'Use pre-approved questions from repository',
            test_type: 'integration',
            expected_result: 'Interview uses repository questions',
            test_steps: {
              steps: [
                'Add questions to repository',
                'Submit for review',
                'Approve questions',
                'Create interview from repository',
                'Verify questions linked'
              ]
            },
            severity: 'medium',
            category: 'question_management'
          },
          {
            name: 'Bulk Interview Operations',
            description: 'Perform bulk actions on multiple interviews',
            test_type: 'performance',
            expected_result: 'Bulk operations complete without errors',
            test_steps: {
              steps: [
                'Create 10 test interviews',
                'Select all 10',
                'Bulk activate',
                'Bulk schedule candidates',
                'Bulk archive',
                'Verify all operations succeeded'
              ]
            },
            severity: 'medium',
            category: 'bulk_operations'
          }
        ]
      },
      {
        name: 'Candidate Journey & Interview Taking',
        description: 'Complete candidate experience tests',
        category: 'functionality',
        test_cases: [
          {
            name: 'Complete Interview Attempt Flow',
            description: 'Candidate completes full interview',
            test_type: 'e2e',
            expected_result: 'Candidate submits interview and receives assessment',
            test_steps: {
              steps: [
                'Receive interview invitation email',
                'Click interview link',
                'Enter candidate details',
                'Start interview',
                'Grant proctoring permissions',
                'Answer all 10 questions',
                'Submit interview',
                'Verify attempt recorded',
                'Trigger AI evaluation',
                'Wait for assessment generation',
                'Check CPI calculated',
                'Verify hiring recommendation'
              ],
              validation: [
                'Check interview_attempts table',
                'Verify responses table (10 rows)',
                'Check assessments table',
                'Verify candidate_performance_index',
                'Check proctoring_sessions table'
              ]
            },
            severity: 'critical',
            category: 'core_functionality'
          },
          {
            name: 'Resume-Based Question Generation',
            description: 'Generate questions from candidate resume',
            test_type: 'ai_integration',
            expected_result: 'Questions tailored to resume skills',
            test_steps: {
              steps: [
                'Upload resume PDF',
                'Trigger parse-resume function',
                'Extract skills and experience',
                'Generate questions based on skills',
                'Verify questions match resume'
              ],
              validation: [
                'Check resume_url stored',
                'Verify skills extracted',
                'Check questions relate to skills'
              ]
            },
            severity: 'high',
            category: 'ai_features'
          },
          {
            name: 'Code Question Execution',
            description: 'Execute and evaluate coding questions',
            test_type: 'integration',
            expected_result: 'Code runs and output captured',
            test_steps: {
              steps: [
                'Load coding question',
                'Write code in editor',
                'Execute code',
                'Verify output captured',
                'Check test cases passed'
              ]
            },
            severity: 'medium',
            category: 'coding_assessment'
          }
        ]
      },
      {
        name: 'Proctoring & Integrity Monitoring',
        description: 'Real-time monitoring and violation detection',
        category: 'security',
        test_cases: [
          {
            name: 'Complete Proctoring Session',
            description: 'Monitor candidate with violation detection',
            test_type: 'e2e',
            expected_result: 'Violations detected and integrity score calculated',
            test_steps: {
              steps: [
                'Enable proctoring on interview',
                'Start candidate session',
                'Initialize camera and microphone',
                'Run face detection',
                'Simulate tab switch',
                'Simulate multiple persons',
                'Simulate look away',
                'Complete interview',
                'Process violations',
                'Calculate integrity score',
                'Generate proctoring report'
              ],
              validation: [
                'Check proctoring_sessions table',
                'Verify proctoring_violations table',
                'Check integrity_score calculated',
                'Verify video recording uploaded'
              ]
            },
            severity: 'critical',
            category: 'integrity'
          },
          {
            name: 'Video Recording & Playback',
            description: 'Record session and play back violations',
            test_type: 'integration',
            expected_result: 'Video recorded with timestamps',
            test_steps: {
              steps: [
                'Start proctored interview',
                'Record video stream',
                'Upload chunks to storage',
                'Mark violation timestamps',
                'Retrieve video URL',
                'Play back video at violation time'
              ]
            },
            severity: 'high',
            category: 'media'
          },
          {
            name: 'Pre-Interview System Checks',
            description: 'Verify camera/mic before interview',
            test_type: 'integration',
            expected_result: 'All system checks pass',
            test_steps: {
              steps: [
                'Request camera permission',
                'Test camera stream',
                'Request mic permission',
                'Test audio levels',
                'Check internet speed',
                'Verify browser compatibility'
              ]
            },
            severity: 'medium',
            category: 'pre_checks'
          }
        ]
      },
      {
        name: 'AI Configuration & Health',
        description: 'Dynamic AI provider and model management',
        category: 'ai_features',
        test_cases: [
          {
            name: 'Dynamic Model Loading',
            description: 'Models load from database not hardcoded',
            test_type: 'integration',
            expected_result: 'All models dynamically loaded',
            test_steps: {
              steps: [
                'Query ai_providers table',
                'Get supported_models JSON',
                'Load models in UI dropdown',
                'Add new model to database',
                'Refresh UI',
                'Verify new model appears'
              ],
              validation: [
                'No hardcoded model lists in code',
                'Models match database exactly',
                'UI updates on database change'
              ]
            },
            severity: 'critical',
            category: 'configuration'
          },
          {
            name: 'AI Feature Health Monitoring',
            description: 'Track feature usage and health',
            test_type: 'monitoring',
            expected_result: 'Health metrics updated in real-time',
            test_steps: {
              steps: [
                'Trigger AI feature (e.g., generate-questions)',
                'Check ai_feature_health updated',
                'Verify metrics: total_requests++',
                'Check successful_requests++',
                'Verify average_latency_ms updated',
                'Simulate failure',
                'Check failed_requests++',
                'Verify alert created if threshold exceeded'
              ]
            },
            severity: 'high',
            category: 'monitoring'
          },
          {
            name: 'Model Fallback on Failure',
            description: 'Switch to fallback on primary failure',
            test_type: 'resilience',
            expected_result: 'Fallback model used automatically',
            test_steps: {
              steps: [
                'Configure primary + fallback',
                'Disable primary provider',
                'Trigger AI feature',
                'Verify fallback used',
                'Check ai_usage_logs.fallback_used = true',
                'Re-enable primary',
                'Verify switches back'
              ]
            },
            severity: 'high',
            category: 'reliability'
          },
          {
            name: 'Feature Scan & Auto-Configuration',
            description: 'Scan codebase and create configs',
            test_type: 'automation',
            expected_result: 'All AI features detected and configured',
            test_steps: {
              steps: [
                'Run scan-ai-features function',
                'Count features in ai_feature_health',
                'Verify all edge functions included',
                'Check no duplicates created',
                'Verify default configurations set'
              ]
            },
            severity: 'medium',
            category: 'automation'
          }
        ]
      },
      {
        name: 'Organization & Partner Management',
        description: 'Multi-tenant organization tests',
        category: 'functionality',
        test_cases: [
          {
            name: 'Partner Onboarding Flow',
            description: 'Complete partner registration and approval',
            test_type: 'e2e',
            expected_result: 'Partner onboarded and operational',
            test_steps: {
              steps: [
                'Submit partner application',
                'Platform admin reviews',
                'Approve partner',
                'Assign subscription plan',
                'Partner admin receives invite',
                'Partner logs in',
                'Create organization',
                'Verify plan limits enforced',
                'Add team members'
              ],
              validation: [
                'Check organizations table',
                'Verify subscription_plans',
                'Check user_roles for partner_admin',
                'Verify RLS policies isolate org data'
              ]
            },
            severity: 'critical',
            category: 'onboarding'
          },
          {
            name: 'Organization Data Isolation (RLS)',
            description: 'Verify cross-org access blocked',
            test_type: 'security',
            expected_result: 'Users see only own org data',
            test_steps: {
              steps: [
                'Create org A and org B',
                'Create users in each',
                'Org A user queries interviews',
                'Verify only org A interviews returned',
                'Attempt to access org B data',
                'Verify access denied',
                'Check RLS policies enforced'
              ]
            },
            severity: 'critical',
            category: 'security'
          },
          {
            name: 'Organization Settings Management',
            description: 'Update org settings and branding',
            test_type: 'integration',
            expected_result: 'Settings updated successfully',
            test_steps: {
              steps: [
                'Login as partner_admin',
                'Navigate to org settings',
                'Update company name',
                'Upload logo',
                'Set email templates',
                'Save changes',
                'Verify updates reflected'
              ]
            },
            severity: 'medium',
            category: 'configuration'
          }
        ]
      },
      {
        name: 'Analytics & Reporting',
        description: 'CPI calculation and comparative analytics',
        category: 'functionality',
        test_cases: [
          {
            name: 'CPI Calculation Flow',
            description: 'Calculate Candidate Performance Index',
            test_type: 'e2e',
            expected_result: 'CPI calculated with all components',
            test_steps: {
              steps: [
                'Candidate completes interview',
                'Trigger evaluate-interview',
                'Calculate technical_score (0-100)',
                'Calculate problem_solving_score',
                'Get integrity_score from proctoring',
                'Compute overall_cpi = weighted average',
                'Break down by topic/skill',
                'Generate hiring_recommendation',
                'Store in candidate_performance_index'
              ],
              validation: [
                'Verify technical_score calculated',
                'Check problem_solving_score',
                'Verify integrity_score included',
                'Check overall_cpi = (tech*0.5 + ps*0.3 + int*0.2)',
                'Verify hiring_recommendation logic'
              ]
            },
            severity: 'critical',
            category: 'analytics'
          },
          {
            name: 'Comparative Analytics Report',
            description: 'Compare multiple candidates',
            test_type: 'integration',
            expected_result: 'Comparison report with insights',
            test_steps: {
              steps: [
                'Create 5 candidate attempts',
                'Evaluate all',
                'Generate comparative report',
                'Verify metrics: avg score, top performer',
                'Check skill distribution',
                'Generate visualization data'
              ]
            },
            severity: 'medium',
            category: 'reporting'
          },
          {
            name: 'Custom Report Builder',
            description: 'Build custom reports with filters',
            test_type: 'integration',
            expected_result: 'Custom report generated',
            test_steps: {
              steps: [
                'Select report type',
                'Set date range',
                'Apply filters (role, score)',
                'Select metrics',
                'Generate report',
                'Export to PDF/CSV'
              ]
            },
            severity: 'medium',
            category: 'reporting'
          }
        ]
      },
      {
        name: 'Learning & Certification Platform',
        description: 'Learning paths and certification tests',
        category: 'functionality',
        test_cases: [
          {
            name: 'Complete Certification Flow',
            description: 'Earn certification after assessment',
            test_type: 'e2e',
            expected_result: 'Certificate issued and verifiable',
            test_steps: {
              steps: [
                'Browse certification topics',
                'Select certification',
                'Check subscription requirement',
                'Take certification assessment',
                'Answer all questions',
                'Submit assessment',
                'AI evaluation',
                'Score >= passing_score',
                'Generate certificate PDF',
                'Assign certificate number',
                'Store in certificates table',
                'Verify certificate via code'
              ],
              validation: [
                'Check certificates table entry',
                'Verify PDF generated',
                'Check verification_code works',
                'Verify expiry date set'
              ]
            },
            severity: 'high',
            category: 'certification'
          },
          {
            name: 'Learning Plan Generation',
            description: 'AI generates personalized learning plan',
            test_type: 'ai_integration',
            expected_result: 'Learning plan created with milestones',
            test_steps: {
              steps: [
                'Analyze user skills',
                'Identify gaps',
                'Generate learning modules',
                'Set milestones',
                'Track progress'
              ]
            },
            severity: 'medium',
            category: 'learning'
          },
          {
            name: 'Badge System',
            description: 'Earn badges for achievements',
            test_type: 'integration',
            expected_result: 'Badges awarded automatically',
            test_steps: {
              steps: [
                'Define badge requirements',
                'User completes requirement',
                'Award badge',
                'Display in profile',
                'Track badge collection'
              ]
            },
            severity: 'low',
            category: 'gamification'
          }
        ]
      },
      {
        name: 'ATS Integration',
        description: 'External ATS system sync',
        category: 'integration',
        test_cases: [
          {
            name: 'ATS Candidate Sync',
            description: 'Sync candidates from ATS',
            test_type: 'integration',
            expected_result: 'Candidates synced with interviews created',
            test_steps: {
              steps: [
                'Configure ATS integration',
                'Set webhook URL',
                'ATS sends candidate data',
                'Webhook receives POST',
                'Parse candidate info',
                'Create ats_candidates entry',
                'Auto-create interview',
                'Send invitation',
                'Log sync status'
              ],
              validation: [
                'Check ats_candidates table',
                'Verify interview created',
                'Check ats_sync_logs'
              ]
            },
            severity: 'high',
            category: 'automation'
          }
        ]
      },
      {
        name: 'Performance & Scalability',
        description: 'Load testing and performance',
        category: 'performance',
        test_cases: [
          {
            name: 'Concurrent Interview Attempts',
            description: 'Handle 50 simultaneous attempts',
            test_type: 'performance',
            expected_result: 'All attempts complete successfully',
            test_steps: {
              steps: [
                'Create 50 parallel interview starts',
                'Monitor response times',
                'Check database load',
                'Verify all complete',
                'Check error rate < 1%'
              ]
            },
            severity: 'medium',
            category: 'load_testing'
          },
          {
            name: 'AI Evaluation Performance',
            description: 'Evaluate 100 interviews in parallel',
            test_type: 'performance',
            expected_result: 'All evaluations complete within SLA',
            test_steps: {
              steps: [
                'Queue 100 evaluations',
                'Monitor processing time',
                'Check average latency',
                'Verify fallback usage',
                'Ensure all complete'
              ]
            },
            severity: 'medium',
            category: 'ai_performance'
          }
        ]
      },
      {
        name: 'Data Security & Privacy',
        description: 'GDPR compliance and security',
        category: 'security',
        test_cases: [
          {
            name: 'GDPR Data Deletion Request',
            description: 'Delete all candidate data',
            test_type: 'compliance',
            expected_result: 'All PII deleted per GDPR',
            test_steps: {
              steps: [
                'Candidate requests deletion',
                'Admin reviews request',
                'Approve deletion',
                'Delete from all tables',
                'Anonymize audit logs',
                'Remove backups',
                'Send confirmation'
              ],
              validation: [
                'Check data_deletion_requests',
                'Verify all PII removed',
                'Check audit logs'
              ]
            },
            severity: 'critical',
            category: 'gdpr'
          },
          {
            name: 'RLS Policy Comprehensive Test',
            description: 'Test all table RLS policies',
            test_type: 'security',
            expected_result: 'All tables secured with RLS',
            test_steps: {
              steps: [
                'Run Supabase linter',
                'Check each table has RLS enabled',
                'Test policies for each role',
                'Attempt bypass',
                'Verify policies hold'
              ]
            },
            severity: 'critical',
            category: 'database_security'
          }
        ]
      },
      {
        name: 'Billing & Subscription Management',
        description: 'Plan limits and billing tests',
        category: 'functionality',
        test_cases: [
          {
            name: 'Plan Limit Enforcement',
            description: 'Block actions when limits reached',
            test_type: 'integration',
            expected_result: 'Actions blocked at plan limits',
            test_steps: {
              steps: [
                'Create organization with starter plan',
                'Check interview limit (e.g., 10)',
                'Create 10 interviews',
                'Attempt to create 11th',
                'Verify blocked with upgrade prompt',
                'Upgrade to growth plan',
                'Verify limit increased'
              ]
            },
            severity: 'high',
            category: 'billing'
          }
        ]
      }
    ];

    console.log(`Generated ${testSuites.length} comprehensive test suites`);

    // Clear existing test data
    await supabase.from('test_cases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('test_suites').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert test suites and test cases
    let totalTestCases = 0;

    for (const suite of testSuites) {
      const { data: insertedSuite, error: suiteError } = await supabase
        .from('test_suites')
        .insert({
          name: suite.name,
          description: suite.description,
          category: suite.category,
          enabled: true
        })
        .select()
        .single();

      if (suiteError || !insertedSuite) {
        console.error('Error inserting suite:', suiteError);
        continue;
      }

      console.log(`Created suite: ${suite.name} (${insertedSuite.id})`);

      // Insert test cases
      for (const testCase of suite.test_cases) {
        const { error: caseError } = await supabase
          .from('test_cases')
          .insert({
            suite_id: insertedSuite.id,
            name: testCase.name,
            description: testCase.description,
            test_type: testCase.test_type,
            expected_result: testCase.expected_result,
            test_steps: testCase.test_steps,
            severity: testCase.severity,
            category: testCase.category,
            enabled: true
          });

        if (!caseError) {
          totalTestCases++;
        }
      }
    }

    console.log(`Successfully created ${totalTestCases} test cases across ${testSuites.length} suites`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Platform feature scan complete',
        summary: {
          total_suites: testSuites.length,
          total_test_cases: totalTestCases,
          categories: [...new Set(testSuites.map(s => s.category))],
          edge_functions_found: features?.length || 0
        },
        suites: testSuites.map(s => ({
          name: s.name,
          test_count: s.test_cases.length
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in scan-platform-features:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});