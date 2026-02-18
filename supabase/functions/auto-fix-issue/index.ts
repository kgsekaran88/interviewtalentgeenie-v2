import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isPlatformAdmin = roles?.some(r => r.role === 'platform_admin');
    if (!isPlatformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { issueId, issueType, context } = await req.json();

    console.log(`Auto-fixing issue: ${issueId} of type: ${issueType}`);

    let fixResult: any = {};

    switch (issueType) {
      case 'rls_policy_missing':
        fixResult = await fixMissingRLSPolicy(supabase, context);
        break;
      
      case 'missing_index':
        fixResult = await fixMissingIndex(supabase, context);
        break;
      
      case 'configuration_error':
        fixResult = await fixConfigurationError(supabase, context);
        break;
      
      case 'data_inconsistency':
        fixResult = await fixDataInconsistency(supabase, context);
        break;
      
      case 'permission_error':
        fixResult = await fixPermissionError(supabase, context);
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown issue type', issueType }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        issueId,
        issueType,
        fixResult,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Auto-fix error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fix missing RLS policy
async function fixMissingRLSPolicy(supabase: any, context: any) {
  const { tableName, policyType } = context;
  
  console.log(`Analyzing RLS policies for table: ${tableName}`);
  
  // Check if RLS is enabled
  const { data: rlsEnabled } = await supabase.rpc('check_rls_enabled', { table_name: tableName });
  
  if (!rlsEnabled) {
    return {
      action: 'diagnostic',
      severity: 'critical',
      recommendation: `Enable RLS on table ${tableName} immediately`,
      sqlExample: `
-- Enable RLS on table
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Create basic policy (adjust based on your needs)
CREATE POLICY "${policyType}_policy_${tableName}"
ON ${tableName}
FOR ${policyType.toUpperCase()}
USING (
  auth.uid() = user_id OR
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'platform_admin'::app_role])
);
      `.trim(),
      impact: 'CRITICAL: Data is publicly accessible without RLS',
      note: 'This fix requires immediate migration execution',
    };
  }
  
  return {
    action: 'diagnostic',
    recommendation: `Add ${policyType} policy for ${tableName}`,
    sqlExample: `
CREATE POLICY "${policyType}_policy_${tableName}"
ON ${tableName}
FOR ${policyType.toUpperCase()}
USING (auth.uid() = user_id);
    `.trim(),
    note: 'This fix requires manual review and migration execution',
  };
}

// Fix missing index
async function fixMissingIndex(supabase: any, context: any) {
  const { tableName, columnName, queryPattern } = context;
  
  console.log(`Checking indexes for ${tableName}.${columnName}`);
  
  // Determine index type based on query pattern
  let indexType = 'btree'; // default
  let indexDefinition = `CREATE INDEX idx_${tableName}_${columnName} ON ${tableName}(${columnName});`;
  
  if (queryPattern === 'text_search') {
    indexType = 'gin';
    indexDefinition = `
-- For full-text search
CREATE INDEX idx_${tableName}_${columnName}_gin 
ON ${tableName} USING GIN (to_tsvector('english', ${columnName}));
    `.trim();
  } else if (queryPattern === 'range_query') {
    indexType = 'btree';
    indexDefinition = `
-- For range queries (>, <, BETWEEN)
CREATE INDEX idx_${tableName}_${columnName}_btree 
ON ${tableName} USING BTREE (${columnName});
    `.trim();
  } else if (queryPattern === 'jsonb') {
    indexType = 'gin';
    indexDefinition = `
-- For JSONB queries
CREATE INDEX idx_${tableName}_${columnName}_gin 
ON ${tableName} USING GIN (${columnName});
    `.trim();
  }
  
  return {
    action: 'diagnostic',
    recommendation: `Add ${indexType} index on ${tableName}(${columnName}) for ${queryPattern || 'general'} queries`,
    sqlExample: indexDefinition,
    estimatedImprovement: 'Query performance could improve by 10-100x depending on table size',
    note: 'Index creation requires migration. Test on staging first for large tables.',
  };
}

// Fix configuration error
async function fixConfigurationError(supabase: any, context: any) {
  const { configType, expectedValue, currentValue } = context;
  
  console.log(`Configuration error detected: ${configType}`);
  
  if (configType === 'interview_settings') {
    // Example: Fix interview configuration
    const { data, error } = await supabase
      .from('interviews')
      .update({ status: 'active', generation_status: 'completed' })
      .eq('status', 'draft')
      .eq('generation_status', 'pending')
      .select();
    
    if (error) throw error;
    
    return {
      action: 'fixed',
      itemsFixed: data?.length || 0,
      details: `Updated ${data?.length || 0} interviews from draft/pending to active/completed`,
    };
  }
  
  return {
    action: 'diagnostic',
    recommendation: `Update ${configType} from ${currentValue} to ${expectedValue}`,
  };
}

// Fix data inconsistency
async function fixDataInconsistency(supabase: any, context: any) {
  const { tableName, inconsistencyType, details } = context;
  
  console.log(`Fixing data inconsistency in ${tableName}: ${inconsistencyType}`);
  
  if (inconsistencyType === 'orphaned_records') {
    // Clean up orphaned test records
    const { data, error } = await supabase
      .from(tableName)
      .delete()
      .ilike('description', '%TEST_DATA_SEED%')
      .or('name.ilike.%Test%,email.ilike.%test%')
      .select();
    
    if (error) throw error;
    
    return {
      action: 'fixed',
      itemsFixed: data?.length || 0,
      details: `Removed ${data?.length || 0} orphaned test records from ${tableName}`,
    };
  }
  
  if (inconsistencyType === 'duplicate_records') {
    // Identify duplicates
    const { data: duplicates } = await supabase
      .from(tableName)
      .select('*')
      .ilike('description', '%TEST_DATA_SEED%');
    
    if (!duplicates || duplicates.length === 0) {
      return {
        action: 'no_action_needed',
        details: 'No duplicate records found',
      };
    }
    
    return {
      action: 'diagnostic',
      duplicatesFound: duplicates.length,
      recommendation: `Found ${duplicates.length} potential duplicate records. Review before deletion.`,
      sqlExample: `
-- Find duplicates by key columns
SELECT column1, column2, COUNT(*)
FROM ${tableName}
GROUP BY column1, column2
HAVING COUNT(*) > 1;

-- Delete duplicates keeping the oldest
DELETE FROM ${tableName} a
USING ${tableName} b
WHERE a.id > b.id 
  AND a.column1 = b.column1 
  AND a.column2 = b.column2;
      `.trim(),
    };
  }
  
  if (inconsistencyType === 'null_required_fields') {
    // Fix null values in required fields
    return {
      action: 'diagnostic',
      recommendation: `Update NULL values in required fields for ${tableName}`,
      sqlExample: `
-- Set default values for NULL required fields
UPDATE ${tableName}
SET 
  required_field1 = COALESCE(required_field1, 'default_value'),
  required_field2 = COALESCE(required_field2, NOW())
WHERE required_field1 IS NULL OR required_field2 IS NULL;

-- Add NOT NULL constraint after fixing
ALTER TABLE ${tableName} 
  ALTER COLUMN required_field1 SET NOT NULL,
  ALTER COLUMN required_field2 SET NOT NULL;
      `.trim(),
    };
  }
  
  return {
    action: 'diagnostic',
    recommendation: `Manual review required for ${inconsistencyType} in ${tableName}`,
    details: details || 'No additional details provided',
  };
}

// Fix permission error
async function fixPermissionError(supabase: any, context: any) {
  const { userId, roleRequired } = context;
  
  console.log(`Fixing permission error for user ${userId}`);
  
  // Check if user has required role
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('role', roleRequired)
    .single();
  
  if (existingRole) {
    return {
      action: 'no_change_needed',
      details: `User already has ${roleRequired} role`,
    };
  }
  
  return {
    action: 'diagnostic',
    recommendation: `Grant ${roleRequired} role to user ${userId}`,
    note: 'Role assignment should be done through proper admin interface',
  };
}
