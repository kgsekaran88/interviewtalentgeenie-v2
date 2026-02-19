import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { error, context, stackTrace } = await req.json();

    const systemPrompt = `You are an expert debugging assistant for a comprehensive interview platform.
Analyze test failures and provide actionable fix suggestions.

Platform Context:
- Multi-role system: platform_admin, partner_admin, hr_recruiter, interviewer, candidate
- Core flows: Authentication, Partner Onboarding, Organization Management, Interview Creation, Question Repository, Candidate Assessment, Proctoring, Evaluation, Learning, Analytics, Billing, ATS Integration
- Tech stack: React, Supabase, TypeScript, Tailwind CSS
- Database: PostgreSQL with RLS policies

When analyzing errors:
1. Identify root cause
2. Provide specific fix with code examples
3. Suggest preventive measures
4. Rate severity (critical/high/medium/low)`;

    const userPrompt = `Test Error Analysis:

Error: ${error}

Context: ${JSON.stringify(context, null, 2)}

Stack Trace: ${stackTrace || 'Not available'}

Provide a JSON response with:
{
  "rootCause": "Detailed explanation of what went wrong",
  "severity": "critical|high|medium|low",
  "affectedAreas": ["list", "of", "affected", "components"],
  "suggestedFixes": [
    {
      "description": "What to fix",
      "code": "Code example if applicable",
      "file": "File path if known",
      "priority": 1
    }
  ],
  "preventiveMeasures": ["How to prevent this in future"],
  "relatedIssues": ["Potential related problems to check"]
}`;

    // Use unified AI calling pattern with automatic token logging
    const content = await callAI({
      featureName: 'test_error_analysis',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
    });
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in analyze-test-error:', error);
    
    // Fallback analysis without AI
    return new Response(JSON.stringify({
      success: false,
      analysis: {
        rootCause: error.message || 'Unknown error',
        severity: 'high',
        affectedAreas: ['Unknown'],
        suggestedFixes: [{
          description: 'Manual investigation required. AI analysis unavailable.',
          priority: 1
        }],
        preventiveMeasures: ['Add more specific error handling', 'Configure AI provider in settings'],
        relatedIssues: []
      },
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
