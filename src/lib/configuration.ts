/**
 * Frontend Configuration Management
 * 
 * Provides a unified interface for accessing platform configurations
 * from the frontend. Only exposes non-sensitive tier 2 and tier 3 configs.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// Configuration Keys Registry
// ============================================================================

export const CONFIG_KEYS = {
  // Platform Configuration Keys (Tier 2 - Business Rules)
  PLATFORM: {
    // Proctoring
    PROCTORING_VIOLATION_THRESHOLD: 'proctoring_violation_threshold',
    PROCTORING_AUTO_SUBMIT: 'proctoring_auto_submit',
    PROCTORING_MIN_INTEGRITY_SCORE: 'proctoring_min_integrity_score',
    PROCTORING_MAX_TAB_SWITCHES: 'proctoring_max_tab_switches',
    PROCTORING_MAX_LOOK_AWAYS: 'proctoring_max_look_aways',
    PROCTORING_RECORDING_ENABLED: 'proctoring_recording_enabled',
    
    // AI Features
    AI_QUESTION_GENERATION_MODEL: 'ai_question_generation_model',
    AI_EVALUATION_MODEL: 'ai_evaluation_model',
    AI_BIAS_DETECTION_MODEL: 'ai_bias_detection_model',
    AI_GENERATION_TIMEOUT: 'ai_generation_timeout_seconds',
    AI_EVALUATION_TIMEOUT: 'ai_evaluation_timeout_seconds',
    AI_FALLBACK_ENABLED: 'ai_fallback_enabled',
    AI_MAX_RETRY_ATTEMPTS: 'ai_max_retry_attempts',
    
    // Interview Rules
    INTERVIEW_DIFFICULTY_EASY: 'interview_difficulty_easy_percentage',
    INTERVIEW_DIFFICULTY_MEDIUM: 'interview_difficulty_medium_percentage',
    INTERVIEW_DIFFICULTY_HARD: 'interview_difficulty_hard_percentage',
    CPI_TECHNICAL_WEIGHT: 'cpi_technical_weight',
    CPI_PROBLEM_SOLVING_WEIGHT: 'cpi_problem_solving_weight',
    CPI_INTEGRITY_WEIGHT: 'cpi_integrity_weight',
    
    // Certification
    CERTIFICATION_PASSING_SCORE: 'certification_passing_score',
    CERTIFICATION_VALIDITY_DAYS: 'certification_validity_days',
    CERTIFICATION_RETRY_COOLDOWN: 'certification_retry_cooldown_hours',
    
    // Retention
    RETENTION_RECORDING_DAYS: 'retention_recording_days',
    RETENTION_ATTEMPT_DATA_DAYS: 'retention_attempt_data_days',
    RETENTION_AUTO_CLEANUP: 'retention_auto_cleanup_enabled',
    
    // Chatbot
    CHATBOT_ENABLED: 'chatbot_enabled',
    CHATBOT_MAX_CONTEXT: 'chatbot_max_context_messages',
    CHATBOT_TIMEOUT: 'chatbot_response_timeout_seconds',
  }
} as const;

export type PlatformConfigKey = typeof CONFIG_KEYS.PLATFORM[keyof typeof CONFIG_KEYS.PLATFORM];

// ============================================================================
// Configuration Interface
// ============================================================================

export interface PlatformConfig {
  key: string;
  value: string;
  dataType: 'string' | 'integer' | 'boolean' | 'json' | 'float';
  category: string;
  subcategory?: string;
  description?: string;
  isEditable: boolean;
  validationRules?: any;
  displayOrder: number;
  uiComponent?: string;
}

// ============================================================================
// Configuration Fetchers
// ============================================================================

/**
 * Get a single platform configuration
 * @param key Configuration key
 * @param required Whether this config is required
 * @returns Typed configuration value
 */
export async function getPlatformConfig<T = string | number | boolean>(
  key: PlatformConfigKey,
  required: boolean = true
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('platform_configurations' as any)
      .select('value, data_type')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      logger.error(`Error fetching config ${key}:`, error);
      if (required) {
        throw new Error(`Configuration Error: Failed to fetch "${key}"`);
      }
      return null;
    }

    if (!data) {
      if (required) {
        throw new Error(`Configuration Missing: "${key}" is not configured`);
      }
      return null;
    }

    // Type conversion based on data_type
    let value: any = (data as any).value;
    
    switch ((data as any).data_type) {
      case 'integer':
        value = parseInt((data as any).value, 10);
        break;
      case 'float':
        value = parseFloat((data as any).value);
        break;
      case 'boolean':
        value = (data as any).value === 'true';
        break;
      case 'json':
        value = JSON.parse((data as any).value);
        break;
    }

    return value as T;
  } catch (error) {
    logger.error(`Configuration error for ${key}:`, error);
    throw error;
  }
}

/**
 * Get multiple platform configurations at once
 * @param keys Array of configuration keys
 * @returns Object with configuration values
 */
export async function getPlatformConfigs(
  keys: PlatformConfigKey[]
): Promise<Record<string, string | number | boolean | null>> {
  try {
    const { data, error } = await supabase
      .from('platform_configurations' as any)
      .select('key, value, data_type')
      .in('key', keys);

    if (error) {
      logger.error('Error fetching configs:', error);
      throw new Error('Configuration Error: Failed to fetch configurations');
    }

    const result: Record<string, string | number | boolean | null> = {};

    for (const config of (data || []) as any[]) {
      let value: string | number | boolean | null = config.value;

      switch (config.data_type) {
        case 'integer':
          value = parseInt(config.value, 10);
          break;
        case 'float':
          value = parseFloat(config.value);
          break;
        case 'boolean':
          value = config.value === 'true';
          break;
        case 'json':
          value = JSON.parse(config.value);
          break;
      }

      result[config.key] = value;
    }

    return result;
  } catch (error) {
    logger.error('Configuration error:', error);
    throw error;
  }
}

/**
 * Get all configurations by category
 * @param category Configuration category
 * @returns Array of configurations
 */
export async function getConfigsByCategory(
  category: string
): Promise<PlatformConfig[]> {
  try {
    const { data, error } = await supabase
      .from('platform_configurations' as any)
      .select('*')
      .eq('category', category);

    if (error) {
      logger.error(`Error fetching configs for category ${category}:`, error);
      throw new Error(`Failed to fetch configurations for category: ${category}`);
    }

    return ((data || []) as any[]).map((row: any) => ({
      key: row.key,
      value: row.value,
      dataType: row.data_type as any,
      category: row.category,
      subcategory: row.subcategory,
      description: row.description,
      isEditable: row.is_editable,
      validationRules: row.validation_rules,
      displayOrder: row.display_order,
      uiComponent: row.ui_component,
    }));
  } catch (error) {
    logger.error(`Configuration error for category ${category}:`, error);
    throw error;
  }
}

/**
 * Update a platform configuration
 * @param key Configuration key
 * @param value New configuration value
 */
export async function updatePlatformConfig(
  key: PlatformConfigKey,
  value: string | number | boolean
): Promise<void> {
  try {
    // Convert value to string for storage
    const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);

    const { error } = await supabase
      .from('platform_configurations' as any)
      .update({
        value: stringValue,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      logger.error(`Error updating config ${key}:`, error);
      throw new Error(`Failed to update configuration: ${key}`);
    }
  } catch (error) {
    logger.error(`Configuration update error for ${key}:`, error);
    throw error;
  }
}

/**
 * Batch update multiple platform configurations
 * @param updates Object with key-value pairs to update
 */
export async function updatePlatformConfigs(
  updates: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const promises = Object.entries(updates).map(([key, value]) =>
      updatePlatformConfig(key as PlatformConfigKey, value)
    );

    await Promise.all(promises);
  } catch (error) {
    logger.error('Batch configuration update error:', error);
    throw error;
  }
}

/**
 * Get platform management config (scoped settings)
 * @param key Configuration key
 * @param scope Scope type
 * @param scopeId Scope ID (organization_id or user_id)
 * @returns Configuration value as JSONB
 */
export async function getManagementConfig(
  key: string,
  scope: 'global' | 'organization' | 'user',
  scopeId?: string
): Promise<any | null> {
  try {
    let query = supabase
      .from('platform_management' as any)
      .select('value')
      .eq('key', key)
      .eq('scope', scope)
      .eq('is_active', true);

    if (scopeId) {
      query = query.eq('scope_id', scopeId);
    } else {
      query = query.is('scope_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error(`Error fetching management config ${key}:`, error);
      return null;
    }

    return (data as any)?.value || null;
  } catch (error) {
    logger.error(`Management configuration error for ${key}:`, error);
    return null;
  }
}

/**
 * Validate configuration value against rules
 * @param config Configuration object with validation rules
 * @param value Value to validate
 * @returns Validation result
 */
export function validateConfigValue(
  config: PlatformConfig,
  value: any
): { valid: boolean; error?: string } {
  if (!config.validationRules) {
    return { valid: true };
  }

  const rules = config.validationRules;

  // Type validation
  switch (config.dataType) {
    case 'integer':
      if (!Number.isInteger(Number(value))) {
        return { valid: false, error: 'Value must be an integer' };
      }
      break;
    case 'float':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Value must be a number' };
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return { valid: false, error: 'Value must be true or false' };
      }
      break;
  }

  // Range validation
  if (rules.min !== undefined && Number(value) < rules.min) {
    return { valid: false, error: `Value must be at least ${rules.min}` };
  }
  if (rules.max !== undefined && Number(value) > rules.max) {
    return { valid: false, error: `Value must be at most ${rules.max}` };
  }

  // Allowed values validation
  if (rules.allowed_values && !rules.allowed_values.includes(value)) {
    return { valid: false, error: `Value must be one of: ${rules.allowed_values.join(', ')}` };
  }

  // Regex validation
  if (rules.regex && !new RegExp(rules.regex).test(String(value))) {
    return { valid: false, error: 'Value format is invalid' };
  }

  return { valid: true };
}
