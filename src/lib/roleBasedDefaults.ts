/**
 * Role-Based Interview Configuration Defaults
 * Provides dynamic defaults based on job title seniority level
 */

export type ExperienceLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'architect';

export interface QuestionTypeDistribution {
  mcq: number;
  scenario: number;
  coding: number;
  descriptive: number;
}

export interface CategoryDifficultyDistribution {
  mcq: { easy: number; medium: number; hard: number };
  scenario: { easy: number; medium: number; hard: number };
  coding: { easy: number; medium: number; hard: number };
  descriptive: { easy: number; medium: number; hard: number };
}

export interface RoleBasedConfig {
  questionTypeDistribution: QuestionTypeDistribution;
  categoryDifficulty: CategoryDifficultyDistribution;
  questionBankSize: number;
}

// Senior/Leadership roles - less coding, more scenario and descriptive
const SENIOR_DEFAULTS: QuestionTypeDistribution = {
  mcq: 25,
  scenario: 40,
  coding: 10,
  descriptive: 25
};

// Mid-level roles - balanced distribution
const MID_DEFAULTS: QuestionTypeDistribution = {
  mcq: 35,
  scenario: 30,
  coding: 25,
  descriptive: 10
};

// Junior roles - more coding and MCQ, less scenario/descriptive
const JUNIOR_DEFAULTS: QuestionTypeDistribution = {
  mcq: 40,
  scenario: 15,
  coding: 35,
  descriptive: 10
};

// Senior category difficulty - harder scenarios, balanced coding (NO EASY coding for <= 20 questions)
const SENIOR_CATEGORY_DIFFICULTY: CategoryDifficultyDistribution = {
  mcq: { easy: 20, medium: 50, hard: 30 },
  scenario: { easy: 10, medium: 40, hard: 50 },
  coding: { easy: 0, medium: 50, hard: 50 }, // Default: 1 medium + 1 hard for 10 questions
  descriptive: { easy: 10, medium: 40, hard: 50 }
};

// Mid category difficulty - balanced (NO EASY coding for <= 20 questions)
const MID_CATEGORY_DIFFICULTY: CategoryDifficultyDistribution = {
  mcq: { easy: 30, medium: 50, hard: 20 },
  scenario: { easy: 25, medium: 50, hard: 25 },
  coding: { easy: 0, medium: 50, hard: 50 }, // Default: 1 medium + 1 hard for 10 questions
  descriptive: { easy: 25, medium: 50, hard: 25 }
};

// Junior category difficulty - more easy/medium, less hard (still no easy coding for <= 20 questions)
const JUNIOR_CATEGORY_DIFFICULTY: CategoryDifficultyDistribution = {
  mcq: { easy: 40, medium: 45, hard: 15 },
  scenario: { easy: 40, medium: 45, hard: 15 },
  coding: { easy: 0, medium: 50, hard: 50 }, // Default: 1 medium + 1 hard for 10 questions
  descriptive: { easy: 40, medium: 45, hard: 15 }
};

// Job title patterns for experience level detection
const SENIOR_PATTERNS = [
  'senior', 'sr.', 'sr ', 'lead', 'principal', 'staff', 'architect',
  'director', 'head', 'vp', 'manager', 'chief', 'cto', 'ceo', 'cfo',
  'distinguished', 'fellow', 'expert', 'specialist'
];

const JUNIOR_PATTERNS = [
  'junior', 'jr.', 'jr ', 'intern', 'trainee', 'associate', 'entry',
  'graduate', 'fresher', 'apprentice', 'beginner'
];

/**
 * Detect experience level from job title
 */
export function detectExperienceLevel(jobTitle: string): ExperienceLevel {
  const titleLower = jobTitle.toLowerCase();
  
  // Check for senior patterns
  for (const pattern of SENIOR_PATTERNS) {
    if (titleLower.includes(pattern)) {
      // Further classify
      if (titleLower.includes('architect') || titleLower.includes('principal') || titleLower.includes('distinguished')) {
        return 'architect';
      }
      if (titleLower.includes('lead') || titleLower.includes('staff')) {
        return 'lead';
      }
      return 'senior';
    }
  }
  
  // Check for junior patterns
  for (const pattern of JUNIOR_PATTERNS) {
    if (titleLower.includes(pattern)) {
      if (titleLower.includes('intern') || titleLower.includes('trainee')) {
        return 'intern';
      }
      return 'junior';
    }
  }
  
  // Default to mid-level
  return 'mid';
}

/**
 * Get role-based configuration defaults
 */
export function getRoleBasedConfig(experienceLevel: ExperienceLevel): RoleBasedConfig {
  switch (experienceLevel) {
    case 'intern':
    case 'junior':
      return {
        questionTypeDistribution: JUNIOR_DEFAULTS,
        categoryDifficulty: JUNIOR_CATEGORY_DIFFICULTY,
        questionBankSize: 200
      };
    
    case 'senior':
    case 'lead':
    case 'principal':
    case 'architect':
      return {
        questionTypeDistribution: SENIOR_DEFAULTS,
        categoryDifficulty: SENIOR_CATEGORY_DIFFICULTY,
        questionBankSize: 200
      };
    
    case 'mid':
    default:
      return {
        questionTypeDistribution: MID_DEFAULTS,
        categoryDifficulty: MID_CATEGORY_DIFFICULTY,
        questionBankSize: 200
      };
  }
}

/**
 * Get default category difficulty (for non-role-aware contexts)
 */
export function getDefaultCategoryDifficulty(): CategoryDifficultyDistribution {
  return MID_CATEGORY_DIFFICULTY;
}

/**
 * Convert category difficulty to overall difficulty for backward compatibility
 */
export function categoryToOverallDifficulty(
  categoryDifficulty: CategoryDifficultyDistribution,
  questionTypeDistribution: QuestionTypeDistribution
): { easy: number; medium: number; hard: number } {
  // Weight the category difficulties by their type distribution
  const totalWeight = questionTypeDistribution.mcq + questionTypeDistribution.scenario + 
                     questionTypeDistribution.coding + questionTypeDistribution.descriptive;
  
  if (totalWeight === 0) return { easy: 30, medium: 50, hard: 20 };
  
  const easy = Math.round(
    (categoryDifficulty.mcq.easy * questionTypeDistribution.mcq +
     categoryDifficulty.scenario.easy * questionTypeDistribution.scenario +
     categoryDifficulty.coding.easy * questionTypeDistribution.coding +
     categoryDifficulty.descriptive.easy * questionTypeDistribution.descriptive) / totalWeight
  );
  
  const medium = Math.round(
    (categoryDifficulty.mcq.medium * questionTypeDistribution.mcq +
     categoryDifficulty.scenario.medium * questionTypeDistribution.scenario +
     categoryDifficulty.coding.medium * questionTypeDistribution.coding +
     categoryDifficulty.descriptive.medium * questionTypeDistribution.descriptive) / totalWeight
  );
  
  const hard = 100 - easy - medium;
  
  return { easy, medium, hard };
}

/**
 * Get smart coding difficulty based on question count
 * Rules:
 * - For <= 20 questions: No easy coding (50% medium, 50% hard)
 * - For > 20 questions: Allow easy (20% easy, 40% medium, 40% hard)
 */
export function getSmartCodingDifficulty(questionCount: number): { easy: number; medium: number; hard: number } {
  if (questionCount <= 20) {
    return { easy: 0, medium: 50, hard: 50 };
  } else {
    return { easy: 20, medium: 40, hard: 40 };
  }
}

/**
 * Calculate expected coding question counts based on configuration
 */
export function calculateCodingQuestionCounts(
  questionCount: number,
  codingPercent: number,
  codingDifficulty: { easy: number; medium: number; hard: number }
): { easy: number; medium: number; hard: number; total: number } {
  const totalCoding = Math.round(questionCount * codingPercent / 100);
  const easy = Math.round(totalCoding * codingDifficulty.easy / 100);
  const medium = Math.round(totalCoding * codingDifficulty.medium / 100);
  const hard = totalCoding - easy - medium;
  
  return { easy, medium, hard, total: totalCoding };
}

/**
 * Convert percentage-based category difficulty to count-based
 */
export function percentsToCounts(
  percentages: CategoryDifficultyDistribution,
  typeDistribution: QuestionTypeDistribution
): CategoryDifficultyDistribution {
  const convert = (category: keyof CategoryDifficultyDistribution) => {
    const total = typeDistribution[category];
    if (total === 0) return { easy: 0, medium: 0, hard: 0 };
    const easy = Math.round(total * percentages[category].easy / 100);
    const medium = Math.round(total * percentages[category].medium / 100);
    const hard = total - easy - medium;
    return { easy, medium, hard };
  };
  
  return {
    mcq: convert('mcq'),
    scenario: convert('scenario'),
    coding: convert('coding'),
    descriptive: convert('descriptive'),
  };
}

/**
 * Convert count-based category difficulty to percentage-based
 */
export function countsToPercents(
  counts: CategoryDifficultyDistribution,
  typeDistribution: QuestionTypeDistribution
): CategoryDifficultyDistribution {
  const convert = (category: keyof CategoryDifficultyDistribution) => {
    const total = typeDistribution[category];
    if (total === 0) return { easy: 0, medium: 0, hard: 0 };
    const easy = Math.round(counts[category].easy / total * 100);
    const medium = Math.round(counts[category].medium / total * 100);
    const hard = 100 - easy - medium;
    return { easy, medium, hard };
  };
  
  return {
    mcq: convert('mcq'),
    scenario: convert('scenario'),
    coding: convert('coding'),
    descriptive: convert('descriptive'),
  };
}
