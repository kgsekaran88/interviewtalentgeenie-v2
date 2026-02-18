/**
 * Global setup — runs once before all tests.
 * Creates test users, profiles, organizations, and role assignments.
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

  // 5. Add partner_admin, hr_recruiter, tech_spoc to the organization
  const orgMembers = ['partnerAdmin', 'hrRecruiter', 'techSpoc'] as const;
  for (const key of orgMembers) {
    try {
      const orgRole = key === 'partnerAdmin' ? 'admin' : key === 'hrRecruiter' ? 'hr' : 'tech_spoc';
      await ensureOrgMembership(orgId, userIds[key], orgRole);
      console.log(`  ✅ Org member: ${key} → ${orgRole}`);
    } catch (e: any) {
      console.error(`  ❌ Failed to add ${key} to org: ${e.message}`);
    }
  }

  // 6. Seed additional test data
  const admin = getAdminClient();

  // Create a test assessment template
  try {
    const { data: existingTemplate } = await admin
      .from('interview_templates')
      .select('id')
      .eq('title', 'E2E Test Template')
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

  // Create a test question in the repository
  try {
    const { data: existingQ } = await admin
      .from('question_repository')
      .select('id')
      .eq('question_text', 'E2E: What is dependency injection?')
      .maybeSingle();

    if (!existingQ) {
      await admin.from('question_repository').insert({
        question_text: 'E2E: What is dependency injection?',
        category: 'Software Engineering',
        difficulty_level: 'intermediate',
        expected_answer: 'A design pattern where dependencies are provided to objects rather than created internally.',
        organization_id: orgId,
        created_by: userIds.hrRecruiter,
      });
      console.log('  ✅ Question: E2E test question');
    }
  } catch (e: any) {
    console.log(`  ⚠️  Question repository: ${e.message}`);
  }

  console.log('\n🎉 Global setup complete!\n');
}

export default globalSetup;
