export type TemplateSize = 'small' | 'medium' | 'large' | 'custom';

export interface FlowTestTemplate {
  id: string;
  name: string;
  flowId: string;
  size: TemplateSize;
  description: string;
  parameters: {
    organizationCount?: number;
    usersPerOrg?: number;
    interviewsPerOrg?: number;
    questionsPerInterview?: number;
    candidatesPerInterview?: number;
    attemptsPerCandidate?: number;
    enableProctoring?: boolean;
    enableAI?: boolean;
    includeViolations?: boolean;
    dataComplexity?: 'simple' | 'moderate' | 'complex';
    [key: string]: any;
  };
  estimatedDuration: number; // in seconds
  resourceUsage: {
    storage: string;
    database: string;
    aiTokens?: number;
  };
}

export interface TestIssue {
  id: string;
  testName: string;
  flowId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  impact: string;
  evidence?: string;
  expectedBehavior: string;
  actualBehavior: string;
  fixSuggestion: {
    summary: string;
    steps: string[];
    codeExample?: string;
    documentationLinks?: string[];
    estimatedEffort: string;
  };
  autoFixAvailable: boolean;
  autoFixFunction?: string;
  reproductionSteps?: string[];
  affectedComponents?: string[];
  timestamp: string;
}

export interface TestReport {
  id: string;
  flowId: string;
  templateUsed?: FlowTestTemplate;
  executionTime: number;
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    successRate: number;
  };
  tests: Array<{
    name: string;
    status: 'passed' | 'failed' | 'warning' | 'skipped';
    duration: number;
    error?: string;
  }>;
  issues: TestIssue[];
  recommendations: string[];
  nextSteps: string[];
  metadata: {
    environment: string;
    dataSize: TemplateSize;
    executedBy: string;
  };
  comprehensiveReport?: {
    flowId: string;
    flowName: string;
    overallStatus: 'passed' | 'failed';
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    totalDuration: number;
    steps: Array<{
      step: string;
      status: 'passed' | 'failed' | 'skipped';
      duration: number;
      error?: string;
      data?: any;
      fixSuggestion?: string;
    }>;
    errors: Array<{
      step: string;
      error: string;
      suggestion: string;
    }>;
  };
}

export const DEFAULT_TEMPLATES: Record<TemplateSize, Partial<FlowTestTemplate>> = {
  small: {
    size: 'small',
    description: 'Minimal dataset for quick smoke testing',
    parameters: {
      organizationCount: 1,
      usersPerOrg: 2,
      interviewsPerOrg: 2,
      questionsPerInterview: 5,
      candidatesPerInterview: 2,
      attemptsPerCandidate: 1,
      enableProctoring: false,
      enableAI: false,
      includeViolations: false,
      dataComplexity: 'simple',
    },
    estimatedDuration: 30,
    resourceUsage: {
      storage: '< 10 MB',
      database: '~50 records',
    },
  },
  medium: {
    size: 'medium',
    description: 'Moderate dataset for comprehensive functional testing',
    parameters: {
      organizationCount: 3,
      usersPerOrg: 5,
      interviewsPerOrg: 5,
      questionsPerInterview: 15,
      candidatesPerInterview: 5,
      attemptsPerCandidate: 2,
      enableProctoring: true,
      enableAI: true,
      includeViolations: true,
      dataComplexity: 'moderate',
    },
    estimatedDuration: 120,
    resourceUsage: {
      storage: '50-100 MB',
      database: '~500 records',
      aiTokens: 10000,
    },
  },
  large: {
    size: 'large',
    description: 'Large dataset for performance and stress testing',
    parameters: {
      organizationCount: 10,
      usersPerOrg: 20,
      interviewsPerOrg: 15,
      questionsPerInterview: 30,
      candidatesPerInterview: 20,
      attemptsPerCandidate: 3,
      enableProctoring: true,
      enableAI: true,
      includeViolations: true,
      dataComplexity: 'complex',
    },
    estimatedDuration: 600,
    resourceUsage: {
      storage: '500+ MB',
      database: '~5000 records',
      aiTokens: 100000,
    },
  },
  custom: {
    size: 'custom',
    description: 'Custom configuration with user-defined parameters',
    parameters: {},
    estimatedDuration: 0,
    resourceUsage: {
      storage: 'Variable',
      database: 'Variable',
    },
  },
};

export const FLOW_SPECIFIC_TEMPLATES: Record<string, Partial<FlowTestTemplate>[]> = {
  authentication: [
    {
      name: 'Basic Auth Test',
      parameters: { usersPerOrg: 3, testPasswordComplexity: true, testSessionManagement: true },
    },
    {
      name: 'Multi-Role Auth Test',
      parameters: { usersPerOrg: 10, rolesCount: 7, testRoleInheritance: true },
    },
  ],
  'interview-creation': [
    {
      name: 'Simple Interview',
      parameters: { interviewsPerOrg: 3, questionsPerInterview: 10, questionTypes: ['mcq'] },
    },
    {
      name: 'Complex Interview with AI',
      parameters: { interviewsPerOrg: 5, questionsPerInterview: 30, questionTypes: ['mcq', 'coding', 'descriptive'], enableAI: true },
    },
  ],
  proctoring: [
    {
      name: 'Basic Proctoring',
      parameters: { candidatesPerInterview: 5, includeViolations: false, recordingEnabled: true },
    },
    {
      name: 'Full Proctoring with Violations',
      parameters: { candidatesPerInterview: 10, includeViolations: true, violationTypes: ['tab_switch', 'multiple_persons', 'look_away'], recordingEnabled: true },
    },
  ],
};
