import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { logAIUsage } from "../_shared/config.ts";

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = createLogger('generate-schema');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Schema generation request started');
    
    // Authentication - must have interview creation privileges
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, [
      'platform_admin',
      'admin',
      'partner_admin', 
      'hr_recruiter',
      'tech_spoc'
    ]);

    if (authResult.error) {
      logger.warn('Authentication failed', { error: authResult.error });
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.error.includes('required') ? 401 : 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user, supabase } = authResult;
    logger.info('User authenticated', { userId: user.id });
    
    const { jobDescription, domain } = await req.json();
    
    if (!jobDescription && !domain) {
      return new Response(
        JSON.stringify({ error: 'Job description or domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for AI Gateway API key
    const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    
    if (!AI_GATEWAY_API_KEY) {
      throw new Error('AI_GATEWAY_API_KEY not configured. Please ensure AI Gateway is enabled.');
    }
    
    console.log('Using AI Gateway for schema generation');

    // Extract domain or use provided domain
    let extractedDomain = domain;
    if (!extractedDomain && jobDescription) {
      const domainPrompt = `Extract the business domain from this job description. Return ONLY the domain name (e.g., "E-commerce", "Healthcare", "Finance", "Education", "HR", "Logistics"). Keep it to 1-2 words maximum.

Job Description:
${jobDescription}`;

      const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();

      const domainResponse = await fetch(AI_GATEWAY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-lite', // Cost-optimized: simple extraction
          messages: [{ role: 'user', content: domainPrompt }],
        }),
      });

      if (!domainResponse.ok) {
        const error = await domainResponse.text();
        console.error('Domain extraction failed:', error);
        extractedDomain = "General Business";
      } else {
        const domainData = await domainResponse.json();
        extractedDomain = domainData.choices?.[0]?.message?.content?.trim() || 'General Business';
      }
    }

    if (!extractedDomain) {
      extractedDomain = "General Business";
    }

    // Generate schema based on domain
    const schemaPrompt = `Generate a comprehensive, realistic database schema for ${extractedDomain} domain that can be used for SQL coding interview questions.

Requirements:
1. Create AT LEAST 6-8 related tables that represent core entities and relationships in ${extractedDomain}
2. Each table should have 4-7 relevant columns with appropriate data types
3. Include realistic sample data (3-5 rows per table)
4. Ensure tables have proper relationships (foreign keys, one-to-many, many-to-many)
5. Column names should be snake_case
6. Include common fields like id, created_at, updated_at where appropriate
7. Design tables to enable diverse SQL queries (joins, aggregations, subqueries)
8. Include at least one junction/association table for many-to-many relationships

Return ONLY valid JSON in this exact format:
{
  "domain": "${extractedDomain}",
  "tables": {
    "table_name": {
      "columns": ["id", "column1", "column2"],
      "description": "What this table stores",
      "sampleData": [
        {"id": 1, "column1": "value1", "column2": "value2"},
        {"id": 2, "column1": "value3", "column2": "value4"}
      ]
    }
  }
}`;

    console.log("Generating schema with AI Gateway");
    const startTime = Date.now();
    const requestTokens = estimateTokens(schemaPrompt);
    
    const schemaResponse = await fetch(AI_GATEWAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash-lite', // Cost-optimized: schema generation
        messages: [{ role: 'user', content: schemaPrompt }],
      }),
    });

    if (!schemaResponse.ok) {
      const error = await schemaResponse.text();
      console.error('Schema generation failed:', error);
      const latencyMs = Date.now() - startTime;
      
      await logAIUsage({
        featureName: 'schema_generation',
        success: false,
        modelUsed: 'gemini-2.5-flash',
        requestTokens,
        latencyMs,
        errorMessage: `Schema generation failed: ${error}`,
        userId: user.id,
      });
      
      throw new Error('Failed to generate schema');
    }

    const schemaData = await schemaResponse.json();
    const schemaContent = schemaData.choices?.[0]?.message?.content?.trim();
    const latencyMs = Date.now() - startTime;
    const responseTokens = estimateTokens(schemaContent || '');
    
    // Extract usage from API response if available, otherwise use estimates
    const usage = schemaData.usage;
    const actualRequestTokens = usage?.prompt_tokens || requestTokens;
    const actualResponseTokens = usage?.completion_tokens || responseTokens;
    
    await logAIUsage({
      featureName: 'schema_generation',
      success: true,
      modelUsed: 'gemini-2.5-flash',
      requestTokens: actualRequestTokens,
      responseTokens: actualResponseTokens,
      latencyMs,
      userId: user.id,
    });
    
    console.log(`[schema_generation] Success (${latencyMs}ms, ~${actualRequestTokens + actualResponseTokens} tokens)`);
    
    if (!schemaContent) {
      throw new Error('No schema generated');
    }

    // Clean up markdown code blocks if present
    const cleanedContent = schemaContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let schema: any;
    try {
      schema = JSON.parse(cleanedContent);
    } catch (parseError) {
      // Fallback: extract the first JSON object in the text
      const start = cleanedContent.indexOf('{');
      const end = cleanedContent.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          schema = JSON.parse(cleanedContent.slice(start, end + 1));
        } catch {
          logger.error('Failed to parse schema JSON (extracted)', { preview: cleanedContent.slice(0, 500) });
          throw new Error('AI returned invalid JSON schema');
        }
      } else {
        logger.error('Failed to parse schema JSON (no JSON found)', { preview: cleanedContent.slice(0, 500) });
        throw new Error('AI returned invalid JSON schema');
      }
    }

    return new Response(
      JSON.stringify({ 
        domain: schema.domain || extractedDomain,
        schema: schema.tables || schema
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-schema:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate schema';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
