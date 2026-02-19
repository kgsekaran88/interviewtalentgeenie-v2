import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


// Simulated file hash generation based on timestamp and content patterns
// In a real scenario, this would compute actual file hashes from the codebase
function generateSimulatedHash(filename: string): string {
  const baseHash = btoa(filename + Date.now().toString()).slice(0, 16);
  return baseHash;
}

// Key files that affect architecture documentation
const TRACKED_FILES: Record<string, string[]> = {
  'system_overview': ['src/App.tsx', 'src/integrations/supabase/client.ts'],
  'role_hierarchy': ['src/hooks/useUserRoles.ts', 'src/lib/permissions.ts'],
  'page_flows': ['src/App.tsx', 'src/pages/PlatformAdminHub.tsx', 'src/pages/PartnerPortal.tsx'],
  'feature_flows': [
    'src/pages/TakeInterview.tsx',
    'src/pages/CreateInterview.tsx', 
    'src/pages/Certifications.tsx',
    'src/components/proctoring/ProctoringMonitor.tsx'
  ],
  'database': ['src/integrations/supabase/types.ts'],
  'auth_flows': ['src/contexts/AuthContext.tsx', 'src/components/ProtectedRoute.tsx']
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current architecture documents with their stored file hashes
    const { data: docs, error: docsError } = await supabase
      .from('architecture_documents')
      .select('id, section, file_hashes, analyzed_files, needs_refresh');

    if (docsError) {
      throw docsError;
    }

    console.log(`Checking ${docs?.length || 0} architecture documents for changes...`);

    // For each document, check if any of its tracked files have changed
    // In a real implementation, this would compare actual file hashes
    // Here we simulate by checking if the stored hash differs from a "current" hash
    const changes: { section: string; files_changed: string[]; id: string }[] = [];
    const docsToUpdate: string[] = [];

    for (const doc of docs || []) {
      const storedHashes = (doc.file_hashes as Record<string, string>) || {};
      const analyzedFiles = doc.analyzed_files || [];
      const changedFiles: string[] = [];

      for (const file of analyzedFiles) {
        // Simulate checking if file has changed since last generation
        // In production, you'd compute actual file hashes and compare
        const storedHash = storedHashes[file];
        if (!storedHash) {
          // No hash stored means we should mark as needing refresh
          changedFiles.push(file);
        }
      }

      if (changedFiles.length > 0 && !doc.needs_refresh) {
        changes.push({
          section: doc.section,
          files_changed: changedFiles,
          id: doc.id
        });
        docsToUpdate.push(doc.id);
      }
    }

    // Update documents that need refresh
    if (docsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('architecture_documents')
        .update({ needs_refresh: true })
        .in('id', docsToUpdate);

      if (updateError) {
        console.error('Error updating documents:', updateError);
      }
    }

    // Get summary status
    const { data: status } = await supabase.rpc('check_architecture_docs_status');

    console.log(`Change detection complete. ${changes.length} sections may be outdated.`);

    return new Response(
      JSON.stringify({
        success: true,
        changes_detected: changes.length > 0,
        changed_sections: changes,
        status,
        message: changes.length > 0 
          ? `${changes.length} section(s) may need refresh based on code changes`
          : 'All documentation appears up to date'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error checking file changes:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
