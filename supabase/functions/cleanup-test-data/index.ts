import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has platform_admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => r.role === 'platform_admin')) {
      return new Response(JSON.stringify({ error: 'Access denied. Platform admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deletionResults = {
      organizations: 0,
      interviews: 0,
      attempts: 0,
      assessments: 0,
      questions: 0,
      proctoring_sessions: 0,
      subscriptions: 0,
      members: 0,
    };

    console.log('Starting test data cleanup...');

    // 1. Find all test organizations
    // Includes multiple test data patterns:
    // - Name patterns: "Test Organization%", "[TEST]%", "test_%"
    // - Email patterns: @test.com, test@%, %test%
    const { data: testOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, contact_email, created_at, description');

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      throw new Error(`Failed to fetch test organizations: ${orgsError.message}`);
    }

    // ONLY delete organizations with the specific system-generated marker
    const seedOrgs = testOrgs?.filter(org => {
      // ONLY delete if it has the [TEST_DATA_SEED] marker
      return org.description?.includes('[TEST_DATA_SEED]');
    }) || [];

    if (!seedOrgs || seedOrgs.length === 0) {
      console.log('No test data found to clean up.');
      return new Response(JSON.stringify({
        success: true,
        message: 'No test data found to clean up.',
        deletionResults,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const testOrgIds = seedOrgs.map(org => org.id);
    console.log(`Found ${testOrgIds.length} test organizations to clean up:`, seedOrgs.map(o => o.name));

    // 2. Delete organization subscriptions
    const { error: subsError, count: subsCount } = await supabase
      .from('organization_subscriptions')
      .delete()
      .in('organization_id', testOrgIds);

    if (subsError) {
      console.error('Error deleting subscriptions:', subsError);
    } else if (subsCount) {
      deletionResults.subscriptions = subsCount;
      console.log(`Deleted ${subsCount} subscriptions`);
    }

    // 3. Delete organization members
    const { error: membersError, count: membersCount } = await supabase
      .from('organization_members')
      .delete()
      .in('organization_id', testOrgIds);

    if (membersError) {
      console.error('Error deleting organization members:', membersError);
    } else if (membersCount) {
      deletionResults.members = membersCount;
      console.log(`Deleted ${membersCount} organization members`);
    }

    // 4. Find all test interviews
    const { data: testInterviews } = await supabase
      .from('interviews')
      .select('id')
      .in('organization_id', testOrgIds);

    if (testInterviews && testInterviews.length > 0) {
      const testInterviewIds = testInterviews.map(i => i.id);
      console.log(`Found ${testInterviewIds.length} test interviews`);

      // 5. Find all test attempts
      const { data: testAttempts } = await supabase
        .from('interview_attempts')
        .select('id')
        .in('interview_id', testInterviewIds);

      if (testAttempts && testAttempts.length > 0) {
        const testAttemptIds = testAttempts.map(a => a.id);
        console.log(`Found ${testAttemptIds.length} test attempts`);

        // 6. Delete proctoring sessions
        const { error: procError, count: procCount } = await supabase
          .from('proctoring_sessions')
          .delete()
          .in('interview_attempt_id', testAttemptIds);

        if (procError) {
          console.error('Error deleting proctoring sessions:', procError);
        } else if (procCount) {
          deletionResults.proctoring_sessions = procCount;
          console.log(`Deleted ${procCount} proctoring sessions`);
        }

        // 7. Delete attempt questions
        await supabase
          .from('attempt_questions')
          .delete()
          .in('attempt_id', testAttemptIds);

        // 8. Delete assessments
        const { error: assessError, count: assessCount } = await supabase
          .from('assessments')
          .delete()
          .in('attempt_id', testAttemptIds);

        if (assessError) {
          console.error('Error deleting assessments:', assessError);
        } else if (assessCount) {
          deletionResults.assessments = assessCount;
          console.log(`Deleted ${assessCount} assessments`);
        }

        // 9. Delete attempts
        const { error: attemptsError, count: attemptsCount } = await supabase
          .from('interview_attempts')
          .delete()
          .in('id', testAttemptIds);

        if (attemptsError) {
          console.error('Error deleting attempts:', attemptsError);
        } else if (attemptsCount) {
          deletionResults.attempts = attemptsCount;
          console.log(`Deleted ${attemptsCount} attempts`);
        }
      }

      // 10. Delete questions
      const { error: questionsError, count: questionsCount } = await supabase
        .from('questions')
        .delete()
        .in('interview_id', testInterviewIds);

      if (questionsError) {
        console.error('Error deleting questions:', questionsError);
      } else if (questionsCount) {
        deletionResults.questions = questionsCount;
        console.log(`Deleted ${questionsCount} questions`);
      }

      // 11. Delete interviews
      const { error: interviewsError, count: interviewsCount } = await supabase
        .from('interviews')
        .delete()
        .in('id', testInterviewIds);

      if (interviewsError) {
        console.error('Error deleting interviews:', interviewsError);
      } else if (interviewsCount) {
        deletionResults.interviews = interviewsCount;
        console.log(`Deleted ${interviewsCount} interviews`);
      }
    }

    // Skip deleting candidates by email pattern - only delete what's linked to test organizations

    // 13. Finally, delete test organizations
    const { error: orgsDeleteError, count: orgsCount } = await supabase
      .from('organizations')
      .delete()
      .in('id', testOrgIds);

    if (orgsDeleteError) {
      console.error('Error deleting organizations:', orgsDeleteError);
    } else if (orgsCount) {
      deletionResults.organizations = orgsCount;
      console.log(`Deleted ${orgsCount} organizations`);
    }

    console.log('Test data cleanup completed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully cleaned up test data`,
      deletionResults,
      summary: {
        total_items_deleted: Object.values(deletionResults).reduce((sum, count) => sum + count, 0),
        organizations_cleaned: deletionResults.organizations,
        interviews_removed: deletionResults.interviews,
        attempts_removed: deletionResults.attempts,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in cleanup-test-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorDetails,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
