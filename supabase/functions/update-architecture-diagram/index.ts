import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";
import { corsHeaders } from '../_shared/cors.ts';


// TalentGeenie Platform-specific knowledge for accurate diagram generation
const PLATFORM_KNOWLEDGE = `
# TalentGeenie Platform - Accurate System Knowledge

## CRITICAL FACTS - USE THESE EXACTLY:
1. NO RESUME UPLOAD: Candidates CANNOT upload resumes. This feature does NOT exist.
2. Interview Creation: HR uses JD Builder → Skills extracted by AI → Questions generated
3. Candidate Invitation: AFTER interview is activated, HR adds candidate emails and sends invitations
4. Interview Taking: Candidate receives email link → Enters name/email → Consent → Proctoring setup → Answer questions → Submit
5. Proctoring: Optional feature enabled per interview - monitors camera, tab switches, multiple faces
6. AI Evaluation: After submission → AI grades responses → Generates CPI score → Creates detailed report

## USER ROLES (Hierarchy):
- Platform Admin: Full system access, manages all organizations
- Partner Admin: Manages their organization and sub-organizations  
- HR Recruiter: Creates interviews, manages candidates, views results
- Interviewer: Reviews results, no creation privileges
- Candidate: Takes interviews only
- Guest: Limited view-only access

## KEY FEATURES:
1. JD Builder (Quick Create): Paste job title → AI extracts skills → Configure question count/difficulty → Generate questions
2. Question Bank: Reusable questions with topics, difficulty levels, approval workflow
3. Interview Flow: Create → Add Questions → Activate → Invite Candidates → Monitor → Evaluate
4. CPI (Candidate Performance Index): Composite score from technical + integrity + problem-solving
5. Proctoring: Camera monitoring, tab switch detection, multiple face detection
6. Certifications: Issue certificates for passed assessments with verification codes
7. Learning Platform: Training paths, assessments, progress tracking
8. ATS Integration: Connect with external applicant tracking systems

## PAGES AND ROUTES:
- /dashboard - Main dashboard with role-specific widgets
- /interviews - Interview list and management
- /interviews/create - Create new interview (JD Builder)
- /interviews/:id - Interview details and candidate management
- /take-interview - Candidate interview experience
- /results/:id - Interview results and CPI analysis
- /admin/hub - Platform admin control center
- /admin/ai-configuration - AI model settings
- /admin/pricing - Subscription plan management
- /admin/users - User management
- /partner - Partner organization portal
- /certifications - Certification management
- /learning - Learning platform

## DATABASE TABLES (Key ones):
- interviews: Core interview records with status, settings
- questions: Question bank with topics, difficulty
- interview_attempts: Candidate attempt records
- assessments: AI-generated evaluations with scores
- candidate_performance_index: CPI calculations
- proctoring_sessions: Monitoring data
- organizations: Multi-tenant organization data
- user_roles: Role assignments per user/org
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const { documentId, section, title, diagramType, currentCode } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user authentication and role
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Check if user has platform_admin role
    const { data: roles } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin');

    if (!roles || roles.length === 0) {
      throw new Error('Platform admin access required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate the system prompt for accurate diagram updates
    const systemPrompt = `You are an expert at creating accurate Mermaid diagrams for the TalentGeenie interview platform.

${PLATFORM_KNOWLEDGE}

CRITICAL RULES:
1. ONLY use features that ACTUALLY exist in TalentGeenie - no made-up features
2. NO resume upload functionality exists - NEVER include it
3. Diagrams must reflect the ACTUAL user flow in the application
4. Use proper Mermaid syntax that will render correctly
5. Keep diagrams focused and readable
6. Use appropriate colors and styling for clarity

DIAGRAM TYPES:
- flowchart: Use "graph TD" or "graph LR" 
- sequence: Use "sequenceDiagram"
- er: Use "erDiagram"
- classDiagram: Use "classDiagram"

Return ONLY valid Mermaid code, no explanations or markdown code blocks.`;

    const userPrompt = `Update this ${diagramType} diagram about "${title}" in the ${section} section.

Current diagram code:
${currentCode}

Please regenerate this diagram with accurate TalentGeenie platform flows. Fix any incorrect information, remove non-existent features (like resume upload), and ensure it reflects the actual system behavior.

Return ONLY the updated Mermaid code.`;

    console.log(`Generating updated diagram for: ${title}`);

    // Use unified AI calling pattern with automatic token logging
    let updatedCode = await callAI({
      featureName: 'architecture_diagram',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      userId: user.id,
    });

    // Clean up the response - remove markdown code blocks if present
    if (updatedCode.startsWith('```')) {
      updatedCode = updatedCode.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '');
    }

    if (!updatedCode) {
      throw new Error('AI did not generate valid diagram code');
    }

    // Update the document in the database
    const { error: updateError } = await supabase
      .from('architecture_documents')
      .update({
        mermaid_code: updatedCode,
        last_generated_at: new Date().toISOString(),
        needs_refresh: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save updated diagram');
    }

    console.log(`Successfully updated diagram: ${title}`);

    return new Response(
      JSON.stringify({
        success: true,
        updatedCode,
        message: 'Diagram updated successfully with AI'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error updating architecture diagram:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
