import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Certificate PDF generation request started');
    
    // SECURITY FIX: Require authentication
    const authHeader = req.headers.get('Authorization');
    const { user, supabase, error: authError } = await authenticateRequest(authHeader);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError || 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated for certificate PDF', { userId: user.id });

    const { certificateId } = await req.json();

    // Fetch certificate with user and topic details
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .select(`
        *,
        certification_topics (
          display_name,
          provider,
          difficulty_level
        ),
        profiles!certificates_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq('id', certificateId)
      .single();

    if (certError || !certificate) {
      return new Response(
        JSON.stringify({ error: 'Certificate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization check: User must own the certificate OR be an admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isOwner = certificate.user_id === user.id;
    const hasAdminAccess = userRoles?.some((r: any) => ['platform_admin'].includes(r.role));

    if (!isOwner && !hasAdminAccess) {
      console.warn('Unauthorized certificate PDF access attempt', { userId: user.id, certificateId });
      return new Response(
        JSON.stringify({ error: 'You do not have permission to access this certificate' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authorization verified for certificate PDF', { isOwner, hasAdminAccess });

    const certificateUser = certificate.profiles;
    const topic = certificate.certification_topics;

    // Generate HTML certificate
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4 landscape; margin: 0; }
    body { 
      margin: 0; 
      padding: 40px;
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .certificate {
      background: white;
      padding: 60px;
      border-radius: 20px;
      box-shadow: 0 10px 50px rgba(0,0,0,0.3);
      max-width: 900px;
      position: relative;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #667eea;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    .title {
      font-size: 48px;
      font-weight: bold;
      color: #333;
      margin: 20px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .subtitle {
      font-size: 20px;
      color: #666;
      margin-bottom: 30px;
    }
    .recipient {
      text-align: center;
      margin: 40px 0;
    }
    .name {
      font-size: 42px;
      font-weight: bold;
      color: #667eea;
      margin: 20px 0;
      padding: 10px 0;
      border-bottom: 2px solid #667eea;
      display: inline-block;
    }
    .achievement {
      font-size: 18px;
      line-height: 1.8;
      color: #444;
      text-align: center;
      margin: 30px 0;
    }
    .certification-name {
      font-size: 28px;
      font-weight: bold;
      color: #764ba2;
      margin: 20px 0;
    }
    .details {
      display: flex;
      justify-content: space-around;
      margin: 40px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }
    .detail-item {
      text-align: center;
    }
    .detail-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .detail-value {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      margin-top: 5px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #667eea;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .verification {
      font-size: 12px;
      color: #666;
    }
    .verification-code {
      font-weight: bold;
      color: #667eea;
      font-family: monospace;
    }
    .seal {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">Interview AI</div>
      <div class="title">Certificate of Achievement</div>
      <div class="subtitle">Professional Certification</div>
    </div>

    <div class="recipient">
      <div style="font-size: 18px; color: #666;">This certifies that</div>
      <div class="name">${certificateUser.full_name}</div>
      <div style="font-size: 16px; color: #666; margin-top: 10px;">${certificateUser.email}</div>
    </div>

    <div class="achievement">
      has successfully completed the requirements and demonstrated proficiency in
    </div>

    <div class="certification-name">
      ${topic.display_name}
    </div>

    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Provider</div>
        <div class="detail-value">${topic.provider.toUpperCase()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Score</div>
        <div class="detail-value">${certificate.score}%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Integrity Score</div>
        <div class="detail-value">${certificate.integrity_score}/100</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Level</div>
        <div class="detail-value">${topic.difficulty_level}</div>
      </div>
    </div>

    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Certificate Number</div>
        <div class="detail-value">${certificate.certificate_number}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Issued Date</div>
        <div class="detail-value">${new Date(certificate.issued_at).toLocaleDateString()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Expires Date</div>
        <div class="detail-value">${new Date(certificate.expires_at).toLocaleDateString()}</div>
      </div>
    </div>

    <div class="footer">
      <div class="verification">
        <div>Verify this certificate at:</div>
        <div class="verification-code">${certificate.verification_code}</div>
        <div style="margin-top: 5px; font-size: 10px;">
          ${certificate.public_verification_url}
        </div>
      </div>
      <div class="seal">
        VERIFIED<br/>AUTHENTIC
      </div>
    </div>
  </div>
</body>
</html>`;

    // Return HTML for client-side PDF generation
    return new Response(
      JSON.stringify({ 
        success: true,
        html,
        certificateNumber: certificate.certificate_number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-certificate-pdf:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});