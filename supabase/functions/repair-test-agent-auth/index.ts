/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: Record<string, unknown>, status = 200) =>
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
  const bytes = crypto.getRandomValues(new Uint8Array(28));
  const chars = Array.from(bytes, (b) => all[b % all.length]);
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return respond({ success: false, error: "AUTH_REQUIRED" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return respond({ success: false, error: "AUTH_REQUIRED" }, 401);

    const { data: role, error: roleError } = await userClient.rpc("current_user_role");
    if (roleError) {
      console.error("repair-test-agent-auth role check failed", roleError.message);
      return respond({ success: false, error: "ROLE_CHECK_FAILED" }, 403);
    }
    if (!["super_admin", "office_admin"].includes(String(role))) {
      return respond({ success: false, error: "FORBIDDEN", message: "Only Super Admin or Office Admin may repair a test Agent login." }, 403);
    }

    const { data: permitted, error: permissionError } = await userClient.rpc("has_erp_permission", {
      perm_code: "agent.create",
    });
    if (permissionError || permitted !== true) {
      return respond({ success: false, error: "FORBIDDEN", message: "Agent creation permission is required." }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond({ success: false, error: "INVALID_JSON" }, 400);
    }

    const agentCode = typeof body.agent_code === "string" ? body.agent_code.trim().toUpperCase() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^BNPS-AG-\d{3,}$/.test(agentCode) || !/^\S+@\S+\.\S+$/.test(email)) {
      return respond({ success: false, error: "VALIDATION_ERROR", message: "A valid existing Agent code and login email are required." }, 400);
    }

    const { data: agent, error: agentError } = await adminClient
      .from("agents")
      .select("id, agent_code, profile_id, is_test, is_active")
      .eq("agent_code", agentCode)
      .maybeSingle();

    if (agentError) {
      console.error("repair-test-agent-auth agent lookup failed", agentError.message);
      return respond({ success: false, error: "AGENT_LOOKUP_FAILED" }, 500);
    }
    if (!agent) return respond({ success: false, error: "AGENT_NOT_FOUND" }, 404);
    if (agent.is_test !== true) {
      return respond({ success: false, error: "TEST_AGENT_ONLY", message: "This repair is restricted to is_test=true Agents." }, 403);
    }
    if (agent.is_active !== true) {
      return respond({ success: false, error: "AGENT_INACTIVE", message: "Inactive test Agents cannot be repaired." }, 409);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, auth_user_id, email, full_name, phone, role, branch, is_test, is_active")
      .eq("id", agent.profile_id)
      .maybeSingle();

    if (profileError) {
      console.error("repair-test-agent-auth profile lookup failed", profileError.message);
      return respond({ success: false, error: "PROFILE_LOOKUP_FAILED" }, 500);
    }
    if (!profile || profile.role !== "agent" || profile.is_test !== true || profile.is_active !== true) {
      return respond({ success: false, error: "PROFILE_SCOPE_MISMATCH", message: "The linked active TEST Agent profile did not pass validation." }, 409);
    }
    if (profile.auth_user_id || (typeof profile.email === "string" && profile.email.trim())) {
      return respond({ success: false, error: "PROFILE_ALREADY_LINKED", message: "This profile already has an Auth ID or email. No changes were made." }, 409);
    }

    const temporaryPassword = generateTemporaryPassword();
    let createdAuthUserId: string | null = null;

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name,
        phone: profile.phone,
        branch: profile.branch,
        role: "agent",
      },
      app_metadata: { must_change_password: true },
    });

    if (createError || !created.user) {
      return respond({
        success: false,
        error: "AUTH_USER_CREATE_FAILED",
        message: createError?.message || "Supabase Auth did not return the created user.",
      }, 409);
    }
    createdAuthUserId = created.user.id;

    // Conditional update prevents overwriting a profile linked by another admin concurrently.
    const { data: linkedProfile, error: linkError } = await adminClient
      .from("profiles")
      .update({ auth_user_id: createdAuthUserId, email, updated_at: new Date().toISOString() })
      .eq("id", profile.id)
      .eq("role", "agent")
      .eq("is_test", true)
      .eq("is_active", true)
      .is("auth_user_id", null)
      .is("email", null)
      .select("id, auth_user_id, email")
      .maybeSingle();

    if (linkError || !linkedProfile) {
      // Roll back only the Auth identity created by this invocation; never touch an existing user.
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdAuthUserId);
      if (rollbackError) console.error("repair-test-agent-auth orphan cleanup failed", rollbackError.message);
      console.error("repair-test-agent-auth profile link failed", linkError?.message || "profile changed concurrently");
      return respond({
        success: false,
        error: "PROFILE_LINK_FAILED",
        message: rollbackError
          ? "Profile linking failed and Auth cleanup needs administrator review. Do not use the issued credentials."
          : "Profile linking failed; the newly created Auth account was rolled back. No credentials were issued.",
      }, 409);
    }

    console.info("repair-test-agent-auth success", {
      agent_id: agent.id,
      agent_code: agent.agent_code,
      profile_id: profile.id,
      auth_user_id: createdAuthUserId,
      actor_auth_user_id: authData.user.id,
    });

    return respond({
      success: true,
      agent_code: agent.agent_code,
      profile_id: linkedProfile.id,
      auth_user_id: linkedProfile.auth_user_id,
      login_email: linkedProfile.email,
      temporary_password: temporaryPassword,
      password_display_once: true,
      must_change_password: true,
      is_test: true,
    });
  } catch (error) {
    console.error("repair-test-agent-auth unexpected error", error instanceof Error ? error.message : "unknown");
    return respond({ success: false, error: "INTERNAL_ERROR", message: "Unexpected server error. Check Edge Function logs." }, 500);
  }
});
