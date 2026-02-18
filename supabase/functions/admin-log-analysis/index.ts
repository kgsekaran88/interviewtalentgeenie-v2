import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/config.ts";

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool definitions for AI to understand what it can do
const tools = [
  {
    type: "function",
    function: {
      name: "query_interview_attempts",
      description: "Search and filter interview attempts. Use this to find candidates, check statuses, or get attempt details.",
      parameters: {
        type: "object",
        properties: {
          candidate_email: { type: "string", description: "Filter by candidate email (partial match)" },
          candidate_name: { type: "string", description: "Filter by candidate name (partial match)" },
          status: { type: "string", enum: ["not_started", "in_progress", "submitted", "evaluated", "pending_upload", "upload_incomplete"], description: "Filter by attempt status" },
          interview_id: { type: "string", description: "Filter by specific interview ID" },
          organization_id: { type: "string", description: "Filter by organization ID" },
          date_from: { type: "string", description: "Filter attempts from this date (ISO format)" },
          date_to: { type: "string", description: "Filter attempts until this date (ISO format)" },
          limit: { type: "number", description: "Max results to return (default 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_proctoring_sessions",
      description: "Search proctoring sessions for integrity scores, violations, and recording status.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "Filter by specific attempt ID" },
          review_status: { type: "string", enum: ["pending", "approved", "rejected", "flagged", "upload_incomplete"], description: "Filter by review status" },
          flagged_for_review: { type: "boolean", description: "Filter flagged sessions" },
          integrity_score_below: { type: "number", description: "Find sessions with integrity score below this value" },
          has_video: { type: "boolean", description: "Filter by whether video recording exists" },
          limit: { type: "number", description: "Max results to return (default 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_assessments",
      description: "Search assessments for scores, hiring decisions, and detailed analysis.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "Filter by specific attempt ID" },
          hiring_decision: { type: "string", enum: ["strongly_recommend", "recommend", "consider", "not_recommended", "strong_hire", "hire", "reject", "no_hire"], description: "Filter by hiring decision (supports both old and new values)" },
          score_above: { type: "number", description: "Find assessments with score above this value" },
          score_below: { type: "number", description: "Find assessments with score below this value" },
          organization_id: { type: "string", description: "Filter by organization ID" },
          limit: { type: "number", description: "Max results to return (default 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_stats",
      description: "Get summary statistics about interview attempts, proctoring sessions, and assessments.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Stats from this date (ISO format)" },
          date_to: { type: "string", description: "Stats until this date (ISO format)" },
          organization_id: { type: "string", description: "Filter stats by organization" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_attempt_status",
      description: "Update the status of an interview attempt. Use for marking as abandoned, reopening, etc.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "The ID of the attempt to update" },
          new_status: { type: "string", enum: ["not_started", "in_progress", "submitted", "evaluated", "pending_upload", "upload_incomplete"], description: "New status to set" },
          reason: { type: "string", description: "Reason for the status change" }
        },
        required: ["attempt_id", "new_status", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_proctoring_review",
      description: "Update proctoring session review status, add notes, or change integrity scores.",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "The proctoring session ID" },
          review_status: { type: "string", enum: ["pending", "approved", "rejected", "flagged", "upload_incomplete"], description: "New review status" },
          reviewer_notes: { type: "string", description: "Notes explaining the review decision" },
          integrity_score: { type: "number", description: "Override integrity score (0-100)" }
        },
        required: ["session_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reset_attempt",
      description: "Reset an interview attempt so the candidate can retake it. This clears answers and resets status.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "The ID of the attempt to reset" },
          reason: { type: "string", description: "Reason for resetting the attempt" }
        },
        required: ["attempt_id", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "regenerate_assessment",
      description: "Trigger re-evaluation of an interview attempt to generate a new assessment.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "The ID of the attempt to re-evaluate" },
          reason: { type: "string", description: "Reason for regenerating assessment" }
        },
        required: ["attempt_id", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_attempt_data",
      description: "Delete an interview attempt and all associated data. This is irreversible.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "The ID of the attempt to delete" },
          confirm: { type: "boolean", description: "Must be true to confirm deletion" }
        },
        required: ["attempt_id", "confirm"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_attempt_details",
      description: "Get comprehensive details about a specific attempt including proctoring and assessment data.",
      parameters: {
        type: "object",
        properties: {
          attempt_id: { type: "string", description: "The attempt ID to look up" }
        },
        required: ["attempt_id"]
      }
    }
  }
];

// Tool execution functions
async function executeQueryInterviewAttempts(supabase: any, params: any) {
  let query = supabase
    .from('interview_attempts')
    .select(`
      id, candidate_name, candidate_email, status, started_at, submitted_at, created_at,
      interview:interviews(id, title, organization_id, organizations(name))
    `)
    .order('created_at', { ascending: false })
    .limit(params.limit || 20);

  if (params.candidate_email) {
    query = query.ilike('candidate_email', `%${params.candidate_email}%`);
  }
  if (params.candidate_name) {
    query = query.ilike('candidate_name', `%${params.candidate_name}%`);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.interview_id) {
    query = query.eq('interview_id', params.interview_id);
  }
  if (params.date_from) {
    query = query.gte('created_at', params.date_from);
  }
  if (params.date_to) {
    query = query.lte('created_at', params.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return { success: true, count: data?.length || 0, data };
}

async function executeQueryProctoringessions(supabase: any, params: any) {
  let query = supabase
    .from('proctoring_sessions')
    .select(`
      id, attempt_id, integrity_score, review_status, flagged_for_review,
      video_url, screen_recording_url, started_at, ended_at, reviewer_notes,
      interview_attempt:interview_attempts(candidate_name, candidate_email, status)
    `)
    .order('created_at', { ascending: false })
    .limit(params.limit || 20);

  if (params.attempt_id) {
    query = query.eq('attempt_id', params.attempt_id);
  }
  if (params.review_status) {
    query = query.eq('review_status', params.review_status);
  }
  if (params.flagged_for_review !== undefined) {
    query = query.eq('flagged_for_review', params.flagged_for_review);
  }
  if (params.integrity_score_below) {
    query = query.lt('integrity_score', params.integrity_score_below);
  }
  if (params.has_video !== undefined) {
    if (params.has_video) {
      query = query.not('video_url', 'is', null);
    } else {
      query = query.is('video_url', null);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return { success: true, count: data?.length || 0, data };
}

async function executeQueryAssessments(supabase: any, params: any) {
  let query = supabase
    .from('assessments')
    .select(`
      id, attempt_id, overall_score, hiring_decision, strengths, weaknesses, created_at,
      interview_attempt:interview_attempts(candidate_name, candidate_email, interview:interviews(title))
    `)
    .order('created_at', { ascending: false })
    .limit(params.limit || 20);

  if (params.attempt_id) {
    query = query.eq('attempt_id', params.attempt_id);
  }
  if (params.hiring_decision) {
    query = query.eq('hiring_decision', params.hiring_decision);
  }
  if (params.score_above) {
    query = query.gt('overall_score', params.score_above);
  }
  if (params.score_below) {
    query = query.lt('overall_score', params.score_below);
  }
  if (params.organization_id) {
    query = query.eq('organization_id', params.organization_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return { success: true, count: data?.length || 0, data };
}

async function executeGetStats(supabase: any, params: any) {
  const dateFilter = params.date_from ? { gte: params.date_from } : {};
  
  const [attempts, proctoring, assessments] = await Promise.all([
    supabase.from('interview_attempts').select('status', { count: 'exact' }),
    supabase.from('proctoring_sessions').select('review_status, flagged_for_review', { count: 'exact' }),
    supabase.from('assessments').select('hiring_decision', { count: 'exact' })
  ]);

  // Count by status
  const statusCounts: Record<string, number> = {};
  attempts.data?.forEach((a: any) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });

  const reviewCounts: Record<string, number> = {};
  let flaggedCount = 0;
  proctoring.data?.forEach((p: any) => {
    reviewCounts[p.review_status || 'pending'] = (reviewCounts[p.review_status || 'pending'] || 0) + 1;
    if (p.flagged_for_review) flaggedCount++;
  });

  const decisionCounts: Record<string, number> = {};
  assessments.data?.forEach((a: any) => {
    decisionCounts[a.hiring_decision] = (decisionCounts[a.hiring_decision] || 0) + 1;
  });

  return {
    success: true,
    stats: {
      total_attempts: attempts.count || 0,
      attempts_by_status: statusCounts,
      total_proctoring_sessions: proctoring.count || 0,
      proctoring_by_review_status: reviewCounts,
      flagged_sessions: flaggedCount,
      total_assessments: assessments.count || 0,
      assessments_by_decision: decisionCounts
    }
  };
}

async function executeUpdateAttemptStatus(supabase: any, params: any, userId: string) {
  const { attempt_id, new_status, reason } = params;
  
  const updateData: any = { status: new_status };
  if (new_status === 'submitted') {
    updateData.submitted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('interview_attempts')
    .update(updateData)
    .eq('id', attempt_id);

  if (error) throw error;

  // Log the action
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'update_attempt_status',
    table_name: 'interview_attempts',
    record_id: attempt_id,
    metadata: { new_status, reason, updated_via: 'log_analysis_ai' }
  });

  return { success: true, message: `Attempt status updated to ${new_status}` };
}

async function executeUpdateProctoringReview(supabase: any, params: any, userId: string) {
  const { session_id, review_status, reviewer_notes, integrity_score } = params;
  
  const updateData: any = {};
  if (review_status) updateData.review_status = review_status;
  if (reviewer_notes) updateData.reviewer_notes = reviewer_notes;
  if (integrity_score !== undefined) updateData.integrity_score = integrity_score;
  updateData.reviewed_at = new Date().toISOString();
  updateData.reviewed_by = userId;

  const { error } = await supabase
    .from('proctoring_sessions')
    .update(updateData)
    .eq('id', session_id);

  if (error) throw error;

  return { success: true, message: 'Proctoring session updated' };
}

async function executeResetAttempt(supabase: any, params: any, userId: string) {
  const { attempt_id, reason } = params;
  
  // Reset the attempt
  const { error: attemptError } = await supabase
    .from('interview_attempts')
    .update({
      status: 'not_started',
      started_at: null,
      submitted_at: null,
      answers: null,
      current_question_index: 0
    })
    .eq('id', attempt_id);

  if (attemptError) throw attemptError;

  // Delete existing assessment if any
  await supabase.from('assessments').delete().eq('attempt_id', attempt_id);

  // Log the action
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'reset_attempt',
    table_name: 'interview_attempts',
    record_id: attempt_id,
    metadata: { reason, reset_via: 'log_analysis_ai' }
  });

  return { success: true, message: 'Attempt has been reset. Candidate can retake the interview.' };
}

async function executeRegenerateAssessment(supabase: any, params: any, userId: string) {
  const { attempt_id, reason } = params;
  
  // Delete existing assessment
  await supabase.from('assessments').delete().eq('attempt_id', attempt_id);

  // Add to evaluation queue
  const { error } = await supabase.from('evaluation_queue').insert({
    attempt_id,
    status: 'pending',
    priority: 1,
    metadata: { regenerated_reason: reason, regenerated_by: userId }
  });

  if (error) throw error;

  // Log the action
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'regenerate_assessment',
    table_name: 'assessments',
    record_id: attempt_id,
    metadata: { reason, regenerated_via: 'log_analysis_ai' }
  });

  return { success: true, message: 'Assessment regeneration queued. It will be processed shortly.' };
}

async function executeDeleteAttemptData(supabase: any, params: any, userId: string) {
  const { attempt_id, confirm } = params;
  
  if (!confirm) {
    return { success: false, message: 'Deletion not confirmed. Set confirm: true to proceed.' };
  }

  // Delete in order (foreign key constraints)
  await supabase.from('assessments').delete().eq('attempt_id', attempt_id);
  await supabase.from('proctoring_sessions').delete().eq('attempt_id', attempt_id);
  await supabase.from('attempt_questions').delete().eq('attempt_id', attempt_id);
  
  const { error } = await supabase.from('interview_attempts').delete().eq('id', attempt_id);
  if (error) throw error;

  // Log the action
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'delete_attempt',
    table_name: 'interview_attempts',
    record_id: attempt_id,
    metadata: { deleted_via: 'log_analysis_ai' }
  });

  return { success: true, message: 'Attempt and all associated data have been deleted.' };
}

async function executeGetAttemptDetails(supabase: any, params: any) {
  const { attempt_id } = params;
  
  const [attemptRes, proctoringRes, assessmentRes] = await Promise.all([
    supabase
      .from('interview_attempts')
      .select(`
        *,
        interview:interviews(id, title, organization_id, organizations(name))
      `)
      .eq('id', attempt_id)
      .single(),
    supabase
      .from('proctoring_sessions')
      .select('*')
      .eq('attempt_id', attempt_id)
      .maybeSingle(),
    supabase
      .from('assessments')
      .select('*')
      .eq('attempt_id', attempt_id)
      .maybeSingle()
  ]);

  return {
    success: true,
    attempt: attemptRes.data,
    proctoring: proctoringRes.data,
    assessment: assessmentRes.data
  };
}

// Execute a tool call
async function executeTool(supabase: any, toolName: string, params: any, userId: string) {
  switch (toolName) {
    case 'query_interview_attempts':
      return executeQueryInterviewAttempts(supabase, params);
    case 'query_proctoring_sessions':
      return executeQueryProctoringessions(supabase, params);
    case 'query_assessments':
      return executeQueryAssessments(supabase, params);
    case 'get_stats':
      return executeGetStats(supabase, params);
    case 'update_attempt_status':
      return executeUpdateAttemptStatus(supabase, params, userId);
    case 'update_proctoring_review':
      return executeUpdateProctoringReview(supabase, params, userId);
    case 'reset_attempt':
      return executeResetAttempt(supabase, params, userId);
    case 'regenerate_assessment':
      return executeRegenerateAssessment(supabase, params, userId);
    case 'delete_attempt_data':
      return executeDeleteAttemptData(supabase, params, userId);
    case 'get_attempt_details':
      return executeGetAttemptDetails(supabase, params);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const systemPrompt = `You are a powerful Platform Admin Log Analysis assistant for TalentGeenie. You have full access to interview attempts, proctoring sessions, and assessments data.

Your capabilities:
1. QUERY DATA: Search interview attempts by candidate email/name, status, date range. Search proctoring sessions by review status, integrity scores. Search assessments by hiring decision and scores.
2. GET STATS: Provide summary statistics about the platform's interview data.
3. MODIFY DATA: Update attempt status (mark as abandoned, submitted, etc.), update proctoring review status, add reviewer notes.
4. RESET ATTEMPTS: Allow candidates to retake interviews by resetting their attempts.
5. REGENERATE ASSESSMENTS: Queue attempts for re-evaluation.
6. DELETE DATA: Permanently delete attempt data when confirmed.
7. GET DETAILS: Fetch comprehensive details about any specific attempt.

IMPORTANT GUIDELINES:
- Always confirm destructive actions (delete, reset) before executing
- Provide clear, tabular summaries of query results
- When showing data, include key identifiers (IDs, emails) so actions can be taken
- For status updates, always log the reason
- Be proactive in suggesting relevant actions based on the data shown

Example queries you can handle:
- "Show me all failed interviews from last week"
- "Find candidates with upload issues"
- "Mark Arpit Kumar's attempt as abandoned"
- "Show integrity scores below 50"
- "Regenerate assessment for email@example.com"
- "Give me today's stats"
- "Find all pending reviews"`;

    // Estimate request tokens for logging
    const allMessages = [{ role: "system", content: systemPrompt }, ...messages];
    const requestTokens = allMessages.reduce((sum: number, m: any) => sum + estimateTokens(m.content || ''), 0);
    const startTime = Date.now();

    const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();

    // Initial AI call with tools
    const initialResponse = await fetch(AI_GATEWAY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        tool_choice: "auto",
      }),
    });

    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      console.error("AI gateway error:", initialResponse.status, errorText);
      
      const latencyMs = Date.now() - startTime;
      await logAIUsage({
        featureName: 'admin_log_analysis',
        success: false,
        modelUsed: 'gemini-2.5-flash',
        requestTokens,
        latencyMs,
        errorMessage: `${initialResponse.status}: ${errorText}`,
        userId,
      });
      
      if (initialResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (initialResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${initialResponse.status}`);
    }

    const initialResult = await initialResponse.json();
    const assistantMessage = initialResult.choices[0].message;

    // Check if the AI wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: any[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolParams = JSON.parse(toolCall.function.arguments || "{}");
        
        console.log(`Executing tool: ${toolName}`, toolParams);
        
        try {
          const result = await executeTool(supabase, toolName, toolParams, userId);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(result),
          });
        } catch (error: any) {
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify({ success: false, error: error.message }),
          });
        }
      }

      // Second AI call with tool results
      const finalResponse = await fetch(AI_GATEWAY_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
        }),
      });

      if (!finalResponse.ok) {
        throw new Error(`AI gateway error on final response: ${finalResponse.status}`);
      }

      const finalResult = await finalResponse.json();
      const finalContent = finalResult.choices[0].message.content;
      
      // Log total usage for tool-calling flow (2 API calls)
      const latencyMs = Date.now() - startTime;
      const toolResultsTokens = toolResults.reduce((sum: number, t: any) => sum + estimateTokens(t.content), 0);
      const responseTokens = estimateTokens(assistantMessage.content || '') + estimateTokens(finalContent || '');
      
      await logAIUsage({
        featureName: 'admin_log_analysis',
        success: true,
        modelUsed: 'gemini-2.5-flash',
        requestTokens: requestTokens + toolResultsTokens,
        responseTokens,
        latencyMs,
        userId,
      });
      console.log(`[admin_log_analysis] Tool-calling success (${latencyMs}ms, ~${requestTokens + toolResultsTokens + responseTokens} tokens)`);
      
      return new Response(JSON.stringify({
        message: finalContent,
        toolsUsed: assistantMessage.tool_calls.map((tc: any) => tc.function.name),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tools called, return direct response
    const latencyMs = Date.now() - startTime;
    const responseTokens = estimateTokens(assistantMessage.content || '');
    
    await logAIUsage({
      featureName: 'admin_log_analysis',
      success: true,
      modelUsed: 'gemini-2.5-flash',
      requestTokens,
      responseTokens,
      latencyMs,
      userId,
    });
    console.log(`[admin_log_analysis] Direct response (${latencyMs}ms, ~${requestTokens + responseTokens} tokens)`);
    
    return new Response(JSON.stringify({
      message: assistantMessage.content,
      toolsUsed: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in admin-log-analysis:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
