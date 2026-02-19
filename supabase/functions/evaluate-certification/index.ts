import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { sendCertificateIssuedEmail } from "../_shared/email-helper.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  const logger = createLogger('evaluate-certification');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Certification evaluation request started');
    
    // SECURITY: Only platform admins can evaluate certifications (they issue certificates)
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ['platform_admin']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('Admin authenticated for certification evaluation', { userId: user.id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const { attemptId } = await req.json();

    // Fetch attempt with assessment details
    const { data: attempt, error: attemptError } = await supabase
      .from('certification_attempts')
      .select(`
        *,
        certification_assessments (
          passing_score,
          min_integrity_score,
          retake_cooldown_days,
          certification_topic_id,
          certification_topics (
            display_name,
            provider
          )
        )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      throw new Error('Certification attempt not found');
    }

    // Fetch all questions with answers
    const { data: attemptQuestions } = await supabase
      .from('certification_attempt_questions')
      .select(`
        question_id,
        certification_questions (
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          correct_answer,
          explanation,
          points
        )
      `)
      .eq('attempt_id', attemptId);

    if (!attemptQuestions || attemptQuestions.length === 0) {
      throw new Error('No questions found for attempt');
    }

    const answers = attempt.answers as Record<string, string>;
    let totalScore = 0;
    let totalPoints = 0;
    const topicScores: Record<string, { correct: number; total: number }> = {};
    const questionFeedback: any[] = [];

    // Fetch proctoring violations
    const { data: proctoringSession } = await supabase
      .from('proctoring_sessions')
      .select('*')
      .eq('id', attempt.proctoring_session_id)
      .single();

    const violations = {
      tab_switches: proctoringSession?.tab_switches || 0,
      look_aways: proctoringSession?.look_away_warnings || 0,
      multiple_persons: proctoringSession?.multiple_persons_detected || 0,
      copy_attempts: proctoringSession?.copy_attempts || 0,
      multiple_voices: proctoringSession?.multiple_voices_detected || 0,
      audio_anomalies: proctoringSession?.audio_anomalies || 0,
    };

    // Calculate integrity score: 100 - violations
    const integrityScore = Math.max(0, 100 
      - (violations.tab_switches * 30)
      - (violations.look_aways * 2)
      - (violations.multiple_persons * 30)
      - (violations.copy_attempts * 5)
      - (violations.multiple_voices * 10)
      - (violations.audio_anomalies * 1)
    );

    // Evaluate each question
    for (const aq of attemptQuestions) {
      const question = aq.certification_questions;
      if (!question) continue;

      const userAnswer = answers[question.id];
      const isCorrect = userAnswer?.trim().toLowerCase() === 
                       question.correct_answer.trim().toLowerCase();

      totalPoints += question.points;
      if (isCorrect) {
        totalScore += question.points;
      }

      // Track topic scores
      if (!topicScores[question.topic]) {
        topicScores[question.topic] = { correct: 0, total: 0 };
      }
      topicScores[question.topic].total += question.points;
      if (isCorrect) {
        topicScores[question.topic].correct += question.points;
      }

      questionFeedback.push({
        question_id: question.id,
        question_text: question.question_text,
        user_answer: userAnswer || 'No answer',
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        points_earned: isCorrect ? question.points : 0,
        max_points: question.points,
        explanation: question.explanation,
        topic: question.topic,
        difficulty: question.difficulty,
      });
    }

    const percentageScore = Math.round((totalScore / totalPoints) * 100);
    const assessment = attempt.certification_assessments;
    const passed = percentageScore >= assessment.passing_score && 
                  integrityScore >= assessment.min_integrity_score;

    // Calculate time taken
    const timeTaken = attempt.created_at 
      ? Math.floor((new Date().getTime() - new Date(attempt.created_at).getTime()) / 1000)
      : 0;

    // Use transactional database function for atomic evaluation + certificate creation
    const { data: txResult, error: txError } = await supabase.rpc('save_certification_evaluation_tx', {
      p_attempt_id: attemptId,
      p_score: percentageScore,
      p_integrity_score: integrityScore,
      p_passed: passed,
      p_time_taken: timeTaken,
      p_violation_summary: violations
    });

    if (txError) {
      console.error('Transaction error:', txError);
      throw new Error(txError.message || 'Failed to save certification evaluation');
    }

    console.log('Certification evaluation transaction result:', txResult);

    // Fetch certificate if created
    let certificate = null;
    if (txResult.passed && txResult.certificate_id) {
      const { data: cert } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', txResult.certificate_id)
        .single();
      
      certificate = cert;

      // Send certificate issued email (external call after DB commit)
      if (certificate) {
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', attempt.user_id)
            .single();

          if (userProfile?.email) {
            const expiresAt = new Date(certificate.expires_at);
            const emailResult = await sendCertificateIssuedEmail({
              candidateEmail: userProfile.email,
              candidateName: userProfile.full_name || 'Candidate',
              certificationName: assessment.certification_topics.display_name,
              certificateNumber: certificate.certificate_number,
              score: percentageScore,
              issuedDate: new Date().toLocaleDateString(),
              expiryDate: expiresAt.toLocaleDateString(),
              verificationCode: certificate.verification_code
            });
            console.log('Certificate issued email sent:', emailResult.sent);
          }
        } catch (emailError) {
          console.error('Failed to send certificate email:', emailError);
        }
      }
    }

    const result = {
      success: true,
      attemptId,
      score: percentageScore,
      integrityScore,
      passed: txResult.passed,
      violations,
      topicScores,
      questionFeedback,
      certificate,
      canRetakeAfter: !passed ? new Date(Date.now() + (assessment.retake_cooldown_days || 7) * 24 * 60 * 60 * 1000).toISOString() : null,
    };

    console.log('Certification evaluation complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evaluate-certification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});