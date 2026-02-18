/**
 * Configuration Presets
 * Pre-defined configuration templates for common use cases
 */

import { logger } from '@/lib/logger';

export interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  configurations: Record<string, any>;
}

export const CONFIG_PRESETS: ConfigPreset[] = [
  {
    id: 'strict-proctoring',
    name: 'Strict Proctoring',
    description: 'High-security proctoring with strict violation thresholds',
    category: 'security',
    icon: 'Shield',
    configurations: {
      'proctoring_violation_threshold': 3,
      'proctoring_auto_submit': true,
      'proctoring_min_integrity_score': 85,
      'proctoring_max_tab_switches': 1,
      'proctoring_max_look_aways': 3,
      'proctoring_recording_enabled': true,
      'proctoring_face_detection_enabled': true,
      'proctoring_voice_analysis_enabled': true,
    },
  },
  {
    id: 'relaxed-interview',
    name: 'Relaxed Interview',
    description: 'More lenient settings for low-stakes assessments',
    category: 'flexibility',
    icon: 'Smile',
    configurations: {
      'proctoring_violation_threshold': 10,
      'proctoring_auto_submit': false,
      'proctoring_min_integrity_score': 60,
      'proctoring_max_tab_switches': 5,
      'proctoring_max_look_aways': 10,
      'proctoring_recording_enabled': false,
      'proctoring_face_detection_enabled': false,
      'proctoring_voice_analysis_enabled': false,
    },
  },
  {
    id: 'balanced-default',
    name: 'Balanced (Default)',
    description: 'Balanced configuration for general use',
    category: 'general',
    icon: 'Scale',
    configurations: {
      'proctoring_violation_threshold': 5,
      'proctoring_auto_submit': true,
      'proctoring_min_integrity_score': 70,
      'proctoring_max_tab_switches': 3,
      'proctoring_max_look_aways': 5,
      'proctoring_recording_enabled': true,
      'proctoring_face_detection_enabled': true,
      'proctoring_voice_analysis_enabled': false,
      'interview_difficulty_easy_percentage': 30,
      'interview_difficulty_medium_percentage': 50,
      'interview_difficulty_hard_percentage': 20,
      'cpi_technical_weight': 40,
      'cpi_problem_solving_weight': 30,
      'cpi_integrity_weight': 30,
    },
  },
  {
    id: 'cost-optimized',
    name: 'Cost Optimized',
    description: 'Optimize for minimal AI usage and costs',
    category: 'cost',
    icon: 'DollarSign',
    configurations: {
      'ai_question_generation_model': 'google/gemini-2.5-flash-lite',
      'ai_evaluation_model': 'google/gemini-2.5-flash-lite',
      'ai_bias_detection_model': 'google/gemini-2.5-flash-lite',
      'ai_resume_parsing_model': 'google/gemini-2.5-flash-lite',
      'ai_skill_extraction_model': 'google/gemini-2.5-flash-lite',
      'ai_generation_timeout_seconds': 90,
      'ai_evaluation_timeout_seconds': 120,
      'ai_fallback_enabled': false,
      'proctoring_recording_enabled': false,
      'proctoring_voice_analysis_enabled': false,
    },
  },
  {
    id: 'high-quality-ai',
    name: 'High Quality AI',
    description: 'Best AI models for maximum accuracy',
    category: 'quality',
    icon: 'Sparkles',
    configurations: {
      'ai_question_generation_model': 'google/gemini-2.5-pro',
      'ai_evaluation_model': 'google/gemini-2.5-pro',
      'ai_bias_detection_model': 'google/gemini-2.5-pro',
      'ai_resume_parsing_model': 'google/gemini-2.5-flash',
      'ai_skill_extraction_model': 'google/gemini-2.5-flash',
      'ai_generation_timeout_seconds': 180,
      'ai_evaluation_timeout_seconds': 240,
      'ai_fallback_enabled': true,
      'ai_max_retry_attempts': 5,
    },
  },
  {
    id: 'technical-heavy',
    name: 'Technical Focus',
    description: 'Emphasize technical skills in CPI scoring',
    category: 'scoring',
    icon: 'Code',
    configurations: {
      'cpi_technical_weight': 60,
      'cpi_problem_solving_weight': 25,
      'cpi_integrity_weight': 15,
      'interview_difficulty_easy_percentage': 20,
      'interview_difficulty_medium_percentage': 40,
      'interview_difficulty_hard_percentage': 40,
    },
  },
  {
    id: 'integrity-focused',
    name: 'Integrity Focused',
    description: 'Prioritize candidate integrity and honesty',
    category: 'scoring',
    icon: 'CheckCircle',
    configurations: {
      'cpi_technical_weight': 30,
      'cpi_problem_solving_weight': 25,
      'cpi_integrity_weight': 45,
      'proctoring_min_integrity_score': 80,
      'proctoring_violation_threshold': 3,
      'proctoring_recording_enabled': true,
      'proctoring_face_detection_enabled': true,
    },
  },
];

export function getPresetById(id: string): ConfigPreset | undefined {
  return CONFIG_PRESETS.find(preset => preset.id === id);
}

export function getPresetsByCategory(category: string): ConfigPreset[] {
  return CONFIG_PRESETS.filter(preset => preset.category === category);
}

export function exportConfiguration(configs: Record<string, any>): string {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    configurations: configs,
  };
  return JSON.stringify(exportData, null, 2);
}

export function importConfiguration(jsonString: string): Record<string, any> | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data.configurations) {
      throw new Error('Invalid configuration format');
    }
    return data.configurations;
  } catch (error) {
    logger.error('Error importing configuration:', error);
    return null;
  }
}
