/**
 * AI-Powered Test Fix Suggestions
 * Provides automated fix recommendations for common test failures
 */

export interface FixSuggestion {
  title: string;
  description: string;
  codeExample?: string;
  steps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'functionality' | 'performance' | 'integration';
}

export interface TestError {
  test_name: string;
  error_message?: string;
  test_category: string;
  details?: any;
}

/**
 * Generate fix suggestions based on test errors
 */
export const generateFixSuggestions = (error: TestError): FixSuggestion[] => {
  const suggestions: FixSuggestion[] = [];
  const errorMsg = error.error_message?.toLowerCase() || '';
  const testName = error.test_name.toLowerCase();

  // RLS Policy Errors
  if (errorMsg.includes('rls') || errorMsg.includes('row level security') || errorMsg.includes('policy')) {
    suggestions.push({
      title: 'Fix Row Level Security Policy',
      description: 'RLS policy is blocking data access. Ensure policies are properly configured for the user role.',
      severity: 'high',
      category: 'security',
      steps: [
        'Check if RLS is enabled on the table',
        'Verify the policy conditions match the test scenario',
        'Ensure the user has the correct role assigned',
        'Test the policy with the specific user context',
      ],
      codeExample: `-- Example RLS Policy Fix
CREATE POLICY "Users can view their own data"
ON public.table_name
FOR SELECT
TO authenticated
USING (user_id = auth.uid());`,
    });
  }

  // Permission/Authorization Errors
  if (errorMsg.includes('permission') || errorMsg.includes('unauthorized') || errorMsg.includes('forbidden')) {
    suggestions.push({
      title: 'Fix Permission Configuration',
      description: 'User lacks required permissions for this action.',
      severity: 'high',
      category: 'security',
      steps: [
        'Verify the user has the correct role(s) assigned in user_roles table',
        'Check if custom roles have the necessary permissions',
        'Ensure PermissionGate component has correct permission requirements',
        'Review the role hierarchy and inheritance',
      ],
      codeExample: `-- Check user roles
SELECT * FROM user_roles WHERE user_id = 'user-uuid';

-- Add missing role
INSERT INTO user_roles (user_id, role) VALUES ('user-uuid', 'platform_admin');`,
    });
  }

  // Organization Context Errors
  if (testName.includes('organization') || errorMsg.includes('organization')) {
    suggestions.push({
      title: 'Fix Organization Context',
      description: 'Organization context is missing or incorrect.',
      severity: 'medium',
      category: 'functionality',
      steps: [
        'Ensure user is a member of the organization (organization_members table)',
        'Check if OrganizationContext is properly initialized',
        'Verify organization_id is being passed correctly to components',
        'Test with both platform_admin and partner_admin roles',
      ],
      codeExample: `// Use OrganizationContext
const { selectedOrgId, userOrgId } = useOrganization();

// Filter data by organization
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('organization_id', selectedOrgId || userOrgId);`,
    });
  }

  // Network/API Errors
  if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
    suggestions.push({
      title: 'Fix Network Error',
      description: 'API request failed due to network issues.',
      severity: 'medium',
      category: 'integration',
      steps: [
        'Check if the API endpoint is correct',
        'Verify network connectivity',
        'Add retry logic with exponential backoff',
        'Implement proper error handling with user feedback',
      ],
      codeExample: `// Add retry logic
import { retryWithBackoff } from '@/lib/error-handler';

const data = await retryWithBackoff(
  () => supabase.from('table').select('*'),
  {
    maxRetries: 3,
    onRetry: (attempt, error) => {
      console.log(\`Retry attempt \${attempt}\`, error);
    }
  }
);`,
    });
  }

  // Database Query Errors
  if (errorMsg.includes('query') || errorMsg.includes('sql') || errorMsg.includes('relation')) {
    suggestions.push({
      title: 'Fix Database Query',
      description: 'Database query has syntax or logical errors.',
      severity: 'high',
      category: 'functionality',
      steps: [
        'Check table and column names for typos',
        'Verify foreign key relationships',
        'Ensure all required joins are included',
        'Test query in Supabase SQL editor',
      ],
      codeExample: `// Correct query with proper joins
const { data, error } = await supabase
  .from('interviews')
  .select(\`
    *,
    organization:organizations(id, name),
    creator:profiles(id, full_name)
  \`)
  .eq('status', 'active');

if (error) {
  console.error('Query error:', error);
}`,
    });
  }

  // Authentication Errors
  if (errorMsg.includes('auth') || errorMsg.includes('token') || errorMsg.includes('session')) {
    suggestions.push({
      title: 'Fix Authentication Issue',
      description: 'User authentication or session is invalid.',
      severity: 'critical',
      category: 'security',
      steps: [
        'Check if user is properly authenticated',
        'Verify JWT token is valid and not expired',
        'Ensure auth context is properly initialized',
        'Test with a fresh login',
      ],
      codeExample: `// Check authentication status
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  // Redirect to login
  navigate('/auth');
}`,
    });
  }

  // Component Rendering Errors
  if (errorMsg.includes('render') || errorMsg.includes('component') || errorMsg.includes('undefined')) {
    suggestions.push({
      title: 'Fix Component Error',
      description: 'Component is failing to render or accessing undefined values.',
      severity: 'medium',
      category: 'functionality',
      steps: [
        'Add null/undefined checks before accessing properties',
        'Ensure data is loaded before rendering dependent components',
        'Add loading states and error boundaries',
        'Use optional chaining and nullish coalescing',
      ],
      codeExample: `// Safe data access
const organizationName = selectedOrg?.name ?? 'Unknown';

// Conditional rendering
{loading ? (
  <Skeleton className="h-10 w-full" />
) : data ? (
  <Component data={data} />
) : (
  <Alert>No data available</Alert>
)}`,
    });
  }

  // Performance Issues
  if (testName.includes('performance') || errorMsg.includes('slow') || errorMsg.includes('timeout')) {
    suggestions.push({
      title: 'Optimize Performance',
      description: 'Operation is taking too long to complete.',
      severity: 'medium',
      category: 'performance',
      steps: [
        'Add database indexes on frequently queried columns',
        'Limit the number of rows returned with .limit()',
        'Use .select() to fetch only required columns',
        'Implement pagination for large datasets',
        'Cache frequently accessed data',
      ],
      codeExample: `// Optimized query
const { data } = await supabase
  .from('large_table')
  .select('id, title, created_at') // Only needed columns
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(50); // Limit results

// Add index in migration
CREATE INDEX idx_large_table_status_created 
ON large_table(status, created_at DESC);`,
    });
  }

  // If no specific suggestions, add general debugging steps
  if (suggestions.length === 0) {
    suggestions.push({
      title: 'General Debugging Steps',
      description: 'Follow these steps to identify and fix the issue.',
      severity: 'low',
      category: error.test_category as any || 'functionality',
      steps: [
        'Check browser console for detailed error messages',
        'Review network tab for failed API requests',
        'Verify all environment variables are set correctly',
        'Check if the issue is reproducible in different browsers',
        'Review recent code changes that might have caused the issue',
      ],
    });
  }

  return suggestions;
};

/**
 * Format fix suggestions for display
 */
export const formatFixSuggestions = (suggestions: FixSuggestion[]): string => {
  return suggestions
    .map((suggestion, index) => {
      let formatted = `${index + 1}. ${suggestion.title} (${suggestion.severity.toUpperCase()})\n`;
      formatted += `   ${suggestion.description}\n\n`;
      formatted += `   Steps:\n`;
      suggestion.steps.forEach((step, i) => {
        formatted += `   ${i + 1}. ${step}\n`;
      });
      if (suggestion.codeExample) {
        formatted += `\n   Code Example:\n${suggestion.codeExample}\n`;
      }
      return formatted;
    })
    .join('\n\n');
};
