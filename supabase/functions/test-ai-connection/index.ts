import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credential_id, provider_id } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch credential and provider info
    const { data: credential, error: credError } = await supabaseClient
      .from('ai_provider_credentials')
      .select('*, providers:ai_providers(*)')
      .eq('id', credential_id)
      .single();

    if (credError || !credential) {
      throw new Error('Credential not found');
    }

    const provider = credential.providers;
    
    // Decrypt the API key
    const { data: apiKey, error: decryptError } = await supabaseClient.rpc('decrypt_api_key', {
      encrypted_key: credential.api_key_encrypted
    });

    if (decryptError || !apiKey) {
      throw new Error('Failed to decrypt API key');
    }

    let testResult = { success: false, message: '' };

    // Test based on provider type
    switch (provider.provider_type) {
      case 'google': {
        const response = await fetch(
          `${provider.base_url}/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Test connection' }] }]
            }),
          }
        );
        testResult.success = response.ok;
        testResult.message = response.ok 
          ? 'Google Gemini connection successful' 
          : `Connection failed: ${response.status}`;
        break;
      }

      case 'openai': {
        const response = await fetch(`${provider.base_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: credential.model_preference || 'gpt-5-nano',
            messages: [{ role: 'user', content: 'Test' }],
            max_completion_tokens: 10,
          }),
        });
        testResult.success = response.ok;
        testResult.message = response.ok 
          ? 'OpenAI connection successful' 
          : `Connection failed: ${response.status}`;
        break;
      }

      case 'anthropic': {
        const response = await fetch(`${provider.base_url}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: credential.model_preference || 'claude-sonnet-4-5',
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 10,
          }),
        });
        testResult.success = response.ok;
        testResult.message = response.ok 
          ? 'Claude connection successful' 
          : `Connection failed: ${response.status}`;
        break;
      }

      case 'perplexity': {
        const response = await fetch(`${provider.base_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: credential.model_preference || 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: 'Test' }],
          }),
        });
        testResult.success = response.ok;
        testResult.message = response.ok 
          ? 'Perplexity connection successful' 
          : `Connection failed: ${response.status}`;
        break;
      }

      case 'gateway': {
        const response = await fetch(`${provider.base_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Test' }],
          }),
        });
        testResult.success = response.ok;
        testResult.message = response.ok 
          ? 'AI Gateway connection successful' 
          : `Connection failed: ${response.status}`;
        break;
      }

      default:
        testResult.message = 'Unknown provider type';
    }

    // Update test status in database
    await supabaseClient
      .from('ai_provider_credentials')
      .update({
        test_status: testResult.success ? 'success' : 'failed',
        test_error: testResult.success ? null : testResult.message,
        last_tested_at: new Date().toISOString(),
      })
      .eq('id', credential_id);

    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
