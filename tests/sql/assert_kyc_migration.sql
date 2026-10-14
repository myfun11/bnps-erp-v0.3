-- Post-migration assertions run only against the disposable CI PostgreSQL database.
DO $$
DECLARE
  v_security_definer boolean;
BEGIN
  SELECT p.prosecdef INTO v_security_definer
  FROM pg_proc p
  WHERE p.oid = 'public.global_erp_search(text,integer)'::regprocedure;
  IF v_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'global_erp_search must be SECURITY INVOKER';
  END IF;
  IF has_function_privilege('anon', 'public.global_erp_search(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute global_erp_search';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.global_erp_search(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute global_erp_search';
  END IF;

  IF has_function_privilege('authenticated', 'public.get_dashboard_summary_unchecked()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute unchecked dashboard implementation';
  END IF;
  IF has_function_privilege('authenticated', 'public.generate_project_commission_atomic_unchecked(uuid,public.payment_stage_type,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute unchecked commission implementation';
  END IF;
  IF has_function_privilege('authenticated', 'public.create_lead_atomic_unchecked(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute unchecked lead creation implementation';
  END IF;

  IF has_function_privilege('anon', 'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute create_agent_atomic';
  END IF;

  IF to_regprocedure('public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric,boolean)') IS NULL THEN
    RAISE EXCEPTION 'atomic test-mode create_agent_atomic overload missing';
  END IF;
  IF has_function_privilege('anon', 'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute atomic test-mode create_agent_atomic';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute atomic test-mode create_agent_atomic';
  END IF;
  IF has_function_privilege('anon', 'public.get_agent_network(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute get_agent_network';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_agent_network(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute get_agent_network';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'documents_entity_scope_before_insert'
      AND tgrelid = 'public.documents'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'document entity-scope insert trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='father_name'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='dob'
  ) THEN
    RAISE EXCEPTION 'lead identity columns missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.set_agent_test_mode(uuid,uuid)'::regprocedure
  ) OR has_function_privilege('authenticated', 'public.set_agent_test_mode(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'test-agent mode helper missing or exposed to authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='leads_inherit_test_agent_mode'
      AND tgrelid='public.leads'::regclass AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='documents_inherit_test_mode_before_insert'
      AND tgrelid='public.documents'::regclass AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'test-mode propagation triggers missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agents' AND column_name='kyc_activation_pending'
  ) THEN
    RAISE EXCEPTION 'agent KYC activation-pending guard column missing';
  END IF;
  IF to_regprocedure('public.activate_agent_after_kyc(uuid)') IS NULL THEN
    RAISE EXCEPTION 'agent KYC activation function missing';
  END IF;
  IF has_function_privilege('authenticated', 'public.activate_agent_after_kyc(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.activate_agent_after_kyc(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'agent activation function must not be callable by browser roles';
  END IF;
  IF position('kyc_activation_pending' in pg_get_functiondef('public.evaluate_entity_kyc(text,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'KYC evaluator does not support inactive Agents pending verification';
  END IF;

  -- Unlimited-depth Agent sponsor tree invariants.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='agents_sponsor_tree_guard'
      AND tgrelid='public.agents'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Agent sponsor-tree validation trigger missing';
  END IF;

  IF position('Only Super Admin or Office Admin may create Agents'
      in pg_get_functiondef('public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric,boolean)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Agent creation RPC is missing the Admin-only role guard';
  END IF;

  -- Exercise three levels and verify the DB rejects a cycle. This runs only
  -- in the disposable CI database created by this workflow.
  INSERT INTO public.agents (id, agent_code, sponsor_agent_id, is_active)
  VALUES
    ('10000000-0000-0000-0000-000000000001', 'TEST-ROOT', NULL, true),
    ('10000000-0000-0000-0000-000000000002', 'TEST-CHILD', '10000000-0000-0000-0000-000000000001', true),
    ('10000000-0000-0000-0000-000000000003', 'TEST-GRANDCHILD', '10000000-0000-0000-0000-000000000002', true);

  IF (
    WITH RECURSIVE downline(id, depth) AS (
      SELECT id, 0 FROM public.agents
      WHERE id='10000000-0000-0000-0000-000000000001'
      UNION ALL
      SELECT child.id, parent.depth + 1
      FROM public.agents child
      JOIN downline parent ON child.sponsor_agent_id=parent.id
      WHERE parent.depth < 10
    )
    SELECT max(depth) FROM downline
  ) <> 2 THEN
    RAISE EXCEPTION 'Three-level Agent hierarchy did not persist correctly';
  END IF;

  BEGIN
    UPDATE public.agents
       SET sponsor_agent_id='10000000-0000-0000-0000-000000000003'
     WHERE id='10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Circular Agent hierarchy was not rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.agents
       SET sponsor_agent_id=id
     WHERE id='10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Self-parent Agent hierarchy was not rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF has_table_privilege('anon', 'public.agents_public_profile', 'SELECT')
     OR has_table_privilege('anon', 'public.view_pmsg_registered_customers', 'SELECT') THEN
    RAISE EXCEPTION 'anonymous access to sensitive views must be revoked';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.agents_public_profile', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.view_pmsg_registered_customers', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated access to RLS-protected views must be retained';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='agents_public_profile'
      AND coalesce(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='view_pmsg_registered_customers'
      AND coalesce(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'sensitive views must use SECURITY INVOKER';
  END IF;

  RAISE NOTICE 'KYC and test-mode migration post-conditions passed';
END;
$$;
