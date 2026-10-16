/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*-_";
  const all = upper + lower + digits + symbols;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const chars = Array.from(bytes, (b) => all[b % all.length]);
  // Guarantee all required character classes, then securely shuffle.
  chars[0] = upper[bytes[0] % upper.length];
  chars[1] = lower[bytes[1] % lower.length];
  chars[2] = digits[bytes[2] % digits.length];
  chars[3] = symbols[bytes[3] % symbols.length];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error(`[create-agent:${requestId}] Stage: config_check failed - missing required Supabase environment configuration`);
      return jsonResponse({ success: false, error: "SERVER_CONFIGURATION_ERROR", message: "Agent service is not configured.", request_id: requestId }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn(`[create-agent:${requestId}] Stage: auth_verification failed - missing Authorization header`);
      return jsonResponse({ success: false, error: "AUTH_REQUIRED", message: "Authorization header is required.", request_id: requestId }, 401);
    }

    // Preserve the identity of the caller for authorization and business RPC checks.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) {
      console.warn(`[create-agent:${requestId}] Stage: auth_verification failed - caller token invalid or expired`);
      return jsonResponse({ success: false, error: "AUTH_REQUIRED", message: "Authenticated BNPS user is required.", request_id: requestId }, 401);
    }

    // Admin-only Agent creation must be checked BEFORE any service-role Auth write.
    // Do not rely on agent.create permission overrides: the business policy is stricter.
    const { data: callerRole, error: callerRoleError } = await userClient.rpc("current_user_role");
    if (callerRoleError) {
      console.error(`[create-agent:${requestId}] Stage: role_check failed:`, callerRoleError.message);
      return jsonResponse({ success: false, error: "ROLE_CHECK_FAILED", message: "Could not verify your BNPS administrator role.", request_id: requestId }, 403);
    }
    if (!["super_admin", "office_admin"].includes(String(callerRole))) {
      console.warn(`[create-agent:${requestId}] Stage: role_check forbidden - role is ${String(callerRole)}`);
      return jsonResponse({ success: false, error: "FORBIDDEN", message: "Only Super Admin or Office Admin may create Agents.", request_id: requestId }, 403);
    }

    // Exact PostgreSQL argument name is perm_code.
    const { data: permission, error: permissionError } = await userClient.rpc("has_erp_permission", {
      perm_code: "agent.create",
    });
    if (permissionError) {
      console.error(`[create-agent:${requestId}] Stage: permission_check failed:`, permissionError.message);
      return jsonResponse({ success: false, error: "PERMISSION_CHECK_FAILED", message: "Could not verify agent-creation permission.", request_id: requestId }, 403);
    }
    if (permission !== true) {
      console.warn(`[create-agent:${requestId}] Stage: permission_check forbidden - agent.create is not granted`);
      return jsonResponse({ success: false, error: "FORBIDDEN", message: "You do not have permission to recruit agents.", request_id: requestId }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      console.warn(`[create-agent:${requestId}] Stage: payload_parse failed - invalid JSON`);
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "A valid JSON request body is required.", request_id: requestId }, 400);
    }

    const is_test = body.is_test === true;

    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";
    const sponsor_agent_id = typeof body.sponsor_agent_id === "string" && body.sponsor_agent_id ? body.sponsor_agent_id : null;
    const pan_number = typeof body.pan_number === "string" ? body.pan_number.trim().toUpperCase() : null;
    const bank_account_no = typeof body.bank_account_no === "string" ? body.bank_account_no.trim() : null;
    const bank_name = typeof body.bank_name === "string" ? body.bank_name.trim() : null;
    const bank_ifsc = typeof body.bank_ifsc === "string" ? body.bank_ifsc.trim().toUpperCase() : null;
    const tds_percentage = body.tds_percentage === undefined || body.tds_percentage === null ? 5 : Number(body.tds_percentage);

    console.log(`[create-agent:${requestId}] Stage: validated_input - branch: ${branch}, is_test: ${is_test}, flow_version: ${body.credentials_flow_version}`);

    // Prevent older frontend builds from creating accounts whose one-time password they cannot display.
    if (body.credentials_flow_version !== 1) {
      return jsonResponse({
        success: false,
        error: "CLIENT_UPDATE_REQUIRED",
        message: "Please refresh/update BNPS ERP before creating an agent; the login-credentials screen is required.",
        request_id: requestId,
      }, 409);
    }
    if (!full_name || !email || !phone || !branch) {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "Name, email, mobile and branch are required.", request_id: requestId }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "A valid login email address is required.", request_id: requestId }, 400);
    }
    if (!Number.isFinite(tds_percentage) || tds_percentage < 0 || tds_percentage > 100) {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "TDS percentage must be between 0 and 100.", request_id: requestId }, 400);
    }

    // Always generate the password server-side; never trust predictable client defaults.
    const temporaryPassword = generateTemporaryPassword();
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let authUserId: string | null = null;
    let newlyCreatedAuth = false;

    // Create a usable Auth account directly. The temporary password is returned once to the authorized creator;
    // it is never written to a database table or logged. Agent must change it after first login.
    const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name, phone, branch, role: "agent" },
    });

    if (createAuthError || !createdAuth.user) {
      const errMsg = createAuthError?.message || "";
      const isAlreadyRegistered = errMsg.toLowerCase().includes("already registered") ||
                                  errMsg.toLowerCase().includes("already been registered");

      if (isAlreadyRegistered) {
        // Safe reconciliation check: is this email attached to an unlinked orphan Auth user
        // from a prior aborted atomic agent creation?
        console.warn(`[create-agent:${requestId}] Stage: auth_create found existing email; checking orphan status`);
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingAuth = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );

        if (existingAuth) {
          const { data: linkedProfile } = await adminClient
            .from("profiles")
            .select("id")
            .eq("auth_user_id", existingAuth.id)
            .maybeSingle();

          if (!linkedProfile) {
            // Found unlinked orphan Auth user without a profile. Safely reconcile by updating credentials.
            console.log(`[create-agent:${requestId}] Stage: reconciling unlinked orphan Auth user ${existingAuth.id}`);
            const { error: updateErr } = await adminClient.auth.admin.updateUserById(existingAuth.id, {
              password: temporaryPassword,
              user_metadata: { full_name, phone, branch, role: "agent" },
              app_metadata: { ...(existingAuth.app_metadata || {}), must_change_password: true },
            });
            if (!updateErr) {
              authUserId = existingAuth.id;
              newlyCreatedAuth = false; // Do not delete on rollback since it pre-existed
            }
          }
        }
      }

      if (!authUserId) {
        console.warn(`[create-agent:${requestId}] Stage: auth_create failed:`, createAuthError?.message);
        return jsonResponse({
          success: false,
          error: "AUTH_USER_CREATE_FAILED",
          message: createAuthError?.message || "Unable to create the agent login account.",
          request_id: requestId,
        }, 400);
      }
    } else {
      authUserId = createdAuth.user.id;
      newlyCreatedAuth = true;

      // First-login state belongs in server-controlled app_metadata, not user-editable user_metadata.
      const { error: appMetadataError } = await adminClient.auth.admin.updateUserById(authUserId, {
        app_metadata: { ...(createdAuth.user.app_metadata || {}), must_change_password: true },
      });
      if (appMetadataError) {
        console.error(`[create-agent:${requestId}] Stage: auth_metadata failed:`, appMetadataError.message);
        // Rollback created auth user
        await adminClient.auth.admin.deleteUser(authUserId);
        return jsonResponse({
          success: false,
          error: "AUTH_METADATA_UPDATE_FAILED",
          message: "Agent account was created but could not be secured. Do not share credentials; contact the administrator.",
          request_id: requestId,
        }, 500);
      }
    }

    // The versioned RPC applies is_test atomically with Agent/Profile creation.
    // This prevents a test-mode tagging failure from leaving an active real Agent.
    const { data: agentResult, error: agentError } = await userClient.rpc("create_agent_atomic", {
      p_auth_user_id: authUserId,
      p_full_name: full_name,
      p_email: email,
      p_phone: phone,
      p_branch: branch,
      p_sponsor_agent_id: sponsor_agent_id,
      p_pan_number: pan_number,
      p_bank_account_no: bank_account_no,
      p_bank_name: bank_name,
      p_bank_ifsc: bank_ifsc,
      p_tds_percentage: tds_percentage,
      p_is_test: is_test,
    });

    if (agentError || !agentResult?.success) {
      const errMsg = agentError?.message || agentResult?.message || agentResult?.error || "Agent profile could not be created. No agent credentials were issued.";
      console.error(`[create-agent:${requestId}] Stage: atomic_agent_creation failed:`, errMsg);
      // Rollback freshly created Auth user to ensure no orphan account is left behind
      if (newlyCreatedAuth && authUserId) {
        try {
          await adminClient.auth.admin.deleteUser(authUserId);
          console.log(`[create-agent:${requestId}] Rolled back freshly created Auth user ${authUserId}`);
        } catch (rollbackErr) {
          console.warn(`[create-agent:${requestId}] Auth rollback warning:`, rollbackErr);
        }
      }
      return jsonResponse({
        success: false,
        error: (agentResult && typeof agentResult.error === "string" ? agentResult.error : null) || "AGENT_CREATION_FAILED",
        message: errMsg,
        request_id: requestId,
      }, 400);
    }

    console.log(`[create-agent:${requestId}] Stage: completed - agent_code: ${agentResult.agent_code}, is_test: ${is_test}`);

    return jsonResponse({
      success: true,
      agent_id: agentResult.agent_id,
      profile_id: agentResult.profile_id,
      agent_code: agentResult.agent_code,
      is_test,
      auth_user_id: authUserId,
      login_email: email,
      temporary_password: temporaryPassword,
      password_display_once: true,
      invite_sent: false,
      request_id: requestId,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "unknown";
    console.error(`[create-agent:${requestId}] Stage: unexpected_exception:`, errorMsg);
    return jsonResponse({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Unexpected server error while creating the agent.",
      request_id: requestId,
    }, 500);
  }
});
