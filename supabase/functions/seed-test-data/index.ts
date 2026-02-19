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

    const { count = 5 } = await req.json();
    const results = {
      organizations: [] as any[],
      users: [] as any[],
      interviews: [] as any[],
      candidates: [] as any[],
      attempts: [] as any[],
    };

    console.log(`Starting test data seeding with ${count} records per entity...`);

    // Check user permissions first
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError) {
      console.error('Error checking user roles:', roleError);
    }

    console.log('User roles:', userRoles);
    console.log('User ID:', user.id);

    // 1. Create test organizations
    for (let i = 1; i <= count; i++) {
      console.log(`\n=== Creating organization ${i}/${count} ===`);
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: `Test Organization ${i}`,
          slug: `test-org-${i}-${Date.now()}`,
          website: `https://testorg${i}.com`,
          industry: ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing'][i % 5],
          size: ['1-10', '11-50', '51-200', '201-500', '500+'][i % 5],
          country: 'United States',
          description: `This is a test organization created for testing purposes. Organization ${i}. [TEST_DATA_SEED]`,
          status: 'active',
          verification_status: 'verified',
          contact_email: `test-org-${i}@test.com`, // Test data identifier
        })
        .select()
        .single();

      if (orgError) {
        console.error('❌ Error creating organization:', orgError.message, orgError.details);
        continue;
      }

      console.log(`✅ Created organization: ${org.name} (ID: ${org.id})`);
      results.organizations.push(org);

      // Create organization member (assign current user as admin)
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'admin',
          status: 'active',
        });

      if (memberError) {
        console.error('⚠️  Error creating organization member:', memberError.message);
      } else {
        console.log(`✅ Added user as organization admin`);
      }

      // Create subscription for organization
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (planError) {
        console.error('⚠️  Error fetching plans:', planError.message);
      } else if (plans && plans.length > 0) {
        const { error: subError } = await supabase
          .from('organization_subscriptions')
          .insert({
            organization_id: org.id,
            plan_id: plans[0].id,
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (subError) {
          console.error('⚠️  Error creating subscription:', subError.message);
        } else {
          console.log(`✅ Created subscription for organization`);
        }
      } else {
        console.log('⚠️  No active subscription plans found - skipping subscription creation');
      }

      // 2. Create test interviews for this organization
      for (let j = 1; j <= 2; j++) {
        console.log(`  Creating interview ${j}/2 for org ${i}...`);
        
        const { data: interview, error: interviewError } = await supabase
          .from('interviews')
          .insert({
            creator_id: user.id,
            organization_id: org.id,
            title: `${['Frontend Developer', 'Backend Engineer', 'Full Stack Developer', 'DevOps Engineer', 'Data Scientist'][j % 5]} Interview - Org ${i}`,
            job_description: `We are looking for a talented professional to join our team. This is a test interview created for testing purposes.\n\nResponsibilities:\n- Write clean code\n- Collaborate with team\n- Deliver quality work\n\nRequirements:\n- 3+ years experience\n- Strong problem-solving skills\n- Team player`,
            status: 'active',
            question_count: 10,
            time_limit: 60,
            difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
            proctoring_enabled: j % 2 === 0,
            share_link: `test-interview-${org.id}-${j}`,
            generation_status: 'completed',
          })
          .select()
          .single();

        if (interviewError) {
          console.error('  ❌ Error creating interview:', interviewError.message, interviewError.details);
          continue;
        }

        console.log(`  ✅ Created interview: ${interview.title} (ID: ${interview.id})`);
        results.interviews.push(interview);

        // Create sample questions for interview
        const questionTypes = ['multiple_choice', 'coding', 'descriptive'];
        const difficulties = ['easy', 'medium', 'hard'];
        const topics = ['JavaScript', 'React', 'Node.js', 'Databases', 'Algorithms'];

        console.log(`  Creating 10 questions for interview...`);
        for (let q = 0; q < 10; q++) {
          const { error: qError } = await supabase
            .from('questions')
            .insert({
              interview_id: interview.id,
              question_text: `Test Question ${q + 1}: Explain the concept of ${topics[q % 5]} in modern web development.`,
              question_type: questionTypes[q % 3],
              topic: topics[q % 5],
              difficulty: difficulties[q % 3],
              options: questionTypes[q % 3] === 'multiple_choice' ? {
                A: 'Option A',
                B: 'Option B',
                C: 'Option C',
                D: 'Option D',
              } : null,
              correct_answer: questionTypes[q % 3] === 'multiple_choice' ? 'A' : null,
              order_index: q,
            });

          if (qError) {
            console.error(`  ⚠️  Error creating question ${q + 1}:`, qError.message);
          }
        }
        console.log(`  ✅ Created 10 questions`);

        // 3. Create test candidates and attempts
        for (let c = 1; c <= 3; c++) {
          console.log(`    Creating candidate ${c}/3 for interview...`);
          
          const candidateEmail = `candidate${c}_org${i}_int${j}@test.com`;
          const candidateName = `Test Candidate ${c} - Interview ${j}`;

          results.candidates.push({ email: candidateEmail, name: candidateName });

          // Create interview attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('interview_attempts')
            .insert({
              interview_id: interview.id,
              candidate_name: candidateName,
              candidate_email: candidateEmail,
              status: ['in_progress', 'submitted', 'evaluated'][c % 3],
              answers: c % 3 === 0 ? {} : {
                q1: 'Sample answer 1',
                q2: 'Sample answer 2',
                q3: 'Sample answer 3',
              },
              time_taken: c % 3 === 0 ? null : Math.floor(Math.random() * 3600),
              submitted_at: c % 3 === 0 ? null : new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();

          if (attemptError) {
            console.error('    ❌ Error creating attempt:', attemptError.message);
            continue;
          }

          console.log(`    ✅ Created attempt for ${candidateName}`);
          results.attempts.push(attempt);

          // Create assessment if attempt is evaluated
          if (c % 3 === 2) {
            await supabase
              .from('assessments')
              .insert({
                attempt_id: attempt.id,
                overall_score: 70 + Math.random() * 25,
                hiring_decision: ['strongly_recommend', 'recommend', 'consider', 'not_recommended'][Math.floor(Math.random() * 4)],
                topic_scores: {
                  JavaScript: 75 + Math.random() * 20,
                  React: 70 + Math.random() * 25,
                  'Node.js': 80 + Math.random() * 15,
                },
                strengths: ['Strong problem-solving', 'Good communication', 'Technical knowledge'],
                weaknesses: ['Needs more practice', 'Time management'],
                detailed_analysis: 'This is a test assessment created for testing purposes.',
              });
          }

          // Create proctoring session if proctoring enabled
          if (interview.proctoring_enabled && c % 2 === 0) {
            await supabase
              .from('proctoring_sessions')
              .insert({
                attempt_id: attempt.id,
                violations: {
                  tab_switches: Math.floor(Math.random() * 5),
                  multiple_persons: Math.floor(Math.random() * 2),
                  look_away: Math.floor(Math.random() * 10),
                },
                integrity_score: 80 + Math.random() * 15,
                status: 'completed',
              });
          }

          console.log(`Created attempt for candidate: ${candidateName}`);
        }
      }
    }

    console.log('Test data seeding completed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully seeded test data with ${count} organizations`,
      summary: {
        organizations: results.organizations.length,
        interviews: results.interviews.length,
        candidates: results.candidates.length,
        attempts: results.attempts.length,
      },
      data: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-test-data:', error);
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
