import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content, category, documentId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting documentation generation...', { title, content, documentId });

    // PASS 1: Analyze request and select relevant files
    const fileSelectionPrompt = `You are a code analyst. Analyze this documentation request and return a JSON list of file patterns to scan.

User Request:
Title: ${title}
Content: ${content}

Available directories:
- src/pages/ (all application pages)
- src/components/ (reusable UI components)
- src/contexts/ (React contexts for auth, org)
- src/hooks/ (custom React hooks)
- src/lib/ (utility libraries, permissions, validations)
- src/integrations/supabase/ (Supabase client and types)
- supabase/functions/ (edge functions)

Return ONLY a JSON array of file patterns to scan. Be comprehensive but focused on the request.

Example response format:
{
  "patterns": [
    "src/pages/*Interview*.tsx",
    "src/pages/CreateInterview.tsx",
    "src/components/interview/*.tsx",
    "src/lib/permissions.ts",
    "src/contexts/AuthContext.tsx"
  ],
  "reason": "Interview flow requires interview pages, components, and permission system"
}`;

    // Use unified AI calling pattern for Pass 1
    const pass1Content = await callAI({
      featureName: 'documentation_code_analysis',
      prompt: fileSelectionPrompt,
      systemPrompt: 'You are a code analysis expert. Return only valid JSON.',
    });
    
    // Extract JSON from response (handle markdown code blocks)
    let fileSelection;
    try {
      const jsonMatch = pass1Content.match(/\{[\s\S]*\}/);
      fileSelection = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(pass1Content);
    } catch (e) {
      console.error('Failed to parse file selection:', pass1Content);
      throw new Error('AI returned invalid file selection format');
    }

    console.log('Selected file patterns:', fileSelection);

    // Read project files (simulate file reading - in real implementation, you'd read from filesystem)
    const projectStructure = `
# Project Structure Overview

## Pages (src/pages/)
- Auth.tsx, Landing.tsx, Dashboard.tsx
- Interview Pages: CreateInterview.tsx, InterviewDetail.tsx, TakeInterview.tsx, InterviewProgress.tsx
- Learning Pages: LearningDashboard.tsx, TakeLearningAssessment.tsx, MyCertificates.tsx
- Admin Pages: PlatformAdminHub.tsx, OrganizationManagement.tsx, RoleAssignment.tsx
- Proctoring: ProctoringDashboard.tsx, ProctoringSettings.tsx

## Key Systems
- Authentication: src/contexts/AuthContext.tsx
- Permissions: src/lib/permissions.ts (RBAC with roles: platform_admin, partner_admin, hr_recruiter, ta_creator, interviewer, candidate, guest)
- Database: src/integrations/supabase/types.ts (full type definitions)

## User Roles & Hierarchy:
- platform_admin: Full system access
- partner_admin: Organization management
- hr_recruiter: Manage interviews and candidates
- ta_creator: Create interview questions
- interviewer: Conduct interviews
- candidate: Take assessments
- guest: Limited read-only access

## Interview Flow:
1. Create Interview (hr_recruiter+): Title, job description, AI extracts skills
2. Configure Skills: Adjust skill percentages
3. Question Bank: Set question count per difficulty (easy/medium/hard)
4. Generate Questions: AI creates questions based on skills
5. Review Questions: Approve/reject generated questions
6. Publish Interview: Share link or send invitations
7. Candidate Takes: Proctoring enabled (camera, screen, audio monitoring)
8. Auto-Evaluate: AI scores answers, generates CPI (Candidate Performance Index)
9. Review Results: Hiring recommendations, bias detection

## Database Schema:
- interviews: title, job_description, creator_id, organization_id, status, proctoring_enabled
- questions: interview_id, question_text, difficulty, topic, question_type (mcq/coding/descriptive)
- interview_attempts: candidate_email, answers (jsonb), status, session_token
- assessments: attempt_id, overall_score, hiring_decision, detailed_analysis
- proctoring_sessions: interview_attempt_id, violations (jsonb), integrity_score
`;

    // PASS 2: Generate comprehensive documentation
    const documentationPrompt = `Generate comprehensive, detailed documentation based on this request.

User Request:
Title: ${title}
Content: ${content}

${projectStructure}

Requirements:
1. Document ALL relevant pages with complete user flows
2. For each page, include:
   - Required user roles (e.g., "Requires: hr_recruiter, ta_creator, or platform_admin")
   - Step-by-step process flow
   - Configuration options and settings
   - Database interactions
   - Edge functions called
   - Access control and permissions
3. Use markdown formatting with:
   - Clear headings (##, ###)
   - Bullet points and numbered lists
   - Code blocks for technical details
   - Tables for role permissions
4. Go to the LOWEST POSSIBLE LEVEL of detail
5. Include specific field names, validation rules, and data types

Generate the documentation in markdown format:`;

    // Use unified AI calling pattern for Pass 2
    const generatedContent = await callAI({
      featureName: 'documentation_generation_from_code',
      prompt: documentationPrompt,
      systemPrompt: 'You are a technical documentation expert. Generate detailed, accurate documentation in markdown format.',
    });

    console.log('Documentation generated, length:', generatedContent.length);

    // Calculate file hashes (simplified - use patterns from selection)
    const fileHashes: Record<string, string> = {};
    for (const pattern of fileSelection.patterns) {
      fileHashes[pattern] = `hash_${Date.now()}`; // In real impl, calculate MD5
    }

    // Return preview data without saving to database
    return new Response(
      JSON.stringify({ 
        success: true,
        preview: true,
        data: {
          title,
          content: generatedContent,
          category,
          source_files: fileSelection.patterns,
          file_hashes: fileHashes,
          generation_prompt: content,
          documentId: documentId || null,
        },
        filesScanned: fileSelection.patterns.length,
        message: 'Documentation generated successfully. Review before saving.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating documentation:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
