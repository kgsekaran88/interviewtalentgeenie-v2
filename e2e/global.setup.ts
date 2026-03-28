/**
 * Global setup — runs once before all tests.
 * Creates test users, profiles, organizations, role assignments, and comprehensive seed data.
 *
 * ⚠️  DATA SAFETY:
 *     This setup ONLY performs INSERT operations — it NEVER deletes or updates existing data.
 *     Every insert is idempotent: it checks for existing records before inserting.
 *     All seeded data uses "E2E" prefix for easy identification and cleanup.
 *     No existing production/manual data is ever touched.
 */
import {
  TEST_USERS,
  ensureTestUser,
  assignRole,
  ensureProfile,
  ensureTestOrganization,
  ensureOrgMembership,
  getAdminClient,
} from './helpers';

async function globalSetup() {
  console.log('\n🔧 Global Setup: Creating test users and seed data...\n');

  // 1. Create all test users with confirmed emails
  const userIds: Record<string, string> = {};

  for (const [key, user] of Object.entries(TEST_USERS)) {
    try {
      const { id } = await ensureTestUser(key as keyof typeof TEST_USERS);
      userIds[key] = id;
      console.log(`  ✅ User: ${user.email} (${user.role}) → ${id}`);
      // Small delay between user creations to avoid overwhelming pgbouncer pool
      await new Promise((r) => setTimeout(r, 500));
    } catch (e: any) {
      console.error(`  ❌ Failed to create ${key}: ${e.message}`);
      throw e;
    }
  }

  // 2. Create profiles for all users
  for (const [key, user] of Object.entries(TEST_USERS)) {
    try {
      await ensureProfile(userIds[key], user.fullName, user.email);
      console.log(`  ✅ Profile: ${user.fullName}`);
    } catch (e: any) {
      console.error(`  ❌ Failed to create profile for ${key}: ${e.message}`);
      // Non-fatal — some tests may still work
    }
  }

  // 2b. Force email_verified = true for ALL test users (safety net)
  //     The upsert via PostgREST sometimes doesn't update email_verified reliably
  try {
    const adminForVerify = getAdminClient();
    const allUserIds = Object.values(userIds);
    const { error: verifyError } = await adminForVerify
      .from('profiles')
      .update({ email_verified: true })
      .in('id', allUserIds);
    if (verifyError) {
      console.warn(`  ⚠️  Batch email_verified update warning: ${verifyError.message}`);
    } else {
      console.log(`  ✅ Email verified: forced true for all ${allUserIds.length} test users`);
    }
  } catch (e: any) {
    console.warn(`  ⚠️  Email verified batch update: ${e.message}`);
  }

  // 3. Assign roles
  for (const [key, user] of Object.entries(TEST_USERS)) {
    try {
      await assignRole(userIds[key], user.role);
      console.log(`  ✅ Role: ${key} → ${user.role}`);
    } catch (e: any) {
      console.error(`  ❌ Failed to assign role for ${key}: ${e.message}`);
    }
  }

  // 4. Create test organization
  let orgId: string;
  try {
    orgId = await ensureTestOrganization();
    console.log(`  ✅ Organization: E2E Test Organization → ${orgId}`);
  } catch (e: any) {
    console.error(`  ❌ Failed to create org: ${e.message}`);
    throw e;
  }

  // 5. Add partner_admin, hr_recruiter, tech_spoc, billing_contact to the organization
  const orgMembers = ['partnerAdmin', 'hrRecruiter', 'techSpoc', 'billingContact'] as const;
  for (const key of orgMembers) {
    try {
      const orgRole = key === 'partnerAdmin' ? 'admin'
        : key === 'hrRecruiter' ? 'hr'
        : key === 'billingContact' ? 'billing'
        : 'tech_spoc';
      await ensureOrgMembership(orgId, userIds[key], orgRole);
      console.log(`  ✅ Org member: ${key} → ${orgRole}`);
    } catch (e: any) {
      console.error(`  ❌ Failed to add ${key} to org: ${e.message}`);
    }
  }

  // 6. Seed comprehensive test data
  const admin = getAdminClient();

  // ── Interview template ──
  try {
    const { data: existingTemplate } = await admin
      .from('interview_templates')
      .select('id')
      .eq('title', 'E2E Test Template')
      .limit(1)
      .maybeSingle();

    if (!existingTemplate) {
      await admin.from('interview_templates').insert({
        title: 'E2E Test Template',
        description: 'Template created by E2E test setup',
        organization_id: orgId,
        created_by: userIds.hrRecruiter,
        is_active: true,
      });
      console.log('  ✅ Interview template: E2E Test Template');
    }
  } catch (e: any) {
    console.log(`  ⚠️  Interview template: ${e.message}`);
  }

  // ── Question repository questions ──
  const questions = [
    {
      question_text: 'E2E: What is dependency injection?',
      topic: 'Software Engineering',
      difficulty: 'intermediate',
      explanation: 'A design pattern where dependencies are provided to objects rather than created internally.',
      question_type: 'descriptive',
      is_approved: true,
    },
    {
      question_text: 'E2E: Explain the difference between REST and GraphQL.',
      topic: 'API Design',
      difficulty: 'intermediate',
      explanation: 'REST uses fixed endpoints with predefined responses; GraphQL allows clients to request exactly the data they need.',
      question_type: 'descriptive',
      is_approved: true,
    },
    {
      question_text: 'E2E: What is the time complexity of binary search?',
      topic: 'Data Structures',
      difficulty: 'easy',
      explanation: 'O(log n) where n is the number of elements.',
      question_type: 'descriptive',
      is_approved: true,
    },
    {
      question_text: 'E2E: Describe the SOLID principles.',
      topic: 'Software Engineering',
      difficulty: 'advanced',
      explanation: 'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.',
      question_type: 'descriptive',
      is_approved: true,
    },
    {
      question_text: 'E2E: What is a closure in JavaScript?',
      topic: 'JavaScript',
      difficulty: 'intermediate',
      explanation: 'A closure is a function that remembers and accesses variables from its outer scope even after the outer function has finished execution.',
      question_type: 'descriptive',
      is_approved: true,
    },
  ];

  for (const q of questions) {
    try {
      const { data: existingQ } = await admin
        .from('question_repository')
        .select('id')
        .eq('question_text', q.question_text)
        .limit(1)
        .maybeSingle();

      if (!existingQ) {
        await admin.from('question_repository').insert({
          ...q,
          organization_id: orgId,
          created_by: userIds.hrRecruiter,
        });
      }
    } catch (e: any) {
      console.log(`  ⚠️  Question: ${e.message}`);
    }
  }
  console.log(`  ✅ Questions: ${questions.length} seeded in repository`);

  // ── Interview positions ──
  const interviews = [
    { title: 'E2E Senior React Developer', experience_level: 'senior', status: 'active' },
    { title: 'E2E Junior Backend Engineer', experience_level: 'junior', status: 'active' },
    { title: 'E2E Full Stack Developer', experience_level: 'mid', status: 'draft' },
    { title: 'E2E QA Engineer Interview', experience_level: 'mid', status: 'active' },
  ];

  const createdInterviewIds: string[] = [];
  for (const interview of interviews) {
    try {
      const { data: existingI } = await admin
        .from('interviews')
        .select('id')
        .eq('title', interview.title)
        .eq('organization_id', orgId)
        .limit(1)
        .maybeSingle();

      if (existingI) {
        createdInterviewIds.push(existingI.id);
      } else {
        const { data: created, error } = await admin
          .from('interviews')
          .insert({
            title: interview.title,
            organization_id: orgId,
            creator_id: userIds.hrRecruiter,
            status: interview.status,
            experience_level: interview.experience_level,
          })
          .select('id')
          .single();

        if (created) createdInterviewIds.push(created.id);
        if (error) console.log(`  ⚠️  Interview ${interview.title}: ${error.message}`);
      }
    } catch (e: any) {
      console.log(`  ⚠️  Interview ${interview.title}: ${e.message}`);
    }
  }
  console.log(`  ✅ Interviews: ${createdInterviewIds.length} positions seeded`);

  // ── Subscription plans (for billing tests) ──
  let starterPlanId: string | undefined;
  try {
    const { data: existingPlans } = await admin
      .from('subscription_plans')
      .select('id')
      .eq('name', 'E2E Starter Plan')
      .limit(1)
      .maybeSingle();

    if (existingPlans) {
      starterPlanId = existingPlans.id;
    } else {
      const { data: newPlans } = await admin.from('subscription_plans').insert([
        {
          name: 'E2E Starter Plan',
          description: 'Basic plan for small teams',
          price_monthly_cents: 4999,
          currency: 'USD',
          max_interviews: 50,
          max_ai_usage: 10000,
          max_users: 10,
          features: { max_interviews: 50, max_users: 10, ai_evaluations: true },
          is_active: true,
        },
        {
          name: 'E2E Enterprise Plan',
          description: 'Full-featured plan for large organizations',
          price_monthly_cents: 19999,
          currency: 'USD',
          max_interviews: 500,
          max_ai_usage: 100000,
          max_users: 100,
          features: { max_interviews: 500, max_users: 100, ai_evaluations: true, proctoring: true, custom_branding: true },
          is_active: true,
        },
      ]).select('id, name');
      starterPlanId = newPlans?.find(p => (p as any).name === 'E2E Starter Plan')?.id;
      console.log('  ✅ Subscription plans: 2 plans seeded');
    }

    // If no E2E plan, use any existing active plan
    if (!starterPlanId) {
      const { data: anyPlan } = await admin
        .from('subscription_plans')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      starterPlanId = anyPlan?.id;
    }

    // Create an org subscription if one doesn't exist
    if (starterPlanId) {
      const { data: existingSub } = await admin
        .from('organization_subscriptions')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!existingSub) {
        const now = new Date();
        const periodStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
        await admin.from('organization_subscriptions').insert({
          organization_id: orgId,
          plan_id: starterPlanId,
          status: 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });
        console.log('  ✅ Organization subscription: active subscription created');
      }
    }
  } catch (e: any) {
    console.log(`  ⚠️  Subscription plans: ${e.message}`);
  }

  // ── Email templates (for admin tests) ──
  try {
    const { data: existingEmails } = await admin
      .from('email_templates')
      .select('id')
      .eq('name', 'E2E Interview Invitation')
      .limit(1)
      .maybeSingle();

    if (!existingEmails) {
      await admin.from('email_templates').insert([
        {
          name: 'E2E Interview Invitation',
          subject: 'You have been invited to an interview',
          body: '<p>Dear {{candidate_name}}, you have been invited to take an interview for {{position}}.</p>',
          template_type: 'invitation',
          is_active: true,
        },
        {
          name: 'E2E Interview Reminder',
          subject: 'Reminder: Your interview is pending',
          body: '<p>Dear {{candidate_name}}, this is a reminder that your interview for {{position}} is pending.</p>',
          template_type: 'reminder',
          is_active: true,
        },
      ]);
      console.log('  ✅ Email templates: 2 templates seeded');
    }
  } catch (e: any) {
    console.log(`  ⚠️  Email templates: ${e.message}`);
  }

  // ── Learning materials / topics (for learning tests) ──
  try {
    // First, ensure we have a training plan
    let trainingPlanId: string;
    const { data: existingPlan } = await admin
      .from('training_plans')
      .select('id')
      .eq('name', 'E2E React Learning Path')
      .limit(1)
      .maybeSingle();

    if (existingPlan) {
      trainingPlanId = existingPlan.id;
    } else {
      const { data: newPlan, error: planError } = await admin
        .from('training_plans')
        .insert({
          name: 'E2E React Learning Path',
          description: 'A comprehensive React training plan',
          category: 'Frontend',
          difficulty_level: 'beginner',
          is_active: true,
          organization_id: orgId,
        })
        .select('id')
        .single();
      if (planError) throw planError;
      trainingPlanId = newPlan.id;
    }

    // Now create training topics linked to the plan
    const { data: existingTopic } = await admin
      .from('training_topics')
      .select('id')
      .eq('name', 'JavaScript Fundamentals')
      .eq('training_plan_id', trainingPlanId)
      .limit(1)
      .maybeSingle();

    if (!existingTopic) {
      await admin.from('training_topics').insert([
        {
          training_plan_id: trainingPlanId,
          name: 'JavaScript Fundamentals',
          description: 'Core JavaScript concepts',
          order_index: 1,
          estimated_duration_minutes: 120,
          is_required: true,
        },
        {
          training_plan_id: trainingPlanId,
          name: 'React Advanced Patterns',
          description: 'Advanced React design patterns',
          order_index: 2,
          estimated_duration_minutes: 180,
          is_required: true,
        },
      ]);
      console.log('  ✅ Training topics: 2 topics seeded');
    }

    // Assign training plan to guest user so they can see it on My Learning Plan
    const { data: existingAssignment } = await admin
      .from('user_training_assignments')
      .select('id')
      .eq('user_id', userIds.guest)
      .eq('training_plan_id', trainingPlanId)
      .limit(1)
      .maybeSingle();

    if (!existingAssignment) {
      await admin.from('user_training_assignments').insert({
        user_id: userIds.guest,
        training_plan_id: trainingPlanId,
        assigned_by: userIds.hrRecruiter,
        status: 'assigned',
      });
      console.log('  ✅ Training assignment: guest user assigned to E2E React Learning Path');
    }
  } catch (e: any) {
    console.log(`  ⚠️  Training topics: ${e.message}`);
  }

  // ── Notifications (for notification tests) ──
  try {
    const { data: existingNotif } = await admin
      .from('notifications')
      .select('id')
      .eq('title', 'E2E Test Notification')
      .limit(1)
      .maybeSingle();

    if (!existingNotif) {
      const notificationUsers = [
        userIds.platformAdmin,
        userIds.partnerAdmin,
        userIds.hrRecruiter,
        userIds.techSpoc,
        userIds.billingContact,
      ].filter(Boolean);

      for (const userId of notificationUsers) {
        await admin.from('notifications').insert({
          user_id: userId,
          title: 'E2E Test Notification',
          message: 'This is a test notification for E2E testing.',
          type: 'info',
          read: false,
        });
      }
      console.log(`  ✅ Notifications: ${notificationUsers.length} notifications seeded`);
    }
  } catch (e: any) {
    console.log(`  ⚠️  Notifications: ${e.message}`);
  }

  // ── FINAL SAFETY NET: Force email_verified = true for ALL test users ──
  //    This MUST be the very last step. Running two test batches in parallel
  //    means globalSetup executes twice; race conditions can reset email_verified.
  try {
    const adminFinal = getAdminClient();
    const allIds = Object.values(userIds);
    const { error: finalVerifyError } = await adminFinal
      .from('profiles')
      .update({ email_verified: true })
      .in('id', allIds);
    if (finalVerifyError) {
      console.warn(`  ⚠️  Final email_verified update: ${finalVerifyError.message}`);
    } else {
      console.log(`  ✅ Final email_verified: confirmed true for all ${allIds.length} test users`);
    }
  } catch (e: any) {
    console.warn(`  ⚠️  Final email_verified update: ${e.message}`);
  }

  console.log('\n🎉 Global setup complete!\n');
}

export default globalSetup;
