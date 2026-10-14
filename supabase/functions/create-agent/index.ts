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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("create-agent missing required Supabase environment configuration");
      return jsonResponse({ success: false, error: "SERVER_CONFIGURATION_ERROR", message: "Agent service is not configured." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "AUTH_REQUIRED", message: "Authorization header is required." }, 401);
    }

    // Preserve the identity of the caller for authorization and business RPC checks.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse({ success: false, error: "AUTH_REQUIRED", message: "Authenticated BNPS user is required." }, 401);
    }

    // Exact PostgreSQL argument name is perm_code.
    const { data: permission, error: permissionError } = await userClient.rpc("has_erp_permission", {
      perm_code: "agent.create",
    });
    if (permissionError) {
      console.error("create-agent permission check failed:", permissionError.message);
      return jsonResponse({ success: false, error: "PERMISSION_CHECK_FAILED", message: "Could not verify agent-creation permission." }, 403);
    }
    if (permission !== true) {
      return jsonResponse({ success: false, error: "FORBIDDEN", message: "You do not have permission to recruit agents." }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "A valid JSON request body is required." }, 400);
    }

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
    // Prevent older frontend builds from creating accounts whose one-time password they cannot display.
    if (body.credentials_flow_version !== 1) {
      return jsonResponse({
        success: false,
        error: "CLIENT_UPDATE_REQUIRED",
        message: "Please refresh/update BNPS ERP before creating an agent; the login-credentials screen is required.",
      }, 409);
    }
    if (!full_name || !email || !phone || !branch) {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "Name, email, mobile and branch are required." }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "A valid login email address is required." }, 400);
    }
    if (!Number.isFinite(tds_percentage) || tds_percentage < 0 || tds_percentage > 100) {
      return jsonResponse({ success: false, error: "VALIDATION_ERROR", message: "TDS percentage must be between 0 and 100." }, 400);
    }

    // Always generate the password server-side; never trust predictable client defaults.
    const temporaryPassword = generateTemporaryPassword();
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create a usable Auth account directly. The temporary password is returned once to the authorized creator;
    // it is never written to a database table or logged. Agent must change it after first login.
    const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name, phone, branch, role: "agent" },
    });
    if (createAuthError || !createdAuth.user) {
      return jsonResponse({
        success: false,
        error: "AUTH_USER_CREATE_FAILED",
        message: createAuthError?.message || "Unable to create the agent login account.",
      }, 400);
    }

    const authUserId = createdAuth.user.id;
    // First-login state belongs in server-controlled app_metadata, not user-editable user_metadata.
    const { error: appMetadataError } = await adminClient.auth.admin.updateUserById(authUserId, {
      app_metadata: { ...(createdAuth.user.app_metadata || {}), must_change_password: true },
    });
    if (appMetadataError) {
      return jsonResponse({
        success: false,
        error: "AUTH_METADATA_UPDATE_FAILED",
        message: "Agent account was created but could not be secured. Do not share credentials; contact the administrator.",
      }, 500);
    }

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
    });

    if (agentError || !agentResult?.success) {
      // Compensate Auth creation if the business transaction fails.
      // Keep the orphaned Auth identity for audited manual cleanup; never delete accounts from this recovery path.
      console.error("create-agent atomic RPC failed:", agentError?.message || "RPC returned unsuccessful result");
      return jsonResponse({
        success: false,
        error: "AGENT_CREATION_FAILED",
        message: agentError?.message || "Agent profile could not be created. No agent credentials were issued.",
      }, 400);
    }

    return jsonResponse({
      success: true,
      agent_id: agentResult.agent_id,
      profile_id: agentResult.profile_id,
      agent_code: agentResult.agent_code,
      auth_user_id: authUserId,
      login_email: email,
      temporary_password: temporaryPassword,
      password_display_once: true,
      invite_sent: false,
    });
  } catch (error) {
    console.error("create-agent unexpected error:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Unexpected server error while creating the agent.",
    }, 500);
  }
});
