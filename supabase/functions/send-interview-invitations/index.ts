import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";

// Helper to log operations to database
async function logOperation(
  supabase: any,
  operation: string,
  status: 'started' | 'completed' | 'failed',
  params: {
    interviewId?: string;
    invitationId?: string;
    candidateEmail?: string;
    userId?: string;
    metadata?: Record<string, any>;
    errorCode?: string;
    errorMessage?: string;
    logId?: string;
  }
) {
  try {
    if (params.logId && status !== 'started') {
      const completedAt = new Date().toISOString();
      const { data: logData } = await supabase
        .from('interview_operation_logs')
        .select('started_at')
        .eq('id', params.logId)
        .single();
      
      const durationMs = logData?.started_at 
        ? new Date(completedAt).getTime() - new Date(logData.started_at).getTime()
        : null;

      await supabase
        .from('interview_operation_logs')
        .update({
          status,
          completed_at: completedAt,
          duration_ms: durationMs,
          error_code: params.errorCode || null,
          error_message: params.errorMessage || null,
          metadata: params.metadata || undefined,
        })
        .eq('id', params.logId);
    } else {
      const { data } = await supabase
        .from('interview_operation_logs')
        .insert({
          operation,
          status,
          interview_id: params.interviewId || null,
          invitation_id: params.invitationId || null,
          candidate_email: params.candidateEmail || null,
          user_id: params.userId || null,
          metadata: params.metadata || {},
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      return data?.id;
    }
  } catch (err) {
    console.error('[OperationLog] Failed to log:', err);
  }
  return null;
}

serve(async (req) => {
  const logger = createLogger('send-interview-invitations');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let operationLogId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    // Roles: partner_admin and hr_recruiter can send invitations
    // Note: tech_spoc NOT included - they only review questions, not send invitations
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['partner_admin', 'hr_recruiter']
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { interview_id, candidates, send_email = false, cc_emails, send_single_email, invitation_id } = await req.json();
    
    logger.info('Processing invitation request', { interview_id, candidateCount: candidates?.length, send_email, ccCount: cc_emails?.length || 0, send_single_email, invitation_id });

    // Handle resending email for an existing invitation
    if (send_single_email && invitation_id) {
      // Fetch the existing invitation with interview details
      const { data: invitation, error: inviteError } = await supabase
        .from('interview_invitations')
        .select('*, interview:interviews(*, organization:organizations(id, name, slug, contact_email))')
        .eq('id', invitation_id)
        .single();

      if (inviteError || !invitation) {
        return new Response(
          JSON.stringify({ error: 'Invitation not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const interview = invitation.interview;
      if (!interview) {
        return new Response(
          JSON.stringify({ error: 'Interview not found for invitation' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build share link
      const baseUrl = req.headers.get('origin') || 'https://interviewai.talentgeenie.com';
      const orgSlug = interview.organization?.slug || 'interview';
      const interviewSlug = interview.slug || interview.id;
      const shareLink = `${baseUrl}/i/${orgSlug}/${interviewSlug}/${invitation.share_token}`;

      // Get CC emails from invitation metadata
      const invitationCcEmails = (invitation.metadata as any)?.cc_emails || [];

      // Determine if this is a resend (email already sent) -> use reminder template
      const isResend = invitation.email_sent === true;
      const currentReminderCount = invitation.reminder_count || 0;

      try {
        const { sendInterviewInvitationEmail, sendInterviewReminderEmail } = await import('../_shared/email-helper.ts');
        
        let emailResult;
        
        if (isResend) {
          // This is a manual resend after first email - send as reminder
          const newReminderCount = currentReminderCount + 1;
          emailResult = await sendInterviewReminderEmail({
            candidateEmail: invitation.candidate_email,
            candidateName: invitation.candidate_name,
            interviewTitle: interview.title,
            organizationName: interview.organization?.name,
            questionCount: interview.question_count || 10,
            timeLimit: interview.time_limit,
            shareLink: shareLink,
            ccEmails: invitationCcEmails,
            reminderNumber: newReminderCount
          });
          
          if (emailResult.sent) {
            // Update reminder count
            await supabase
              .from('interview_invitations')
              .update({ 
                reminder_count: newReminderCount,
                last_reminder_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', invitation_id);
            
            logger.info('Reminder email sent successfully', { 
              invitationId: invitation_id, 
              email: invitation.candidate_email,
              reminderNumber: newReminderCount 
            });
          }
        } else {
          // First-time send - use invitation template
          emailResult = await sendInterviewInvitationEmail({
            candidateEmail: invitation.candidate_email,
            candidateName: invitation.candidate_name,
            interviewTitle: interview.title,
            organizationName: interview.organization?.name,
            questionCount: interview.question_count || 10,
            timeLimit: interview.time_limit,
            shareLink: shareLink,
            ccEmails: invitationCcEmails
          });

          if (emailResult.sent) {
            await supabase
              .from('interview_invitations')
              .update({ 
                email_sent: true,
                email_sent_at: new Date().toISOString()
              })
              .eq('id', invitation_id);

            logger.info('Invitation email sent successfully', { invitationId: invitation_id, email: invitation.candidate_email });
          }
        }

        if (emailResult.sent) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: isResend ? 'Reminder sent successfully' : 'Invitation sent successfully',
              type: isResend ? 'reminder' : 'invitation'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          logger.error('Failed to send email', { error: emailResult.error, isResend });
          return new Response(
            JSON.stringify({ error: emailResult.error || 'Failed to send email' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (emailError) {
        logger.error('Email send error:', emailError);
        return new Response(
          JSON.stringify({ error: emailError instanceof Error ? emailError.message : 'Email send failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!interview_id || !candidates || !Array.isArray(candidates)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: interview_id and candidates array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Start operation logging
    operationLogId = await logOperation(serviceSupabase, 'invitation_sent', 'started', {
      interviewId: interview_id,
      userId: user.id,
      metadata: { candidateCount: candidates.length, sendEmail: send_email }
    });

    // Fetch interview details with slugs
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*, organization:organizations(id, name, slug, contact_email)')
      .eq('id', interview_id)
      .single();

    if (interviewError || !interview) {
      return new Response(
        JSON.stringify({ error: 'Interview not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if questions are approved
    if (interview.questions_status !== 'approved') {
      return new Response(
        JSON.stringify({ 
          error: 'Questions not approved',
          message: 'Interview questions must be approved before sending invitations. Please approve the questions first.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = interview.organization_id;

    // Check organization's subscription plan limit
    const { data: subscription } = await supabase
      .from('organization_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .maybeSingle();

    if (subscription?.plan?.max_interviews) {
      // Count current attempts for this organization
      const { count: currentAttemptCount } = await supabase
        .from('interview_attempts')
        .select('*, interviews!inner(organization_id)', { count: 'exact', head: true })
        .eq('interviews.organization_id', organizationId)
        .in('status', ['submitted', 'evaluated', 'completed']);

      const usedAttempts = currentAttemptCount || 0;
      const maxAttempts = subscription.plan.max_interviews;
      const remainingAttempts = maxAttempts - usedAttempts;

      // Check if adding new candidates would exceed the limit
      if (candidates.length > remainingAttempts) {
        return new Response(
          JSON.stringify({ 
            error: 'Plan limit exceeded',
            message: `Your organization has used ${usedAttempts} of ${maxAttempts} candidate attempts this period. You can only send ${remainingAttempts} more invitation(s). Please upgrade your plan or wait for the next billing period.`,
            used: usedAttempts,
            limit: maxAttempts,
            remaining: remainingAttempts,
            requested: candidates.length
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Organization ${organizationId}: ${usedAttempts}/${maxAttempts} attempts used, sending ${candidates.length} invitations`);
    }

    // Fetch all questions for this interview with usage tracking
    const { data: allQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('interview_id', interview_id)
      .order('selection_count', { ascending: true, nullsFirst: true }); // Prefer least-used questions

    if (questionsError || !allQuestions || allQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions found for this interview' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get per-category difficulty distribution from interview config
    const categoryDifficultyDistribution = interview.category_difficulty_distribution;
    const questionTypeDistribution = interview.question_type_distribution || { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };
    const codingTopicDistribution = interview.coding_topic_distribution;
    // Get required question rules from interview config
    const requiredQuestionRules = interview.required_question_rules as Array<{
      type: 'mcq' | 'descriptive' | 'scenario' | 'coding';
      difficulty: 'easy' | 'medium' | 'hard';
      min: number;
      topic?: string;
    }> | null;

    /**
     * Calculate smart coding question distribution based on question count
     * Rules:
     * - For 10 questions: 1 medium + 1 hard coding (2 total)
     * - Scale proportionally based on question count
     * - Easy coding questions only when questions > 20
     */
    function getSmartCodingDifficulty(questionCount: number): { easy: number; medium: number; hard: number } {
      // Base: 2 coding questions for 10 total questions (20%)
      // For every 10 questions, add 2 more coding questions
      
      if (questionCount <= 20) {
        // No easy questions for <= 20 questions
        return { easy: 0, medium: 50, hard: 50 };
      } else {
        // Allow easy questions for > 20 questions
        // Distribution: 20% easy, 40% medium, 40% hard
        return { easy: 20, medium: 40, hard: 40 };
      }
    }

    // Helper function to select questions respecting required rules, per-category difficulty and topic distribution
    // IMPORTANT: Required rules are a SUBSET of type distribution, not in addition
    // E.g., if type distribution = {coding: 2} and rules = {1 Java coding, 1 Spring Boot coding},
    // the 2 coding questions from rules FULFILL the coding: 2 quota
    function selectQuestionsWithDistribution(
      questions: any[],
      count: number,
      typeDistribution: { mcq: number; scenario: number; coding: number; descriptive: number },
      categoryDifficulty?: {
        mcq: { easy: number; medium: number; hard: number };
        scenario: { easy: number; medium: number; hard: number };
        coding: { easy: number; medium: number; hard: number };
        descriptive: { easy: number; medium: number; hard: number };
      },
      codingTopicDist?: Record<string, { easy?: number; medium?: number; hard?: number }> | null,
      rules?: Array<{ type: string; difficulty: string; min: number; topic?: string }> | null
    ): any[] {
      const selected: any[] = [];
      const selectedIds = new Set<string>();
      const selectedTexts = new Set<string>(); // Track question text to avoid duplicates with same content

      // Helper to normalize question text for deduplication (lowercase, trim, remove extra whitespace)
      const normalizeText = (text: string): string => 
        (text || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200);

      // typeDistribution contains COUNTS (e.g., {mcq: 11, coding: 2}), not percentages
      // Calculate target counts per type directly
      const typeTotal = (typeDistribution.mcq || 0) + 
                        (typeDistribution.scenario || 0) + 
                        (typeDistribution.coding || 0) + 
                        (typeDistribution.descriptive || 0);
      
      // If typeTotal doesn't match count, scale proportionally
      const scaleFactor = typeTotal > 0 ? count / typeTotal : 1;
      const targetByType = {
        mcq: Math.round((typeDistribution.mcq || 0) * scaleFactor),
        scenario: Math.round((typeDistribution.scenario || 0) * scaleFactor),
        coding: Math.round((typeDistribution.coding || 0) * scaleFactor),
        descriptive: Math.round((typeDistribution.descriptive || 0) * scaleFactor)
      };
      
      // Adjust for rounding to ensure total equals count
      const targetTotal = targetByType.mcq + targetByType.scenario + targetByType.coding + targetByType.descriptive;
      if (targetTotal !== count) {
        targetByType.mcq += (count - targetTotal);
      }
      
      console.log(`[selectQuestionsWithDistribution] Target by type: MCQ=${targetByType.mcq}, Scenario=${targetByType.scenario}, Coding=${targetByType.coding}, Descriptive=${targetByType.descriptive}`);

      // Track how many of each type have been selected
      const selectedByType: Record<string, number> = { mcq: 0, scenario: 0, coding: 0, descriptive: 0 };

      // PHASE 1: First, satisfy required question rules (best-effort)
      // These count TOWARDS the type quota, not in addition
      // CRITICAL: Even if a rule can't be satisfied, the quota slot is still "consumed"
      // to prevent over-selection in PHASE 2
      if (rules && rules.length > 0) {
        console.log(`[selectQuestionsWithDistribution] Enforcing ${rules.length} required rules (counting towards type quotas)`);
        
        for (const rule of rules) {
          const typeTarget = targetByType[rule.type as keyof typeof targetByType] || 0;
          const alreadySelected = selectedByType[rule.type] || 0;
          const remainingForType = typeTarget - alreadySelected;
          
          // Only select up to what's remaining for this type
          const maxToSelect = Math.min(rule.min, remainingForType);
          
          if (maxToSelect <= 0) {
            console.log(`[selectQuestionsWithDistribution] Skipping rule (type quota filled): ${rule.min} ${rule.difficulty} ${rule.type}`);
            continue;
          }
          
          // Find matching questions for this rule
          const matchingQuestions = questions.filter(q => {
            if (selectedIds.has(q.id)) return false;
            if (selectedTexts.has(normalizeText(q.question_text))) return false;
            if (q.question_type !== rule.type) return false;
            if (q.difficulty !== rule.difficulty) return false;
            
            // If topic is specified, check if question matches
            if (rule.topic) {
              const qTopic = (q.topic || '').toLowerCase();
              const ruleTopic = rule.topic.toLowerCase();
              if (!qTopic.includes(ruleTopic) && !ruleTopic.includes(qTopic)) {
                return false;
              }
            }
            return true;
          });
          
          // Shuffle and select
          const shuffled = [...matchingQuestions].sort(() => Math.random() - 0.5);
          const toSelect = Math.min(maxToSelect, shuffled.length);
          
          for (let i = 0; i < toSelect; i++) {
            selected.push(shuffled[i]);
            selectedIds.add(shuffled[i].id);
            selectedTexts.add(normalizeText(shuffled[i].question_text));
          }
          
          // CRITICAL FIX: Always count the rule's requested slots against quota,
          // even if we couldn't find enough matching questions.
          // This prevents "quota leakage" where unfulfilled rules cause PHASE 2
          // to over-select questions of that type.
          const slotsConsumed = maxToSelect; // Reserve full quota for this rule
          selectedByType[rule.type] = (selectedByType[rule.type] || 0) + slotsConsumed;
          
          if (toSelect < rule.min) {
            console.warn(`[selectQuestionsWithDistribution] Rule "${rule.min} ${rule.difficulty} ${rule.type}${rule.topic ? ' in ' + rule.topic : ''}" partially satisfied: ${toSelect}/${rule.min} (${slotsConsumed} slots reserved)`);
          } else {
            console.log(`[selectQuestionsWithDistribution] Rule satisfied: ${toSelect} ${rule.difficulty} ${rule.type}${rule.topic ? ' in ' + rule.topic : ''}`);
          }
        }
      }

      // PHASE 2: Fill remaining slots for each type
      // Calculate remaining needed per type (quota - already selected from rules)
      const typeCounts = {
        mcq: Math.max(0, targetByType.mcq - selectedByType.mcq),
        scenario: Math.max(0, targetByType.scenario - selectedByType.scenario),
        coding: Math.max(0, targetByType.coding - selectedByType.coding),
        descriptive: Math.max(0, targetByType.descriptive - selectedByType.descriptive)
      };
      
      console.log(`[selectQuestionsWithDistribution] After rules - remaining to fill: MCQ=${typeCounts.mcq}, Scenario=${typeCounts.scenario}, Coding=${typeCounts.coding}, Descriptive=${typeCounts.descriptive}`);

      // Group questions by type, difficulty, and topic (excluding already selected)
      const questionsByTypeAndDifficulty: Record<string, Record<string, any[]>> = {
        mcq: { easy: [], medium: [], hard: [] },
        scenario: { easy: [], medium: [], hard: [] },
        coding: { easy: [], medium: [], hard: [] },
        descriptive: { easy: [], medium: [], hard: [] }
      };

      // Also group coding questions by topic for topic-based selection
      const codingByTopicAndDifficulty: Record<string, Record<string, any[]>> = {};

      for (const q of questions) {
        if (selectedIds.has(q.id)) continue; // Skip already selected by ID
        if (selectedTexts.has(normalizeText(q.question_text))) continue; // Skip duplicate content
        
        const type = q.question_type || 'mcq';
        const difficulty = q.difficulty || 'medium';
        if (questionsByTypeAndDifficulty[type]?.[difficulty]) {
          questionsByTypeAndDifficulty[type][difficulty].push(q);
        }
        
        // Also index coding questions by topic
        if (type === 'coding' && q.topic) {
          // Normalize topic name (e.g., "Programming Languages (Python)" -> "Python")
          const normalizedTopic = q.topic.toLowerCase();
          if (!codingByTopicAndDifficulty[normalizedTopic]) {
            codingByTopicAndDifficulty[normalizedTopic] = { easy: [], medium: [], hard: [] };
          }
          codingByTopicAndDifficulty[normalizedTopic][difficulty].push(q);
        }
      }

      // Select non-coding questions first (MCQ, scenario, descriptive)
      for (const [type, targetCount] of Object.entries(typeCounts)) {
        if (targetCount <= 0 || type === 'coding') continue;

        const difficultyDist = categoryDifficulty?.[type as keyof typeof categoryDifficulty] || { easy: 30, medium: 50, hard: 20 };
        
        const easyTarget = Math.round(targetCount * difficultyDist.easy / 100);
        const mediumTarget = Math.round(targetCount * difficultyDist.medium / 100);
        const hardTarget = targetCount - easyTarget - mediumTarget;

        const difficulties = [
          { level: 'easy', target: easyTarget },
          { level: 'medium', target: mediumTarget },
          { level: 'hard', target: hardTarget }
        ];

        for (const { level, target } of difficulties) {
          const pool = questionsByTypeAndDifficulty[type][level];
          const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
          
          let selectedForDifficulty = 0;
          for (const q of shuffledPool) {
            if (selectedForDifficulty >= target) break;
            if (!selectedIds.has(q.id) && !selectedTexts.has(normalizeText(q.question_text))) {
              selected.push(q);
              selectedIds.add(q.id);
              selectedTexts.add(normalizeText(q.question_text));
              selectedForDifficulty++;
            }
          }
        }
      }

      // Select coding questions with topic-aware distribution
      const codingCount = typeCounts.coding;
      if (codingCount > 0) {
        // Use smart coding difficulty based on question count
        const smartCodingDifficulty = getSmartCodingDifficulty(count);
        const codingDifficultyDist = categoryDifficulty?.coding || smartCodingDifficulty;
        
        // Override with smart defaults if easy = 0 isn't set and count <= 20
        if (count <= 20 && codingDifficultyDist.easy > 0) {
          codingDifficultyDist.easy = 0;
          codingDifficultyDist.medium = 50;
          codingDifficultyDist.hard = 50;
        }

        // If topic distribution is specified, use it
        if (codingTopicDist && Object.keys(codingTopicDist).length > 0) {
          // Topic-based selection: iterate through each topic and select specified questions
          for (const [topic, diffCounts] of Object.entries(codingTopicDist)) {
            const topicLower = topic.toLowerCase();
            
            // Find matching topic pool
            const matchingTopicKey = Object.keys(codingByTopicAndDifficulty).find(k => 
              k.includes(topicLower) || topicLower.includes(k)
            );
            
            if (!matchingTopicKey) {
              console.warn(`[send-interview-invitations] No questions found for coding topic: ${topic}`);
              continue;
            }
            
            const topicPool = codingByTopicAndDifficulty[matchingTopicKey];
            
            for (const [difficulty, targetCount] of Object.entries(diffCounts)) {
              if (!targetCount || targetCount <= 0) continue;
              
              const pool = topicPool[difficulty] || [];
              const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
              
              let selectedForTopic = 0;
              for (const q of shuffledPool) {
                if (selectedForTopic >= targetCount) break;
                if (!selectedIds.has(q.id) && !selectedTexts.has(normalizeText(q.question_text))) {
                  selected.push(q);
                  selectedIds.add(q.id);
                  selectedTexts.add(normalizeText(q.question_text));
                  selectedForTopic++;
                }
              }
            }
          }
        } else {
          // Fall back to difficulty-based selection without topic preference
          const easyTarget = Math.round(codingCount * codingDifficultyDist.easy / 100);
          const mediumTarget = Math.round(codingCount * codingDifficultyDist.medium / 100);
          const hardTarget = codingCount - easyTarget - mediumTarget;

          const difficulties = [
            { level: 'easy', target: easyTarget },
            { level: 'medium', target: mediumTarget },
            { level: 'hard', target: hardTarget }
          ];

          for (const { level, target } of difficulties) {
            const pool = questionsByTypeAndDifficulty['coding'][level];
            const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
            
            let selectedForDifficulty = 0;
            for (const q of shuffledPool) {
              if (selectedForDifficulty >= target) break;
              if (!selectedIds.has(q.id) && !selectedTexts.has(normalizeText(q.question_text))) {
                selected.push(q);
                selectedIds.add(q.id);
                selectedTexts.add(normalizeText(q.question_text));
                selectedForDifficulty++;
              }
            }
          }
        }
      }

      // If we haven't reached the target count, fill with remaining questions
      if (selected.length < count) {
        const remaining = questions.filter(q => 
          !selectedIds.has(q.id) && !selectedTexts.has(normalizeText(q.question_text))
        );
        const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5);
        for (const q of shuffledRemaining) {
          if (selected.length >= count) break;
          selected.push(q);
          selectedIds.add(q.id);
          selectedTexts.add(normalizeText(q.question_text));
        }
      }

      // Sort by question type order: MCQ → Descriptive → Scenario → Coding
      const typeOrder: Record<string, number> = { mcq: 0, descriptive: 1, scenario: 2, coding: 3 };
      return selected.sort((a, b) => (typeOrder[a.question_type] ?? 4) - (typeOrder[b.question_type] ?? 4));
    }

    const invitations = [];
    const emailsSent = [];
    const emailsFailed = [];

    // Generate invitations for each candidate
    for (const candidate of candidates) {
      const { email, name } = candidate;

      // Generate unique share token
      const { data: tokenData } = await supabase.rpc('generate_share_token');
      const shareToken = tokenData || Math.random().toString(36).substring(2, 14);

      // Select questions using smart distribution with required rules enforcement
      const questionCount = interview.question_count || 10;
      const selectedQuestions = selectQuestionsWithDistribution(
        allQuestions,
        questionCount,
        questionTypeDistribution,
        categoryDifficultyDistribution,
        codingTopicDistribution,
        requiredQuestionRules
      );

      // Create invitation with sender tracking
      // Support new fields: first_name, last_name, phone, resume_url
      const candidateData: Record<string, any> = {
        interview_id,
        candidate_email: email,
        candidate_name: name,
        share_token: shareToken,
        email_sent: false,
        status: 'pending',
        sent_by: user.id
      };

      // Add optional new fields if provided
      if (candidate.first_name) candidateData.first_name = candidate.first_name;
      if (candidate.last_name) candidateData.last_name = candidate.last_name;
      if (candidate.phone) candidateData.candidate_phone = candidate.phone;
      if (candidate.resume_url) candidateData.resume_url = candidate.resume_url;

      const { data: invitation, error: inviteError } = await supabase
        .from('interview_invitations')
        .insert(candidateData)
        .select()
        .single();

      if (inviteError) {
        console.error('Error creating invitation:', inviteError);
        emailsFailed.push({ email, error: inviteError.message });
        continue;
      }

      // Create attempt_questions mapping for this candidate's selected questions
      const attemptQuestions = selectedQuestions.map((q, index) => ({
        invitation_id: invitation.id,
        question_id: q.id,
        display_order: index
      }));

      // Store the question mapping and CC emails in metadata
      await supabase
        .from('interview_invitations')
        .update({ 
          metadata: { 
            selected_question_ids: selectedQuestions.map(q => q.id),
            cc_emails: cc_emails && cc_emails.length > 0 ? cc_emails : undefined
          }
        } as any)
        .eq('id', invitation.id);

      // Increment selection_count for selected questions to track usage
      const selectedIds = selectedQuestions.map(q => q.id);
      try {
        await serviceSupabase.rpc('increment_question_selection_counts', { question_ids: selectedIds });
        console.log(`Incremented selection counts for ${selectedIds.length} questions`);
      } catch (selErr) {
        console.warn('Failed to increment selection counts:', selErr);
      }

      // Generate readable URL using org and interview slugs
      const baseUrl = req.headers.get('origin') || 'https://yourapp.com';
      const orgSlug = interview.organization?.slug || 'interview';
      const interviewSlug = interview.slug || interview_id;
      
      // New readable URL format: /i/{org-slug}/{interview-slug}/{token}
      const shareLink = `${baseUrl}/i/${orgSlug}/${interviewSlug}/${shareToken}`;
      // Keep legacy URL for backward compatibility
      const legacyLink = `${baseUrl}/take-interview/${shareToken}`;

      invitations.push({
        ...invitation,
        share_link: shareLink,
        legacy_link: legacyLink
      });

      // Try to send email if requested using unified email service
      if (send_email) {
        try {
          const { sendInterviewInvitationEmail } = await import('../_shared/email-helper.ts');
          
          const emailResult = await sendInterviewInvitationEmail({
            candidateEmail: email,
            candidateName: name,
            interviewTitle: interview.title,
            organizationName: interview.organization?.name,
            questionCount: questionCount,
            timeLimit: interview.time_limit,
            shareLink: shareLink,
            ccEmails: cc_emails // Pass CC emails to the email helper
          });

          if (emailResult.sent) {
            await supabase
              .from('interview_invitations')
              .update({ 
                email_sent: true,
                email_sent_at: new Date().toISOString()
              })
              .eq('id', invitation.id);
            
            emailsSent.push(email);
          } else {
            emailsFailed.push({ email, error: emailResult.error || 'Email send failed' });
          }
        } catch (emailError) {
          console.error('Email send error:', emailError);
          emailsFailed.push({ email, error: emailError instanceof Error ? emailError.message : 'Unknown error' });
        }
      }
    }

    // Log successful completion
    await logOperation(serviceSupabase, 'invitation_sent', 'completed', {
      logId: operationLogId || undefined,
      interviewId: interview_id,
      metadata: { 
        invitationCount: invitations.length, 
        emailsSent: emailsSent.length, 
        emailsFailed: emailsFailed.length 
      }
    });
    
    logger.info('Invitations processed successfully', { 
      count: invitations.length, 
      emailsSent: emailsSent.length, 
      emailsFailed: emailsFailed.length 
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        invitations,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        message: send_email 
          ? `Created ${invitations.length} invitations. Sent ${emailsSent.length} emails, ${emailsFailed.length} failed.`
          : `Created ${invitations.length} invitations. Email sending was not requested.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error in send-interview-invitations:', error);
    
    // Log failure
    if (operationLogId) {
      await logOperation(serviceSupabase, 'invitation_sent', 'failed', {
        logId: operationLogId,
        errorCode: 'INVITATION_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});