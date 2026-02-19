import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { interviewId } = await req.json();

    if (!interviewId) {
      return new Response(JSON.stringify({ error: 'interviewId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Bulk reassigning questions for interview: ${interviewId}`);

    // Get interview details
    const { data: interview, error: intError } = await supabase
      .from('interviews')
      .select('id, question_count, question_type_distribution, difficulty_distribution')
      .eq('id', interviewId)
      .single();

    if (intError || !interview) {
      console.error('Interview not found:', intError);
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all pending invitations for this interview
    const { data: pendingInvitations, error: invError } = await supabase
      .from('interview_invitations')
      .select('id, candidate_email, metadata')
      .eq('interview_id', interviewId)
      .eq('status', 'pending');

    if (invError) {
      console.error('Error fetching invitations:', invError);
      return new Response(JSON.stringify({ error: 'Failed to fetch invitations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingInvitations || pendingInvitations.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending invitations to update',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get available questions
    const { data: availableQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('id, question_type, difficulty, topic, question_text')
      .eq('interview_id', interviewId);

    if (questionsError || !availableQuestions || availableQuestions.length === 0) {
      console.error('No questions available:', questionsError);
      return new Response(JSON.stringify({ error: 'No questions available in interview bank' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetCount = interview.question_count || 25;
    let successCount = 0;
    let failCount = 0;
    const results: { email: string; success: boolean; questionCount?: number; error?: string }[] = [];

    // Process each pending invitation
    for (const invitation of pendingInvitations) {
      try {
        // Select unique questions for this candidate
        const selectedIds = selectQuestionsWithDistribution(
          availableQuestions,
          targetCount,
          interview.question_type_distribution,
          interview.difficulty_distribution
        );

        if (selectedIds.length === 0) {
          results.push({ email: invitation.candidate_email, success: false, error: 'No questions selected' });
          failCount++;
          continue;
        }

        // Update invitation with new question IDs
        const originalQuestionIds = invitation.metadata?.selected_question_ids || [];
        const updatedMetadata = {
          ...invitation.metadata,
          selected_question_ids: selectedIds,
          questions_reassigned: true,
          reassigned_at: new Date().toISOString(),
          previous_question_ids: originalQuestionIds,
          bulk_reassigned: true
        };

        const { error: updateError } = await supabase
          .from('interview_invitations')
          .update({ metadata: updatedMetadata })
          .eq('id', invitation.id);

        if (updateError) {
          console.error(`Error updating invitation ${invitation.id}:`, updateError);
          results.push({ email: invitation.candidate_email, success: false, error: updateError.message });
          failCount++;
        } else {
          results.push({ email: invitation.candidate_email, success: true, questionCount: selectedIds.length });
          successCount++;
        }
      } catch (err) {
        console.error(`Error processing invitation ${invitation.id}:`, err);
        results.push({ email: invitation.candidate_email, success: false, error: String(err) });
        failCount++;
      }
    }

    console.log(`Bulk reassignment complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      totalPending: pendingInvitations.length,
      updated: successCount,
      failed: failCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Bulk reassign error:', error);
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
