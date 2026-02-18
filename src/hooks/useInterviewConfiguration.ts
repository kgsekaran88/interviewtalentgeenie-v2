import { useState, useCallback, useMemo } from 'react';
import { CategoryDifficultyDistribution, getDefaultCategoryDifficulty } from '@/lib/roleBasedDefaults';

export interface QuestionTypeDistribution {
  mcq: number;
  scenario: number;
  coding: number;
  descriptive: number;
}

export interface InterviewConfigTemplate {
  version: string;
  name: string;
  createdAt: string;
  createdBy?: string;
  config: {
    // Job details
    jobTitle: string;
    jobDescription: string;
    skills: string[];
    // Interview settings
    questionCount: number;
    questionBankSize: number;
    timeLimit: number | null;
    skillDomain: string | null;
    questionTypeDistribution: QuestionTypeDistribution;
    categoryDifficultyDistribution: CategoryDifficultyDistribution;
    topics: Record<string, number>;
    requiredQuestionRules: Array<{
      type: 'mcq' | 'descriptive' | 'scenario' | 'coding';
      difficulty: 'easy' | 'medium' | 'hard';
      min: number;
      topic?: string; // Optional: specific topic like "SQL", "JavaScript"
    }>;
    proctoringEnabled: boolean;
    // Client context (for interview creation flow)
    primaryCloud?: string | null;
    industry?: string | null;
  };
}

export interface UseInterviewConfigurationOptions {
  questionCount: number;
  showCoding?: boolean;
}

export function useInterviewConfiguration(options: UseInterviewConfigurationOptions) {
  const { questionCount, showCoding = true } = options;
  
  // Question type distribution (absolute counts)
  const [typeDistribution, setTypeDistribution] = useState<QuestionTypeDistribution>({
    mcq: Math.round(questionCount * 0.4),
    scenario: Math.round(questionCount * 0.3),
    coding: showCoding ? Math.round(questionCount * 0.2) : 0,
    descriptive: Math.round(questionCount * 0.1),
  });

  // Computed totals
  const typeTotal = useMemo(() => 
    Object.values(typeDistribution).reduce((a, b) => a + b, 0),
    [typeDistribution]
  );

  // Type keys for iteration
  const typeKeys = useMemo(() => 
    showCoding 
      ? ['mcq', 'scenario', 'coding', 'descriptive'] as const
      : ['mcq', 'scenario', 'descriptive'] as const,
    [showCoding]
  );

  // Handle type count change with auto-adjustment
  const handleTypeCountChange = useCallback((
    type: keyof QuestionTypeDistribution, 
    value: number, 
    isLast: boolean
  ) => {
    setTypeDistribution(prev => {
      const newDistribution = { ...prev, [type]: Math.max(0, value) };
      
      if (!isLast) {
        // Auto-adjust last field
        const lastKey = typeKeys[typeKeys.length - 1];
        const otherTotal = typeKeys
          .filter(k => k !== lastKey)
          .reduce((sum, k) => sum + (newDistribution[k] || 0), 0);
        const remaining = Math.max(0, questionCount - otherTotal);
        newDistribution[lastKey] = remaining;
      }
      
      return newDistribution;
    });
  }, [questionCount, typeKeys]);

  // Recalculate distribution when question count changes
  const recalculateForQuestionCount = useCallback((newCount: number) => {
    const ratio = newCount / Math.max(1, typeTotal);
    setTypeDistribution(prev => {
      const newDist = {
        mcq: Math.round(prev.mcq * ratio),
        scenario: Math.round(prev.scenario * ratio),
        coding: Math.round(prev.coding * ratio),
        descriptive: Math.round(prev.descriptive * ratio),
      };
      // Adjust to match exactly
      const total = Object.values(newDist).reduce((a, b) => a + b, 0);
      if (total !== newCount) {
        newDist.mcq += newCount - total;
      }
      return newDist;
    });
  }, [typeTotal]);

  // Export template
  const exportTemplate = useCallback((templateName: string, additionalConfig: Partial<InterviewConfigTemplate['config']>): InterviewConfigTemplate => {
    return {
      version: '1.0',
      name: templateName,
      createdAt: new Date().toISOString(),
      config: {
        jobTitle: additionalConfig.jobTitle || '',
        jobDescription: additionalConfig.jobDescription || '',
        skills: additionalConfig.skills || [],
        questionCount,
        questionBankSize: additionalConfig.questionBankSize || 200,
        timeLimit: additionalConfig.timeLimit ?? 30,
        skillDomain: additionalConfig.skillDomain || null,
        questionTypeDistribution: typeDistribution,
        categoryDifficultyDistribution: additionalConfig.categoryDifficultyDistribution || getDefaultCategoryDifficulty(),
        topics: additionalConfig.topics || {},
        requiredQuestionRules: additionalConfig.requiredQuestionRules || [],
        proctoringEnabled: additionalConfig.proctoringEnabled || false,
      },
    };
  }, [questionCount, typeDistribution]);

  // Import template
  const importTemplate = useCallback((template: InterviewConfigTemplate) => {
    const { config } = template;
    setTypeDistribution(config.questionTypeDistribution);
    return config;
  }, []);

  // Download template as JSON file
  const downloadTemplate = useCallback((template: InterviewConfigTemplate) => {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-config-${template.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    typeDistribution,
    setTypeDistribution,
    typeTotal,
    typeKeys,
    handleTypeCountChange,
    recalculateForQuestionCount,
    exportTemplate,
    importTemplate,
    downloadTemplate,
  };
}
