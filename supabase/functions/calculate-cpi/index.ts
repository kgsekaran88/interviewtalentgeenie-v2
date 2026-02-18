import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { getProctoringConfig, calculateIntegrityScore, ProctoringConfig } from "../_shared/proctoring-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Logger {
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  error: (msg: string, error?: any, data?: any) => void;
}

interface CPICalculationResult {
  success: boolean;
  error?: string;
  cpi?: any;
}

/**
 * Calculate integrity score from ALL violations in the JSON array
 * Uses the proctoring-config scoring system for accurate, configurable penalties
 * Respects both the "ignored" flag in violations AND the ignored_violations column
 */
async function calculateIntegrityFromAllViolations(
  supabase: any,
  proctoringSession: any,
  organizationId: string | null,
  includeIgnoredViolations: boolean = false
): Promise<{ score: number; totalViolations: number }> {
  if (!proctoringSession) {
    return { score: 100, totalViolations: 0 };
  }
  
  // Get the proctoring config for this organization
  const config = await getProctoringConfig(supabase, organizationId);
  
  // Parse violations from the JSON array
  let violations: Array<{ type: string; ignored?: boolean; [key: string]: unknown }> = [];
  
  if (proctoringSession.violations) {
    if (typeof proctoringSession.violations === 'string') {
      try {
        violations = JSON.parse(proctoringSession.violations);
      } catch {
        violations = [];
      }
    } else if (Array.isArray(proctoringSession.violations)) {
      violations = proctoringSession.violations;
    }
  }
  
  // Get the ignored_violations column (array of violation type strings)
  let ignoredViolationTypes: string[] = [];
  if (proctoringSession.ignored_violations) {
    if (typeof proctoringSession.ignored_violations === 'string') {
      try {
        ignoredViolationTypes = JSON.parse(proctoringSession.ignored_violations);
      } catch {
        ignoredViolationTypes = [];
      }
    } else if (Array.isArray(proctoringSession.ignored_violations)) {
      ignoredViolationTypes = proctoringSession.ignored_violations;
    }
  }
  
  // Filter out ignored violations unless includeIgnoredViolations is true
  const activeViolations = includeIgnoredViolations 
    ? violations 
    : violations.filter(v => {
        // Skip if violation has ignored flag
        if (v.ignored === true) return false;
        // Skip if violation type is in the ignored_violations column
        if (ignoredViolationTypes.includes(v.type)) return false;
        return true;
      });
  
  // Calculate integrity score using the shared function from proctoring-config
  const integrityScore = calculateIntegrityScore(config, activeViolations);
  
  return { 
    score: integrityScore, 
    totalViolations: activeViolations.length 
  };
}

/**
 * Determine hiring recommendation based on Technical CPI and Integrity Score
 * CPI now focuses purely on technical competency (60% technical + 40% problem solving)
 * Integrity is evaluated separately as a trust metric
 */
function determineHiringRecommendation(technicalCpi: number, integrityScore: number): string {
  // Both conditions must be met for each tier
  if (technicalCpi >= 85 && integrityScore >= 90) {
    return "strongly_recommend";
  } else if (technicalCpi >= 70 && integrityScore >= 80) {
    return "recommend";
  } else if (technicalCpi >= 50 && integrityScore >= 70) {
    return "consider";
  }
  return "not_recommended";
}

/**
 * Core CPI calculation logic for a single attempt
 */
async function calculateCPIForAttempt(
  supabase: any,
  attemptId: string,
  logger: Logger,
  includeIgnoredViolations: boolean = false
): Promise<CPICalculationResult> {
  try {
    // Get the attempt with interview details
    const { data: attempt, error: attemptError } = await supabase
      .from("interview_attempts")
      .select(`
        *,
        interview:interviews(
          id,
          title,
          creator_id,
          organization_id
        )
      `)
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return { success: false, error: "Attempt not found" };
    }

    // Get the questions for this attempt
    const { data: attemptQuestions, error: questionsError } = await supabase
      .from("attempt_questions")
      .select(`
        question_id,
        display_order,
        questions(
          id,
          question_text,
          topic,
          difficulty,
          question_type,
          correct_answer
        )
      `)
      .eq("attempt_id", attemptId)
      .order("display_order");

    if (questionsError || !attemptQuestions) {
      return { success: false, error: "Questions not found" };
    }

    // Get proctoring session if exists (include ignored_violations column)
    const { data: proctoringSession } = await supabase
      .from("proctoring_sessions")
      .select("id, integrity_score, violations, ignored_violations, multiple_person_detections, multiple_voice_detections, tab_switch_count, look_away_count, copy_attempt_count")
      .eq("interview_attempt_id", attemptId)
      .maybeSingle();

    // Get the AI assessment score for this attempt
    const { data: assessment } = await supabase
      .from("assessments")
      .select("overall_score")
      .eq("attempt_id", attemptId)
      .maybeSingle();
    
    // Use AI's overall_score as the CPI (fallback to 0 if no assessment exists)
    const aiOverallScore = assessment?.overall_score ?? 0;
    logger.info('Using AI assessment score for CPI', { attemptId, aiOverallScore });
    
    // Get organization ID for config lookup
    const organizationId = attempt.interview?.organization_id || null;
    
    // Calculate integrity score from ALL violations using proctoring config
    const { score: calculatedIntegrityScore, totalViolations } = await calculateIntegrityFromAllViolations(
      supabase,
      proctoringSession,
      organizationId,
      includeIgnoredViolations
    );
    
    // Update the proctoring session with recalculated integrity score
    if (proctoringSession) {
      await supabase
        .from("proctoring_sessions")
        .update({ integrity_score: calculatedIntegrityScore })
        .eq("interview_attempt_id", attemptId);
    }

    // Calculate scores from answers
    const answers = attempt.answers || {};
    const topicScores: { [key: string]: { correct: number; total: number } } = {};
    let easyCorrect = 0, easyTotal = 0;
    let mediumCorrect = 0, mediumTotal = 0;
    let hardCorrect = 0, hardTotal = 0;
    let technicalCorrect = 0, technicalTotal = 0;
    let problemSolvingCorrect = 0, problemSolvingTotal = 0;

    attemptQuestions.forEach((aq: any) => {
      const question = aq.questions;
      if (!question) return;

      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;

      // Topic scores
      if (!topicScores[question.topic]) {
        topicScores[question.topic] = { correct: 0, total: 0 };
      }
      topicScores[question.topic].total++;
      if (isCorrect) topicScores[question.topic].correct++;

      // Difficulty scores
      if (question.difficulty === "easy") {
        easyTotal++;
        if (isCorrect) easyCorrect++;
      } else if (question.difficulty === "medium") {
        mediumTotal++;
        if (isCorrect) mediumCorrect++;
      } else if (question.difficulty === "hard") {
        hardTotal++;
        if (isCorrect) hardCorrect++;
      }

      // Technical vs Problem Solving (coding/descriptive = problem solving, mcq = technical)
      if (question.question_type === "mcq") {
        technicalTotal++;
        if (isCorrect) technicalCorrect++;
      } else {
        problemSolvingTotal++;
        if (isCorrect) problemSolvingCorrect++;
      }
    });

    // Calculate percentages (kept for detailed breakdown)
    const technicalScore = technicalTotal > 0 ? (technicalCorrect / technicalTotal) * 100 : 0;
    const problemSolvingScore = problemSolvingTotal > 0 ? (problemSolvingCorrect / problemSolvingTotal) * 100 : 0;
    
    // Use recalculated integrity score (NOT the stored one which may be wrong)
    // If no proctoring session, default to 100 (no violations recorded)
    const integrityScore = proctoringSession ? calculatedIntegrityScore : 100;

    // Use AI's overall_score directly as the CPI
    // No additional calculation - trust the AI evaluator's score
    const overallCpi = Math.round(aiOverallScore * 100) / 100;

    // Determine top and weak skills
    const topicScoresArray = Object.entries(topicScores).map(([topic, scores]) => ({
      topic,
      percentage: (scores.correct / scores.total) * 100,
    }));
    topicScoresArray.sort((a, b) => b.percentage - a.percentage);

    const topSkills = topicScoresArray.slice(0, 3).map((t) => t.topic);
    const weakSkills = topicScoresArray
      .filter((t) => t.percentage < 50)
      .slice(0, 3)
      .map((t) => t.topic);

    // Determine hiring recommendation using SEPARATE logic for CPI and Integrity
    const hiringRecommendation = determineHiringRecommendation(overallCpi, integrityScore);

    // totalViolations already calculated from calculateIntegrityFromAllViolations

    // Upsert CPI record - specify onConflict to handle existing records
    const { data: cpiRecord, error: cpiError } = await supabase
      .from("candidate_performance_index")
      .upsert({
        attempt_id: attemptId,
        candidate_email: attempt.candidate_email,
        candidate_name: attempt.candidate_name,
        interview_id: attempt.interview_id,
        technical_score: Math.round(technicalScore * 100) / 100,
        problem_solving_score: Math.round(problemSolvingScore * 100) / 100,
        topic_scores: topicScores,
        easy_correct: easyCorrect,
        easy_total: easyTotal,
        medium_correct: mediumCorrect,
        medium_total: mediumTotal,
        hard_correct: hardCorrect,
        hard_total: hardTotal,
        integrity_score: Math.round(integrityScore * 100) / 100,
        violations_detected: totalViolations,
        overall_cpi: overallCpi,
        top_skills: topSkills,
        weak_skills: weakSkills,
        hiring_recommendation: hiringRecommendation,
      }, { onConflict: 'attempt_id' })
      .select()
      .single();

    if (cpiError) {
      logger.error('Failed to save CPI', cpiError, { attemptId });
      return { success: false, error: "Failed to save CPI" };
    }

    logger.info('CPI calculated successfully', { 
      attemptId, 
      overallCpi, 
      integrityScore, 
      hiringRecommendation 
    });

    return { success: true, cpi: cpiRecord };
  } catch (error) {
    logger.error('Error calculating CPI for attempt', error, { attemptId });
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  const logger = createLogger('calculate-cpi');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('CPI calculation request started');
    
    const authHeader = req.headers.get("authorization");
    // Roles: partner_admin, hr_recruiter, tech_spoc, platform_admin can calculate CPI
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter', 'tech_spoc', 'platform_admin']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('User authenticated for CPI calculation', { userId: user.id });

    const { attemptId, recalculateAll, includeIgnoredViolations } = await req.json();
    
    // Handle bulk recalculation mode
    if (recalculateAll === true) {
      logger.info('Bulk recalculation mode triggered', { includeIgnoredViolations });
      
      // Fetch all attempts that are completed or evaluated
      const { data: allAttempts, error: fetchError } = await supabase
        .from("interview_attempts")
        .select("id")
        .in("status", ["completed", "evaluated"]);
      
      if (fetchError) {
        logger.error('Failed to fetch attempts for recalculation', fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch attempts" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const results = { success: 0, failed: 0, total: allAttempts?.length || 0, errors: [] as string[] };
      
      for (const attempt of allAttempts || []) {
        const result = await calculateCPIForAttempt(supabase, attempt.id, logger, includeIgnoredViolations === true);
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${attempt.id}: ${result.error}`);
        }
      }
      
      logger.info('Bulk recalculation completed', results);
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single attempt calculation
    if (!attemptId) {
      logger.warn('Attempt ID not provided');
      return new Response(
        JSON.stringify({ error: "attemptId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info('Calculating CPI for single attempt', { attemptId, userId: user.id });

    // Get the attempt to verify authorization
    const { data: attempt, error: attemptError } = await supabase
      .from("interview_attempts")
      .select(`
        *,
        interview:interviews(
          id,
          title,
          creator_id,
          organization_id
        )
      `)
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      logger.error('Attempt not found', attemptError, { attemptId });
      return new Response(
        JSON.stringify({ error: "Attempt not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check authorization
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      logger.error('Error fetching user roles', rolesError, { userId: user.id });
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const isCreator = attempt.interview.creator_id === user.id;
    const hasRole = userRoles?.some((r: any) => ['platform_admin', 'hr_recruiter', 'partner_admin', 'tech_spoc'].includes(r.role));
    
    // Verify organization membership if not admin
    let isOrgMember = false;
    if (attempt.interview.organization_id && !hasRole) {
      const { data: orgMember } = await supabase.rpc("user_is_org_member", {
        _user_id: user.id,
        _org_id: attempt.interview.organization_id
      });
      isOrgMember = orgMember === true;
    }

    if (!isCreator && !hasRole && !isOrgMember) {
      logger.warn('Unauthorized CPI calculation attempt', { userId: user.id, attemptId });
      return new Response(
        JSON.stringify({ error: "Forbidden - You don't have permission to calculate CPI for this attempt" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate CPI for the single attempt
    const result = await calculateCPIForAttempt(supabase, attemptId, logger, includeIgnoredViolations === true);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, cpi: result.cpi }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error('Fatal error in calculate-cpi', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
