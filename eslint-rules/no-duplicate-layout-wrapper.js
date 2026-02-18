/**
 * Custom ESLint rule to prevent duplicate layout wrappers
 * Detects when pages import AppLayout when they should use hierarchical layouts
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent duplicate layout wrappers in hierarchical route pages',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      duplicateLayout: 'Do not import AppLayout in pages using hierarchical layouts (AdminLayout, PartnerLayout, RecruiterLayout, InterviewerLayout, CandidateLayout). The layout is already provided by the route wrapper.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    const isPageFile = filename.includes('/pages/') && filename.endsWith('.tsx');
    
    // Pages that should NOT use AppLayout (they use hierarchical layouts)
    const hierarchicalPages = [
      // Admin pages
      'PlatformAdminDashboard', 'PartnerManagement', 'UnifiedUserManagement',
      'RoleAssignment', 'AdvancedAnalytics', 'PricingManagement', 'PlatformSettings',
      'AdminTraining', 'AutomatedTestSuite', 'PerformanceBenchmark', 'TestingHub',
      'TestManagement', 'PlatformAdminHub',
      // Partner pages
      'OrganizationSettings', 'OrganizationAnalytics', 'OrganizationManagement',
      'BillingManagement', 'PartnerPortal',
      // Recruiter pages
      'CreateInterview', 'InterviewDetail', 'AssessmentReport', 'ProctoringDashboard',
      'QuestionRepository', 'TemplatesLibrary', 'ReportBuilder', 'Dashboard',
      // Interviewer pages (none currently use AppLayout)
      // Candidate pages
      'MyApplications', 'Learning', 'MyLearningPlan',
    ];

    const isHierarchicalPage = hierarchicalPages.some(page => 
      filename.includes(`/pages/${page}.tsx`)
    );

    if (!isPageFile || !isHierarchicalPage) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value === '@/components/AppLayout') {
          const importedNames = node.specifiers
            .map(spec => spec.local.name)
            .filter(name => name === 'AppLayout');

          if (importedNames.length > 0) {
            context.report({
              node,
              messageId: 'duplicateLayout',
            });
          }
        }
      },
    };
  },
};
