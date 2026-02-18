/**
 * Configuration Management for Edge Functions
 * 
 * This module provides a unified interface for accessing all three tiers of configuration:
 * - Technical Configurations (encrypted secrets)
 * - Platform Configurations (business rules)
 * - Platform Management (operational settings)
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ============================================================================
// Configuration Keys Registry
// ============================================================================

export const CONFIG_KEYS = {
  // Technical Configuration Keys (Tier 1 - Encrypted)
  TECHNICAL: {
    GOOGLE_GEMINI_API_KEY: 'google_gemini_api_key',
    OPENAI_API_KEY: 'openai_api_key',
    AI_GATEWAY_API_KEY: 'ai_gateway_api_key',
    RESEND_API_KEY: 'resend_api_key',
    STRIPE_SECRET_KEY: 'stripe_secret_key',
    STRIPE_PUBLISHABLE_KEY: 'stripe_publishable_key',
  },
  
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
  },
  
  // Legacy keys for backward compatibility (to be migrated)
  EMAIL_PROVIDER_API_KEY: 'email_provider_api_key',
  EMAIL_FROM_ADDRESS: 'email_from_address',
  EMAIL_FROM_NAME: 'email_from_name',
  PASSWORD_SETUP_LINK_EXPIRY_HOURS: 'password_setup_link_expiry_hours',
} as const;

export type TechnicalConfigKey = typeof CONFIG_KEYS.TECHNICAL[keyof typeof CONFIG_KEYS.TECHNICAL];
export type PlatformConfigKey = typeof CONFIG_KEYS.PLATFORM[keyof typeof CONFIG_KEYS.PLATFORM];
export type ConfigKey = TechnicalConfigKey | PlatformConfigKey | typeof CONFIG_KEYS.EMAIL_PROVIDER_API_KEY | typeof CONFIG_KEYS.EMAIL_FROM_ADDRESS | typeof CONFIG_KEYS.EMAIL_FROM_NAME | typeof CONFIG_KEYS.PASSWORD_SETUP_LINK_EXPIRY_HOURS;

// ============================================================================
// AI Configuration Interface
// ============================================================================

export interface AIConfig {
  primaryProvider: {
    type: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  } | null;
  fallbackProvider: {
    type: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  } | null;
  retryAttempts: number;
  timeoutMs: number;
  fallbackEnabled: boolean;
}

// ============================================================================
// Configuration Fetchers
// ============================================================================

/**
 * Get a technical configuration (encrypted secret)
 * @param supabase Supabase client
 * @param key Configuration key
 * @param required Whether this config is required
 * @returns Decrypted value or null
 */
export async function getTechnicalConfig(
  supabase: SupabaseClient,
  key: TechnicalConfigKey,
  required: boolean = true
): Promise<string | null> {
  const { data, error } = await supabase
    .from('technical_configurations')
    .select('value_encrypted, is_active')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching technical config ${key}:`, error);
    if (required) {
      throw new Error(`Failed to fetch required technical config: ${key}`);
    }
    return null;
  }

  if (!data) {
    if (required) {
      throw new Error(`Required technical config not found: ${key}`);
    }
    return null;
  }

  // Value is already decrypted by RLS/functions
  return data.value_encrypted;
}

/**
 * Get a platform configuration (business rule)
 * @param supabase Supabase client
 * @param key Configuration key
 * @param required Whether this config is required
 * @returns Configuration value (typed based on data_type)
 */
export async function getPlatformConfig(
  supabase: SupabaseClient,
  key: PlatformConfigKey,
  required: boolean = true
): Promise<string | number | boolean | null> {
  const { data, error } = await supabase
    .from('platform_configurations')
    .select('value, data_type')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching platform config ${key}:`, error);
    if (required) {
      throw new Error(`Failed to fetch required platform config: ${key}`);
    }
    return null;
  }

  if (!data) {
    if (required) {
      throw new Error(`Required platform config not found: ${key}`);
    }
    return null;
  }

  // Type conversion based on data_type
  switch (data.data_type) {
    case 'integer':
      return parseInt(data.value, 10);
    case 'float':
      return parseFloat(data.value);
    case 'boolean':
      return data.value === 'true';
    case 'json':
      return JSON.parse(data.value);
    default:
      return data.value;
  }
}

/**
 * Get multiple platform configurations at once (legacy interface)
 * @param keys Array of configuration keys with required flag
 * @param functionName Name of calling function
 * @returns Object with configuration values
 */
export async function getConfigs(
  keys: { key: ConfigKey; required?: boolean }[],
  functionName: string
): Promise<Record<string, string | null>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const result: Record<string, string | null> = {};
  
  for (const {key, required = true} of keys) {
    try {
      // Try platform_configurations first
      const { data } = await supabase
        .from('platform_configurations')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      result[key] = data?.value || null;
      
      if (!result[key] && required) {
        throw new Error(`Required config not found: ${key}`);
      }
    } catch (error) {
      if (required) throw error;
      result[key] = null;
    }
  }

  return result;
}

/**
 * Get multiple platform configurations at once
 * @param supabase Supabase client
 * @param keys Array of configuration keys
 * @returns Object with configuration values
 */
export async function getPlatformConfigs(
  supabase: SupabaseClient,
  keys: PlatformConfigKey[]
): Promise<Record<string, string | number | boolean | null>> {
  const { data, error } = await supabase
    .from('platform_configurations')
    .select('key, value, data_type')
    .in('key', keys);

  if (error) {
    console.error('Error fetching platform configs:', error);
    throw new Error('Failed to fetch platform configurations');
  }

  const result: Record<string, string | number | boolean | null> = {};
  
  for (const config of data || []) {
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
}

/**
 * Get AI configuration for a specific feature
 * Falls back to: feature-specific → AI Gateway
 * 
 * @param featureName Name of the AI feature (e.g., 'question_generation', 'evaluation')
 * @returns AI configuration with provider details
 */
export async function getAIConfig(featureName: string): Promise<AIConfig> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[AI Config] Loading configuration for feature: ${featureName}`);

  // Step 1: Try to get configuration from database
  const { data: featureConfig, error: featureError } = await supabase
    .from('ai_feature_configurations')
    .select(`
      *,
      primary_provider:ai_providers!primary_provider_id(
        id,
        name,
        provider_type,
        base_url,
        display_name,
        supported_models
      ),
      fallback_provider:ai_providers!fallback_provider_id(
        id,
        name,
        provider_type,
        base_url,
        display_name,
        supported_models
      )
    `)
    .eq('feature_name', featureName)
    .eq('is_enabled', true)
    .maybeSingle();

  if (featureError) {
    console.error('[AI Config] Error fetching feature config:', featureError);
  }

  // Step 2: If feature config exists and has a primary provider, get credentials
  if (featureConfig && featureConfig.primary_provider_id) {
    console.log(`[AI Config] Found database config for ${featureName}, provider: ${featureConfig.primary_provider?.name}`);

    // Get primary provider credentials
    const { data: primaryCred, error: primaryCredError } = await supabase
      .from('ai_provider_credentials')
      .select('*')
      .eq('provider_id', featureConfig.primary_provider_id)
      .eq('is_active', true)
      .maybeSingle();

    if (primaryCredError) {
      console.error('[AI Config] Error fetching primary credentials:', primaryCredError);
    }

    if (primaryCred && primaryCred.api_key_encrypted) {
      try {
        // Decrypt the API key
        const { data: decryptedKey, error: decryptError } = await supabase.rpc('decrypt_api_key', {
          encrypted_key: primaryCred.api_key_encrypted
        });

        if (decryptError) {
          console.error('[AI Config] Error decrypting primary key:', decryptError);
        } else if (decryptedKey) {
          const primaryProvider = featureConfig.primary_provider as any;
          const supportedModels = Array.isArray(primaryProvider?.supported_models) 
            ? primaryProvider.supported_models 
            : [];
          
          // Use configured model preference or first supported model
          const model = primaryCred.model_preference || supportedModels[0] || 'google/gemini-2.5-flash';

          const config: AIConfig = {
            primaryProvider: {
              type: primaryProvider.provider_type,
              baseUrl: primaryProvider.base_url,
              apiKey: decryptedKey,
              model: model,
            },
            fallbackProvider: null,
            retryAttempts: featureConfig.retry_attempts || 3,
            timeoutMs: (featureConfig.timeout_seconds || 120) * 1000,
            fallbackEnabled: featureConfig.fallback_enabled || false,
          };

          // Get fallback provider if configured
          if (featureConfig.fallback_enabled && featureConfig.fallback_provider_id) {
            const { data: fallbackCred, error: fallbackCredError } = await supabase
              .from('ai_provider_credentials')
              .select('*')
              .eq('provider_id', featureConfig.fallback_provider_id)
              .eq('is_active', true)
              .maybeSingle();

            if (fallbackCred && !fallbackCredError) {
              const { data: decryptedFallbackKey, error: fallbackDecryptError } = await supabase.rpc('decrypt_api_key', {
                encrypted_key: fallbackCred.api_key_encrypted
              });

              if (decryptedFallbackKey && !fallbackDecryptError) {
                const fallbackProvider = featureConfig.fallback_provider as any;
                const fallbackModels = Array.isArray(fallbackProvider?.supported_models) 
                  ? fallbackProvider.supported_models 
                  : [];
                const fallbackModel = fallbackCred.model_preference || fallbackModels[0] || 'google/gemini-2.5-flash';

                config.fallbackProvider = {
                  type: fallbackProvider.provider_type,
                  baseUrl: fallbackProvider.base_url,
                  apiKey: decryptedFallbackKey,
                  model: fallbackModel,
                };
                console.log(`[AI Config] Fallback provider configured: ${fallbackProvider.name}`);
              }
            }
          }

          console.log(`[AI Config] Successfully loaded database config for ${featureName}`);
          return config;
        }
      } catch (error) {
        console.error('[AI Config] Error processing credentials:', error);
      }
    }
  }

  // Step 3: Fall back to environment variables
  console.log(`[AI Config] No database config found, falling back to environment variables`);
  
  const gatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');
  if (gatewayApiKey) {
    console.log('[AI Config] Using AI_GATEWAY_API_KEY from environment');
    return {
      primaryProvider: {
        type: 'gateway-ai',
        baseUrl: Deno.env.get('AI_GATEWAY_URL') || '',
        apiKey: gatewayApiKey,
        model: 'google/gemini-2.5-flash',
      },
      fallbackProvider: null,
      retryAttempts: 3,
      timeoutMs: 120000,
      fallbackEnabled: false,
    };
  }

  const geminiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
  if (geminiKey) {
    console.log('[AI Config] Using GOOGLE_GEMINI_API_KEY from environment');
    return {
      primaryProvider: {
        type: 'google-gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: geminiKey,
        model: 'gemini-2.5-flash',
      },
      fallbackProvider: null,
      retryAttempts: 3,
      timeoutMs: 120000,
      fallbackEnabled: false,
    };
  }

  throw new Error('No AI provider configured. Please add API credentials in AI Configuration settings or set environment variables.');
}

/**
 * Log AI usage for analytics with organization tracking
 * @param params Usage parameters including organization context
 */
export async function logAIUsage(params: {
  featureName: string;
  providerId?: string;
  modelUsed?: string;
  requestTokens?: number;
  responseTokens?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  fallbackUsed?: boolean;
  organizationId?: string;
  userId?: string;
  interviewId?: string;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate that providerId is a valid UUID before inserting (it references ai_providers table)
    const isValidUUID = params.providerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.providerId);
    
    await supabase.from('ai_usage_logs').insert({
      feature_name: params.featureName,
      provider_id: isValidUUID ? params.providerId : null,
      model_used: params.modelUsed,
      request_tokens: params.requestTokens,
      response_tokens: params.responseTokens,
      latency_ms: params.latencyMs,
      success: params.success,
      error_message: params.errorMessage,
      fallback_used: params.fallbackUsed,
      organization_id: params.organizationId,
      user_id: params.userId,
      interview_id: params.interviewId,
    });

    // Update last_used_at for the feature configuration
    if (params.success) {
      await supabase
        .from('platform_configurations')
        .update({ updated_at: new Date().toISOString() })
        .eq('key', `ai_${params.featureName}_model`);
    }
  } catch (error) {
    console.error('Failed to log AI usage:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

/**
 * Get platform management config (scoped settings)
 * @param supabase Supabase client
 * @param key Configuration key
 * @param scope Scope type
 * @param scopeId Scope ID (organization_id or user_id)
 * @returns Configuration value as JSONB
 */
export async function getManagementConfig(
  supabase: SupabaseClient,
  key: string,
  scope: 'global' | 'organization' | 'user',
  scopeId?: string
): Promise<any | null> {
  const query = supabase
    .from('platform_management')
    .select('value')
    .eq('key', key)
    .eq('scope', scope)
    .eq('is_active', true);

  if (scopeId) {
    query.eq('scope_id', scopeId);
  } else {
    query.is('scope_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`Error fetching management config ${key}:`, error);
    return null;
  }

  return data?.value || null;
}
