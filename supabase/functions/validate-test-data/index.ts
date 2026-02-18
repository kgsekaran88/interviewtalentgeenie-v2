import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const validationResults = {
      valid_test_data: [] as any[],
      invalid_test_data: [] as any[],
      user_data_misclassified: [] as any[],
      summary: {
        total_test_orgs: 0,
        properly_tagged: 0,
        missing_tags: 0,
        user_data_at_risk: 0,
      }
    };

    console.log('Starting test data validation...');

    // 1. Validate organizations marked as test data
    const { data: testOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, contact_email, created_at, description')
      .ilike('name', 'Test Organization%');

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    validationResults.summary.total_test_orgs = testOrgs?.length || 0;

    for (const org of testOrgs || []) {
      const isValid = (
        org.name.includes('Test Organization') &&
        (!org.contact_email || org.contact_email.includes('@test.com')) &&
        org.description?.includes('test organization created for testing purposes')
      );

      if (isValid) {
        validationResults.valid_test_data.push({
          type: 'organization',
          id: org.id,
          name: org.name,
          email: org.contact_email,
          tags: ['test_data', 'seed_generated'],
          validation: 'PASSED'
        });
        validationResults.summary.properly_tagged++;
      } else {
        validationResults.invalid_test_data.push({
          type: 'organization',
          id: org.id,
          name: org.name,
          email: org.contact_email,
          issues: [
            !org.contact_email || !org.contact_email.includes('@test.com') ? 'Missing or invalid test email' : null,
            !org.description?.includes('test organization') ? 'Missing test data description' : null
          ].filter(Boolean),
          validation: 'FAILED'
        });
        validationResults.summary.missing_tags++;
      }
    }

    // 2. Check for user data that might be mistakenly marked as test data
    const { data: userOrgs, error: userOrgsError } = await supabase
      .from('organizations')
      .select('id, name, contact_email, description')
      .not('name', 'ilike', 'Test Organization%')
      .not('contact_email', 'is', null);

    if (!userOrgsError && userOrgs) {
      for (const org of userOrgs) {
        // Check if contact email uses test.com domain (suspicious)
        if (org.contact_email && org.contact_email.includes('@test.com')) {
          validationResults.user_data_misclassified.push({
            type: 'organization',
            id: org.id,
            name: org.name,
            email: org.contact_email,
            warning: 'User organization with test email domain - may be incorrectly flagged',
            recommendation: 'Verify this is actual test data or update email domain'
          });
          validationResults.summary.user_data_at_risk++;
        }
      }
    }

    // 3. Validate interview attempts with test data
    if (testOrgs && testOrgs.length > 0) {
      const testOrgIds = testOrgs.map(o => o.id);
      
      const { data: testInterviews } = await supabase
        .from('interviews')
        .select('id')
        .in('organization_id', testOrgIds);

      if (testInterviews && testInterviews.length > 0) {
        const testInterviewIds = testInterviews.map(i => i.id);
        
        const { data: testAttempts } = await supabase
          .from('interview_attempts')
          .select('id, candidate_email, candidate_name')
          .in('interview_id', testInterviewIds);

        for (const attempt of testAttempts || []) {
          const isValid = attempt.candidate_email?.includes('@test.com');
          
          if (isValid) {
            validationResults.valid_test_data.push({
              type: 'interview_attempt',
              id: attempt.id,
              candidate: attempt.candidate_name,
              email: attempt.candidate_email,
              tags: ['test_data', 'seed_generated'],
              validation: 'PASSED'
            });
          } else {
            validationResults.invalid_test_data.push({
              type: 'interview_attempt',
              id: attempt.id,
              candidate: attempt.candidate_name,
              email: attempt.candidate_email,
              issues: ['Candidate email does not use @test.com domain'],
              validation: 'FAILED'
            });
          }
        }
      }
    }

    // 4. Generate recommendations
    const recommendations = [];

    if (validationResults.summary.missing_tags > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: `${validationResults.summary.missing_tags} test data items missing proper tags/identifiers`,
        action: 'Update seed-test-data function to ensure all test data uses @test.com emails and proper descriptions',
        impact: 'Risk of accidentally deleting user data during cleanup'
      });
    }

    if (validationResults.summary.user_data_at_risk > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: `${validationResults.summary.user_data_at_risk} user organizations have test-like email domains`,
        action: 'Manual review required - these may be real users or test data that needs proper identification',
        impact: 'User data could be deleted during test data cleanup'
      });
    }

    if (validationResults.summary.properly_tagged === validationResults.summary.total_test_orgs) {
      recommendations.push({
        priority: 'INFO',
        issue: 'All test data properly tagged',
        action: 'No action needed - validation passed',
        impact: 'Safe to run cleanup operations'
      });
    }

    console.log('Test data validation completed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: 'Test data validation completed',
      validationResults,
      recommendations,
      summary: {
        total_items_checked: validationResults.valid_test_data.length + validationResults.invalid_test_data.length,
        passed: validationResults.valid_test_data.length,
        failed: validationResults.invalid_test_data.length,
        warnings: validationResults.user_data_misclassified.length,
        status: validationResults.summary.user_data_at_risk > 0 ? 'WARNING' : 
                validationResults.summary.missing_tags > 0 ? 'NEEDS_ATTENTION' : 'PASSED'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-test-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.toString() : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
