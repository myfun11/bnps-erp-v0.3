import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const passwordCheckClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

  // app_metadata is server-controlled. Never accept a browser-supplied user id or role.
  if (user.app_metadata?.must_change_password !== true) {
    return json({ success: false, error: "PASSWORD_CHANGE_NOT_REQUIRED" }, 409);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "INVALID_JSON" }, 400);
  }
  const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  if (!currentPassword || !user.email || newPassword === currentPassword) {
    return json({ success: false, error: "CURRENT_PASSWORD_REQUIRED_OR_REUSED", message: "Enter the current temporary password and choose a different new password." }, 400);
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    return json({ success: false, error: "PASSWORD_POLICY", message: "Password must be 12 to 128 characters." }, 400);
  }
  if (/^[\s]+$/.test(newPassword)) {
    return json({ success: false, error: "PASSWORD_POLICY" }, 400);
  }

  const { data: passwordCheck, error: passwordCheckError } = await passwordCheckClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (passwordCheckError || passwordCheck.user?.id !== user.id) {
    return json({ success: false, error: "CURRENT_PASSWORD_INVALID", message: "Current temporary password is incorrect." }, 401);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
    app_metadata: {
      ...(user.app_metadata || {}),
      must_change_password: false,
    },
  });
  if (updateError) {
    return json({ success: false, error: "PASSWORD_UPDATE_FAILED", message: "Password could not be changed. Please retry." }, 400);
  }

  return json({ success: true, message: "Password updated. You may now access BNPS ERP." });
});
