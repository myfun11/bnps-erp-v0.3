/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*-_";
  const all = upper + lower + digits + symbols;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
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
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ success: false, error: "AUTH_REQUIRED" }, 401);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

    // Only users already authorized to onboard agents may issue a reset.
    const { data: allowed, error: permissionError } = await userClient.rpc("has_erp_permission", { perm_code: "agent.create" });
    if (permissionError || allowed !== true) return json({ success: false, error: "FORBIDDEN", message: "You do not have permission to reset agent credentials." }, 403);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ success: false, error: "INVALID_JSON" }, 400); }
    const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    if (!agentId) return json({ success: false, error: "VALIDATION_ERROR", message: "Agent ID is required." }, 400);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: agent, error: agentError } = await admin.from("agents").select("id,profile_id,agent_code,is_active").eq("id", agentId).maybeSingle();
    if (agentError || !agent || agent.is_active === false) return json({ success: false, error: "AGENT_NOT_FOUND", message: "Active agent record was not found." }, 404);

    const { data: profile, error: profileError } = await admin.from("profiles").select("auth_user_id,email").eq("id", agent.profile_id).maybeSingle();
    if (profileError || !profile?.auth_user_id || !profile.email) return json({ success: false, error: "AUTH_MAPPING_NOT_FOUND", message: "Agent login mapping is missing; password was not changed." }, 409);

    const { data: authLookup, error: authLookupError } = await admin.auth.admin.getUserById(profile.auth_user_id);
    if (authLookupError || !authLookup.user) return json({ success: false, error: "AUTH_MAPPING_NOT_FOUND", message: "Agent Auth account was not found; password was not changed." }, 409);

    const temporaryPassword = generateTemporaryPassword();
    const { data: authResult, error: updateError } = await admin.auth.admin.updateUserById(profile.auth_user_id, {
      password: temporaryPassword,
      app_metadata: { ...(authLookup.user.app_metadata || {}), must_change_password: true },
    });
    if (updateError || !authResult.user) return json({ success: false, error: "PASSWORD_RESET_FAILED", message: "Could not reset agent password." }, 400);

    return json({
      success: true,
      agent_code: agent.agent_code,
      login_email: profile.email,
      temporary_password: temporaryPassword,
      password_display_once: true,
      must_change_password: true,
    });
  } catch (error) {
    console.error("reset-agent-password failed:", error instanceof Error ? error.message : "unknown");
    return json({ success: false, error: "INTERNAL_ERROR", message: "Unexpected error while resetting agent password." }, 500);
  }
});
