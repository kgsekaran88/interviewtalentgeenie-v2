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

    const { invitationId } = await req.json();

    if (!invitationId) {
      return new Response(JSON.stringify({ error: 'invitationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Reassigning questions for invitation: ${invitationId}`);

    // Get the invitation
    const { data: invitation, error: invError } = await supabase
      .from('interview_invitations')
      .select('id, interview_id, candidate_email, metadata, status')
      .eq('id', invitationId)
      .single();

    if (invError || !invitation) {
      console.error('Invitation not found:', invError);
      return new Response(JSON.stringify({ error: 'Invitation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invitation.status !== 'pending') {
      return new Response(JSON.stringify({ 
        error: 'Can only reassign questions for pending invitations',
        status: invitation.status 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get interview details
    const { data: interview, error: intError } = await supabase
      .from('interviews')
      .select('id, question_count, question_type_distribution, difficulty_distribution')
      .eq('id', invitation.interview_id)
      .single();

    if (intError || !interview) {
      console.error('Interview not found:', intError);
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get available questions
    const { data: availableQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('id, question_type, difficulty, topic, question_text')
      .eq('interview_id', invitation.interview_id);

    if (questionsError || !availableQuestions || availableQuestions.length === 0) {
      console.error('No questions available:', questionsError);
      return new Response(JSON.stringify({ error: 'No questions available in interview bank' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Select questions with distribution
    const targetCount = interview.question_count || 25;
    const selectedIds = selectQuestionsWithDistribution(
      availableQuestions,
      targetCount,
      interview.question_type_distribution,
      interview.difficulty_distribution
    );

    if (selectedIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Could not select any questions' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update invitation with new question IDs
    const originalQuestionIds = invitation.metadata?.selected_question_ids || [];
    const updatedMetadata = {
      ...invitation.metadata,
      selected_question_ids: selectedIds,
      questions_reassigned: true,
      reassigned_at: new Date().toISOString(),
      previous_question_ids: originalQuestionIds
    };

    const { error: updateError } = await supabase
      .from('interview_invitations')
      .update({ metadata: updatedMetadata })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update invitation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully reassigned ${selectedIds.length} questions for ${invitation.candidate_email}`);

    return new Response(JSON.stringify({
      success: true,
      invitationId,
      candidateEmail: invitation.candidate_email,
      previousCount: originalQuestionIds.length,
      newCount: selectedIds.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reassign questions error:', error);
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

  const typeDist = typeDistribution || { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };
  const typeTargets: Record<string, number> = {};
  const totalTypePercent = Object.values(typeDist).reduce((a, b) => a + b, 0);
  for (const [type, percent] of Object.entries(typeDist)) {
    typeTargets[type] = Math.round((percent / totalTypePercent) * targetCount);
  }

  const byType: Record<string, typeof questions> = {};
  for (const q of questions) {
    const type = q.question_type || 'mcq';
    if (!byType[type]) byType[type] = [];
    byType[type].push(q);
  }

  // First pass: match type distribution
  for (const [type, target] of Object.entries(typeTargets)) {
    const available = (byType[type] || []).filter(q => {
      if (usedIds.has(q.id)) return false;
      const normalizedText = normalizeText(q.question_text || '');
      if (normalizedText && usedTexts.has(normalizedText)) return false;
      return true;
    });
    const shuffled = available.sort(() => Math.random() - 0.5);
    const toSelect = Math.min(target, shuffled.length);
    
    for (let i = 0; i < toSelect && selected.length < targetCount; i++) {
      selected.push(shuffled[i].id);
      usedIds.add(shuffled[i].id);
      const normalizedText = normalizeText(shuffled[i].question_text || '');
      if (normalizedText) usedTexts.add(normalizedText);
    }
  }

  // Fill remaining
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
