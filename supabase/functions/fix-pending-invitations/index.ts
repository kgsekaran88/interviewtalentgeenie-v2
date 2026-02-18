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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting fix for pending invitations with missing questions...');

    // Get all pending invitations
    const { data: pendingInvitations, error: fetchError } = await supabase
      .from('interview_invitations')
      .select('id, interview_id, candidate_email, metadata')
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Error fetching invitations:', fetchError);
      throw new Error('Failed to fetch pending invitations');
    }

    console.log(`Found ${pendingInvitations?.length || 0} pending invitations`);

    const results: { 
      invitationId: string; 
      candidateEmail: string; 
      status: string; 
      message: string;
      originalCount: number;
      newCount: number;
    }[] = [];

    for (const invitation of pendingInvitations || []) {
      const selectedQuestionIds = invitation.metadata?.selected_question_ids || [];
      const originalCount = selectedQuestionIds.length;

      if (originalCount === 0) {
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'skipped',
          message: 'No questions were assigned',
          originalCount: 0,
          newCount: 0
        });
        continue;
      }

      // Check how many of the selected questions still exist
      const { data: existingQuestions, error: checkError } = await supabase
        .from('questions')
        .select('id')
        .in('id', selectedQuestionIds);

      if (checkError) {
        console.error(`Error checking questions for ${invitation.candidate_email}:`, checkError);
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'error',
          message: 'Failed to check existing questions',
          originalCount,
          newCount: 0
        });
        continue;
      }

      const existingCount = existingQuestions?.length || 0;
      const missingCount = originalCount - existingCount;

      if (missingCount === 0) {
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'ok',
          message: 'All questions exist',
          originalCount,
          newCount: existingCount
        });
        continue;
      }

      console.log(`Invitation ${invitation.id} (${invitation.candidate_email}): ${missingCount}/${originalCount} questions missing`);

      // Get interview details to understand question requirements
      const { data: interview, error: intError } = await supabase
        .from('interviews')
        .select('id, question_count, question_type_distribution, difficulty_distribution, topic_distribution')
        .eq('id', invitation.interview_id)
        .single();

      if (intError || !interview) {
        console.error(`Error fetching interview for ${invitation.candidate_email}:`, intError);
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'error',
          message: 'Interview not found',
          originalCount,
          newCount: 0
        });
        continue;
      }

      // Get available questions from the interview's question bank
      const { data: availableQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, question_type, difficulty, topic, question_text')
        .eq('interview_id', invitation.interview_id);

      if (questionsError || !availableQuestions || availableQuestions.length === 0) {
        console.error(`No questions available for interview ${invitation.interview_id}`);
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'error',
          message: 'No questions available in interview bank',
          originalCount,
          newCount: 0
        });
        continue;
      }

      // Select questions trying to match distribution
      const targetCount = interview.question_count || originalCount;
      const selectedIds = selectQuestionsWithDistribution(
        availableQuestions,
        targetCount,
        interview.question_type_distribution,
        interview.difficulty_distribution
      );

      if (selectedIds.length === 0) {
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'error',
          message: 'Could not select any questions',
          originalCount,
          newCount: 0
        });
        continue;
      }

      // Update the invitation with new question IDs
      const updatedMetadata = {
        ...invitation.metadata,
        selected_question_ids: selectedIds,
        questions_reassigned: true,
        reassigned_at: new Date().toISOString(),
        original_question_count: originalCount,
        original_missing_count: missingCount
      };

      const { error: updateError } = await supabase
        .from('interview_invitations')
        .update({ metadata: updatedMetadata })
        .eq('id', invitation.id);

      if (updateError) {
        console.error(`Error updating invitation ${invitation.id}:`, updateError);
        results.push({
          invitationId: invitation.id,
          candidateEmail: invitation.candidate_email,
          status: 'error',
          message: 'Failed to update invitation',
          originalCount,
          newCount: 0
        });
        continue;
      }

      console.log(`Fixed invitation ${invitation.id}: assigned ${selectedIds.length} questions`);
      results.push({
        invitationId: invitation.id,
        candidateEmail: invitation.candidate_email,
        status: 'fixed',
        message: `Reassigned ${selectedIds.length} questions (was missing ${missingCount})`,
        originalCount,
        newCount: selectedIds.length
      });
    }

    const fixed = results.filter(r => r.status === 'fixed').length;
    const ok = results.filter(r => r.status === 'ok').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`Complete: ${fixed} fixed, ${ok} already ok, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: results.length,
        fixed,
        alreadyOk: ok,
        errors,
        skipped: results.filter(r => r.status === 'skipped').length
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fix pending invitations error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function selectQuestionsWithDistribution(
  questions: { id: string; question_type: string; difficulty: string; topic: string; question_text?: string }[],
  targetCount: number,
  typeDistribution: Record<string, number> | null,
  difficultyDistribution: Record<string, number> | null
): string[] {
  const selected: string[] = [];
  const usedIds = new Set<string>();
  const usedTexts = new Set<string>(); // Track question text to avoid duplicates

  // Helper to normalize question text for deduplication
  const normalizeText = (text: string): string => 
    (text || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200);

  // Default distributions if not provided
  const typeDist = typeDistribution || { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };
  const diffDist = difficultyDistribution || { easy: 30, medium: 50, hard: 20 };

  // Calculate targets based on distribution
  const typeTargets: Record<string, number> = {};
  const totalTypePercent = Object.values(typeDist).reduce((a, b) => a + b, 0);
  for (const [type, percent] of Object.entries(typeDist)) {
    typeTargets[type] = Math.round((percent / totalTypePercent) * targetCount);
  }

  const diffTargets: Record<string, number> = {};
  const totalDiffPercent = Object.values(diffDist).reduce((a, b) => a + b, 0);
  for (const [diff, percent] of Object.entries(diffDist)) {
    diffTargets[diff] = Math.round((percent / totalDiffPercent) * targetCount);
  }

  // Group questions by type and difficulty
  const byType: Record<string, typeof questions> = {};
  const byDiff: Record<string, typeof questions> = {};

  for (const q of questions) {
    const type = q.question_type || 'mcq';
    const diff = q.difficulty || 'medium';
    
    if (!byType[type]) byType[type] = [];
    byType[type].push(q);
    
    if (!byDiff[diff]) byDiff[diff] = [];
    byDiff[diff].push(q);
  }

  // First pass: try to match type distribution with text deduplication
  for (const [type, target] of Object.entries(typeTargets)) {
    const available = (byType[type] || []).filter(q => {
      if (usedIds.has(q.id)) return false;
      const normalizedText = normalizeText(q.question_text || '');
      if (normalizedText && usedTexts.has(normalizedText)) return false;
      return true;
    });
    const toSelect = Math.min(target, available.length);
    
    // Shuffle for randomness
    const shuffled = available.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < toSelect && selected.length < targetCount; i++) {
      selected.push(shuffled[i].id);
      usedIds.add(shuffled[i].id);
      const normalizedText = normalizeText(shuffled[i].question_text || '');
      if (normalizedText) usedTexts.add(normalizedText);
    }
  }

  // Second pass: fill remaining with any available questions (with text deduplication)
  if (selected.length < targetCount) {
    const remaining = questions.filter(q => {
      if (usedIds.has(q.id)) return false;
      const normalizedText = normalizeText(q.question_text || '');
      if (normalizedText && usedTexts.has(normalizedText)) return false;
      return true;
    });
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    
    for (const q of shuffled) {
      if (selected.length >= targetCount) break;
      selected.push(q.id);
      usedIds.add(q.id);
      const normalizedText = normalizeText(q.question_text || '');
      if (normalizedText) usedTexts.add(normalizedText);
    }
  }

  return selected;
}
