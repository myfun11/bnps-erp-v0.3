import { withSupabase } from 'npm:@supabase/server@^1';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const body = await req.json();
      const { email, password, full_name, phone, branch, sponsor_agent_id, pan_number, bank_account_no, bank_name, bank_ifsc, tds_percentage } = body;

      if (!email || !password || !full_name || !phone) {
        return Response.json({ error: 'VALIDATION_ERROR: Name, email, phone and password are required' }, { status: 400 });
      }

      const { data: actor, error: actorError } = await ctx.supabase
        .from('profiles')
        .select('id, role, is_active')
        .eq('auth_user_id', ctx.userClaims?.sub)
        .maybeSingle();

      if (actorError || !actor?.is_active || !['super_admin', 'office_admin', 'branch_manager'].includes(actor.role)) {
        return Response.json({ error: 'INSUFFICIENT_PERMISSION: Agent onboarding requires authorized management role' }, { status: 403 });
      }

      const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'agent', full_name },
      });

      if (createError || !created.user) {
        return Response.json({ error: createError?.message || 'Unable to create Auth user' }, { status: 400 });
      }

      const { data: result, error: rpcError } = await ctx.supabase.rpc('create_agent_atomic', {
        p_auth_user_id: created.user.id,
        p_full_name: full_name,
        p_phone: phone,
        p_email: email,
        p_branch: branch,
        p_sponsor_agent_id: sponsor_agent_id || null,
        p_pan_number: pan_number || null,
        p_bank_account_no: bank_account_no || null,
        p_bank_name: bank_name || null,
        p_bank_ifsc: bank_ifsc || null,
        p_tds_percentage: Number(tds_percentage ?? 5),
      });

      if (rpcError) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(created.user.id);
        return Response.json({ error: rpcError.message }, { status: 400 });
      }

      return Response.json({ success: true, agent: result });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Agent onboarding failed' }, { status: 400 });
    }
  }),
};