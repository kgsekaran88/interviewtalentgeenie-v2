/**
 * Unified AI Calling Pattern for All Edge Functions
 * 
 * This module provides a consistent interface for calling AI providers:
 * 1. Try configured provider from AI Configuration Hub
 * 2. Fall back to AI Gateway if no configuration or failure
 * 3. Log all usage WITH TOKEN COUNTS for accurate cost tracking
 * 4. Uses retry with exponential backoff and circuit breaker for resilience
 */

import { getAIConfig, logAIUsage } from "./config.ts";
import { resilientAICall } from "./ai-retry.ts";

interface AICallOptions {
  featureName: string;
  prompt: string;
  systemPrompt?: string;
  model?: string; // Optional model override - defaults to gemini-2.5-flash
  organizationId?: string;
  userId?: string;
  interviewId?: string;
}

interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

/**
 * Estimate token count from text (rough approximation)
 * Uses ~4 chars per token for English text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get default model for a feature based on cost optimization strategy
 * - Lite model (gemini-2.5-flash-lite): High-volume bulk tasks
 * - Flash model (gemini-2.5-flash): Accuracy-critical evaluations
 */
function getDefaultModelForFeature(featureName: string): string {
  // Bulk/high-volume tasks use cheaper lite model
  const bulkFeatures = [
    'question_generation',      // add-questions, generate-learning-questions
    'certification_questions',  // generate-certification-questions
    'skill_extraction',         // extract-skills
    'job_description',          // generate-job-description, enhance-job-description
    'schema_generation',        // generate-schema
    'add_questions',
    'generate_questions',
    'generate_certification_questions',
    'extract_skills',
    'generate_job_description',
    'enhance_job_description',
    'generate_schema',
  ];
  
  if (bulkFeatures.includes(featureName)) {
    return 'google/gemini-2.5-flash-lite';
  }
  
  // Accuracy-critical tasks use standard flash model
  // - evaluate-interview, coding_evaluation, descriptive_evaluation
  // - analyze-proctoring-video, bias-detection, etc.
  return 'google/gemini-2.5-flash';
}

/**
 * Call AI with configuration-first, AI Gateway fallback pattern
 * Now returns both content and tracks token usage
 */
export async function callAI(options: AICallOptions): Promise<string> {
  const { 
    featureName, 
    prompt, 
    systemPrompt = 'You are a helpful AI assistant.',
    model, // Optional model override
    organizationId,
    userId,
    interviewId
  } = options;
  
  let result: AIResponse | null = null;
  const startTime = Date.now();

  // Step 1: Try configured AI provider from database
  try {
    const aiConfig = await getAIConfig(featureName);
    
    // If we have configured AI provider with API key, use it (one try only)
    if (aiConfig?.primaryProvider?.apiKey) {
      console.log(`[${featureName}] Using configured AI provider: ${aiConfig.primaryProvider.type}`);
      
      try {
        // Use resilient call with retry and circuit breaker
        const content = await resilientAICall(
          aiConfig.primaryProvider.type,
          () => callConfiguredProvider(prompt, systemPrompt, aiConfig.primaryProvider)
        );
        
        const latencyMs = Date.now() - startTime;
        // Estimate tokens for configured providers that don't return usage
        const estimatedRequestTokens = estimateTokens(systemPrompt + prompt);
        const estimatedResponseTokens = estimateTokens(content);
        
        await logAIUsage({
          featureName,
          success: true,
          modelUsed: aiConfig.primaryProvider.model,
          requestTokens: estimatedRequestTokens,
          responseTokens: estimatedResponseTokens,
          latencyMs,
          organizationId,
          userId,
          interviewId,
        });
        
        console.log(`[${featureName}] Success with configured provider (${latencyMs}ms, ~${estimatedRequestTokens + estimatedResponseTokens} tokens)`);
        return content;
      } catch (error) {
        console.error(`[${featureName}] Configured provider failed:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        await logAIUsage({
          featureName,
          success: false,
          modelUsed: aiConfig.primaryProvider?.model,
          errorMessage: errorMessage,
          latencyMs: Date.now() - startTime,
          organizationId,
          userId,
          interviewId,
        });
        
        // Don't throw - allow fallback to AI Gateway
      }
    }
  } catch (configError) {
    console.log(`[${featureName}] No AI configuration found or config load failed`);
  }

  // Step 2: Fall back to AI Gateway if configured provider didn't work
  if (!result) {
    // Smart default model selection based on feature type
    // - Lite model for high-volume/bulk tasks (cost optimization)
    // - Flash model for accuracy-critical tasks (quality preservation)
    const effectiveModel = model || getDefaultModelForFeature(featureName);
    console.log(`[${featureName}] Using AI Gateway as fallback with model: ${effectiveModel}`);
    const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    
    if (!AI_GATEWAY_API_KEY) {
      throw new Error('No AI provider available. Please configure an AI provider in settings or ensure AI_GATEWAY_API_KEY is set.');
    }
    
    // Use resilient call for Gateway AI - now returns full response with usage
    result = await resilientAICall('gateway', () => callGatewayAIWithUsage(prompt, systemPrompt, effectiveModel));
    
    const latencyMs = Date.now() - startTime;
    const requestTokens = result.usage?.prompt_tokens || estimateTokens(systemPrompt + prompt);
    const responseTokens = result.usage?.completion_tokens || estimateTokens(result.content);
    
    await logAIUsage({
      featureName,
      success: true,
      fallbackUsed: true,
      modelUsed: effectiveModel,
      requestTokens,
      responseTokens,
      latencyMs,
      organizationId,
      userId,
      interviewId,
    });
    
    console.log(`[${featureName}] AI Gateway success (${latencyMs}ms, ${requestTokens + responseTokens} tokens)`);
  }

  return result.content;
}

/**
 * Call configured provider based on type
 */
async function callConfiguredProvider(
  prompt: string,
  systemPrompt: string,
  provider: any
): Promise<string> {
  const { type, baseUrl, model } = provider;
  // Trim whitespace from API key to handle user input errors
  const apiKey = provider.apiKey?.trim();
  
  if (type === 'gateway-ai' || type === 'openai') {
    // OpenAI-compatible format with temperature 0 for deterministic results
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0, // Deterministic output for consistent evaluations
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in response');
    }
    
    return content;
    
  } else if (type === 'google-gemini' || type === 'google') {
    // Google Gemini format with temperature 0 for deterministic results
    const response = await fetch(`${baseUrl}/v1/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0 }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content in response');
    }
    
    return content;
    
  } else {
    throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Call AI Gateway and return full response with usage data
 */
async function callGatewayAIWithUsage(prompt: string, systemPrompt: string, model: string = 'google/gemini-2.5-flash'): Promise<AIResponse> {
  const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY')?.trim();
  
  if (!AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not configured');
  }
  
  const response = await fetch(Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0, // Deterministic output for consistent evaluations
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI Gateway response');
  }
  
  // Extract usage data from response
  return {
    content,
    usage: data.usage,
    model: data.model || model,
  };
}

/**
 * Tool/Function calling interface for structured output
 */
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
}

interface AICallWithToolsOptions {
  featureName: string;
  prompt: string;
  systemPrompt?: string;
  tools: ToolDefinition[];
  toolChoice: { type: 'function'; function: { name: string } };
  organizationId?: string;
  userId?: string;
  interviewId?: string;
}

interface AIToolResponse<T> {
  result: T;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

/**
 * Call AI with tool calling for guaranteed structured output
 * Now tracks token usage properly
 */
export async function callAIWithTools<T = any>(options: AICallWithToolsOptions): Promise<T> {
  const { 
    featureName, 
    prompt, 
    systemPrompt = 'You are a helpful AI assistant.',
    tools,
    toolChoice,
    organizationId,
    userId,
    interviewId
  } = options;
  
  const startTime = Date.now();
  
  // Step 1: Try configured AI provider from database (same as callAI)
  try {
    const aiConfig = await getAIConfig(featureName);
    
    if (aiConfig?.primaryProvider?.apiKey) {
      console.log(`[${featureName}] Using configured AI provider for tool calling: ${aiConfig.primaryProvider.type}`);
      
      // For now, tool calling only works reliably with OpenAI-compatible APIs
      if (aiConfig.primaryProvider.type === 'gateway-ai' || aiConfig.primaryProvider.type === 'openai') {
        try {
          const response = await fetch(`${aiConfig.primaryProvider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${aiConfig.primaryProvider.apiKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: aiConfig.primaryProvider.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ],
              tools,
              tool_choice: toolChoice,
              temperature: 0,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall) {
              const latencyMs = Date.now() - startTime;
              const usage = data.usage;
              
              await logAIUsage({
                featureName,
                success: true,
                modelUsed: aiConfig.primaryProvider.model,
                requestTokens: usage?.prompt_tokens || estimateTokens(systemPrompt + prompt + JSON.stringify(tools)),
                responseTokens: usage?.completion_tokens || 100,
                latencyMs,
                organizationId,
                userId,
                interviewId,
              });
              
              return JSON.parse(toolCall.function.arguments) as T;
            }
          }
        } catch (error) {
          console.error(`[${featureName}] Configured provider tool call failed:`, error);
        }
      }
    }
  } catch (configError) {
    console.log(`[${featureName}] No AI configuration found for tool calling, using fallback`);
  }
  
  // Step 2: Fall back to AI Gateway with smart model selection
  const effectiveModel = getDefaultModelForFeature(featureName);
  console.log(`[${featureName}] Using AI Gateway for tool calling with model: ${effectiveModel}`);
  
  const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY')?.trim();
  
  if (!AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not configured');
  }
  
  const response = await fetch(Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: effectiveModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      tools,
      tool_choice: toolChoice,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${featureName}] Tool call error:`, response.status, errorText);
    
    await logAIUsage({
      featureName,
      success: false,
      modelUsed: effectiveModel,
      errorMessage: `${response.status}: ${errorText}`,
      latencyMs: Date.now() - startTime,
      organizationId,
      userId,
      interviewId,
    });
    
    throw new Error(`AI tool call error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  // Extract usage data
  const usage = data.usage;
  const requestTokens = usage?.prompt_tokens || estimateTokens(systemPrompt + prompt + JSON.stringify(tools));
  const responseTokens = usage?.completion_tokens || 100; // Tool calls are typically short
  
  // Extract tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    console.error(`[${featureName}] No tool call in response:`, JSON.stringify(data));
    
    await logAIUsage({
      featureName,
      success: false,
      modelUsed: data.model || effectiveModel,
      requestTokens,
      responseTokens,
      latencyMs,
      errorMessage: 'No tool call in response',
      organizationId,
      userId,
      interviewId,
    });
    
    throw new Error('No tool call in AI response');
  }
  
  try {
    const args = JSON.parse(toolCall.function.arguments);
    console.log(`[${featureName}] Tool call successful: ${toolCall.function.name} (${latencyMs}ms, ${requestTokens + responseTokens} tokens)`);
    
    await logAIUsage({
      featureName,
      success: true,
      modelUsed: data.model || effectiveModel,
      requestTokens,
      responseTokens,
      latencyMs,
      organizationId,
      userId,
      interviewId,
    });
    
    return args as T;
  } catch (parseError) {
    console.error(`[${featureName}] Failed to parse tool arguments:`, toolCall.function.arguments);
    
    await logAIUsage({
      featureName,
      success: false,
      modelUsed: data.model || 'google/gemini-2.5-flash',
      requestTokens,
      responseTokens,
      latencyMs,
      errorMessage: 'Failed to parse tool call arguments',
      organizationId,
      userId,
      interviewId,
    });
    
    throw new Error('Failed to parse tool call arguments');
  }
}
