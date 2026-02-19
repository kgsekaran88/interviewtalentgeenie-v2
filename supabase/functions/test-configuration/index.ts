import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAIConfig } from "../_shared/config.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { testType, payload } = body;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: any = { success: false, message: '' };

    switch (testType) {
      case 'ai_connectivity':
        result = await testAIConnectivity();
        break;
      case 'database':
        result = await testDatabaseConnection(supabase);
        break;
      case 'storage':
        result = await testStorageAccess(supabase);
        break;
      case 'bandwidth':
        result = await testBandwidth(payload);
        break;
      default:
        result = { success: false, message: 'Unknown test type' };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Test configuration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function testAIConnectivity(): Promise<any> {
  try {
    const aiConfig = await getAIConfig('question_generation');
    
    if (!aiConfig?.primaryProvider) {
      return {
        success: false,
        message: 'No AI provider configured',
        details: 'Please configure AI Gateway or Google Gemini',
      };
    }

    const startTime = Date.now();
    const response = await fetch(
      `${aiConfig.primaryProvider.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.primaryProvider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.primaryProvider.model,
          messages: [{ role: 'user', content: 'Test connectivity' }],
          max_tokens: 10,
        }),
      }
    );
    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        message: `AI provider error: ${response.status}`,
        details: await response.text(),
      };
    }

    return {
      success: true,
      message: 'AI connectivity test passed',
      details: {
        provider: aiConfig.primaryProvider.type,
        model: aiConfig.primaryProvider.model,
        latency: `${latency}ms`,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'AI connectivity test failed',
      details: errorMessage,
    };
  }
}

async function testDatabaseConnection(supabase: any): Promise<any> {
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('platform_configurations')
      .select('count')
      .limit(1);
    const latency = Date.now() - startTime;

    if (error) {
      return {
        success: false,
        message: 'Database connection failed',
        details: error.message,
      };
    }

    return {
      success: true,
      message: 'Database connection test passed',
      details: {
        latency: `${latency}ms`,
        status: 'Connected',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Database test failed',
      details: errorMessage,
    };
  }
}

async function testStorageAccess(supabase: any): Promise<any> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      return {
        success: false,
        message: 'Storage access failed',
        details: error.message,
      };
    }

    return {
      success: true,
      message: 'Storage access test passed',
      details: {
        bucketsFound: buckets?.length || 0,
        status: 'Connected',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Storage test failed',
      details: errorMessage,
    };
  }
}

async function testBandwidth(payload?: string): Promise<any> {
  console.log('[Bandwidth Test] Starting bandwidth test');
  try {
    // Calculate payload size using string length (works in Deno)
    const payloadSize = payload ? new TextEncoder().encode(payload).length : 0;
    
    console.log(`[Bandwidth Test] Received payload of ${payloadSize} bytes`);
    
    return {
      success: true,
      message: 'Bandwidth test completed',
      details: {
        payloadSizeBytes: payloadSize,
        receivedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[Bandwidth Test] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Bandwidth test failed',
      details: errorMessage,
    };
  }
}
