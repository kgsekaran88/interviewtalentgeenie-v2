import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Client for auth check
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is platform_admin or partner_admin
    const { data: rolesData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = rolesData?.map(r => r.role) || [];
    if (!roles.includes('platform_admin') && !roles.includes('partner_admin')) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, fullName, organizationId, roles: userRoles } = await req.json();

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "create") {
      let userId: string;
      let passwordSetupLink: string | null = null;
      let emailSent = false;

      // Check if user already exists in auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === email);

      if (existingUser) {
        // User exists in auth, use their ID
        userId = existingUser.id;
        
        // Ensure profile exists (in case trigger failed)
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userId,
            email: email,
            full_name: fullName
          }, { onConflict: 'id' });

        if (profileError) {
          console.error("Profile upsert error:", profileError);
        }
      } else {
        // Create new user with a temporary random password
        const temporaryPassword = crypto.randomUUID();
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: false, // Don't auto-confirm, user must set password via link
          user_metadata: { full_name: fullName }
        });

        if (createError) {
          throw createError;
        }

        userId = newUser.user.id;

        // Wait longer and verify profile creation (increased from 500ms to 2000ms)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify profile was created by trigger
        const { data: profileCheck, error: profileCheckError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        
        if (!profileCheck) {
          // If trigger failed, create profile manually
          const { error: manualProfileError } = await supabaseAdmin
            .from("profiles")
            .insert({
              id: userId,
              email: email,
              full_name: fullName
            });
          
          if (manualProfileError) {
            console.error("Manual profile creation failed:", manualProfileError);
          }
        }
        
        // Send password setup email
        try {
          const emailResponse = await supabaseAdmin.functions.invoke('send-password-setup', {
            body: {
              userId,
              userEmail: email,
              userName: fullName,
              organizationId: organizationId
            }
          });

          if (emailResponse.error) {
            console.error('Error sending password setup email:', emailResponse.error);
            // Still try to get the setup URL from the error response
            passwordSetupLink = emailResponse.data?.setupUrl;
            emailSent = emailResponse.data?.emailSent || false;
          } else {
            console.log('Password setup email sent successfully');
            passwordSetupLink = emailResponse.data?.setupUrl;
            emailSent = emailResponse.data?.emailSent !== false; // Default to true if not specified
          }
        } catch (emailError) {
          console.error('Failed to send password setup email:', emailError);
          // Email failed but user was created successfully
        }
      }

      // Check if user is already a member of this organization
      const { data: existingMember } = await supabaseAdmin
        .from("organization_members")
        .select("id, status")
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingMember) {
        if (existingMember.status === 'active') {
          // User is already an active member - return success (idempotent operation)
          return new Response(JSON.stringify({ 
            success: true, 
            userId,
            alreadyMember: true 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // Reactivate inactive member
          const { error: updateError } = await supabaseAdmin
            .from("organization_members")
            .update({ status: 'active' })
            .eq("id", existingMember.id);

          if (updateError) throw updateError;
        }
      } else {
        // Add new member to organization with 'pending' status
        // Status will be changed to 'active' after password setup completion
        const { error: memberError } = await supabaseAdmin
          .from("organization_members")
          .insert({
            organization_id: organizationId,
            user_id: userId,
            status: 'pending'
          });

        if (memberError) throw memberError;
      }

      // Assign roles using upsert - all roles created by partner_admin are org-scoped
      if (userRoles && userRoles.length > 0) {
        const roleInserts = userRoles.map((role: string) => ({
          user_id: userId,
          role: role,
          organization_id: organizationId, // Partner admin created roles are always org-scoped
          created_by_role: 'partner_admin'
        }));

        // First, remove any existing roles for this user in this org that we're about to assign
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("organization_id", organizationId)
          .in("role", userRoles);

        const { error: rolesError } = await supabaseAdmin
          .from("user_roles")
          .insert(roleInserts);

        if (rolesError) throw rolesError;
      }

      // Password setup link is sent via email (in send-password-setup function)
      // No need to return it in response for security

      return new Response(JSON.stringify({ 
        success: true, 
        userId,
        message: emailSent 
          ? 'User created. Password setup email sent.'
          : 'User created. Please share the password setup link manually.',
        passwordSetupLink, // Always return if available
        emailSent // Indicate whether email was actually sent
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
