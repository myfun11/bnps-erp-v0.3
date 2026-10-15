-- Disposable PostgreSQL runtime assertions for migration 20.
-- Uses only synthetic rows and rolls them back before the CI job ends.
-- Override only the legacy permission dependency AFTER the migration files have run:
-- the actual live legacy RPC body is exercised, while the test explicitly models
-- its external agent.create authorization dependency for synthetic Admin profiles.
CREATE OR REPLACE FUNCTION public.has_erp_permission(perm_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $testdep$
  SELECT perm_code = 'agent.create'
     AND public.current_user_role() IN ('super_admin','office_admin')
$testdep$;

BEGIN;

DO $$
DECLARE
  v_root uuid := gen_random_uuid();
  v_child uuid := gen_random_uuid();
  v_grandchild uuid := gen_random_uuid();
  v_chain uuid[] := ARRAY[]::uuid[];
  v_parent uuid;
  v_node uuid;
  v_i integer;
  v_depth integer;
  v_rejected boolean;
  v_error text;
  v_def text;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='agents_sponsor_tree_guard'
      AND tgrelid='public.agents'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'agents_sponsor_tree_guard trigger is missing';
  END IF;

  INSERT INTO public.agents(id, agent_code, sponsor_agent_id, is_active)
  VALUES (v_root, 'HIER-ROOT', NULL, true);

  INSERT INTO public.agents(id, agent_code, sponsor_agent_id, is_active)
  VALUES (v_child, 'HIER-CHILD', v_root, true);

  INSERT INTO public.agents(id, agent_code, sponsor_agent_id, is_active)
  VALUES (v_grandchild, 'HIER-GRANDCHILD', v_child, true);

  -- Prove unlimited sponsor depth while retaining the live 1..10 hierarchy_level
  -- constraint. hierarchy_level is not a sponsor-depth counter.
  v_parent := v_grandchild;
  FOR v_i IN 4..12 LOOP
    v_node := gen_random_uuid();
    INSERT INTO public.agents(id, agent_code, sponsor_agent_id, hierarchy_level, is_active)
    VALUES (v_node, 'HIER-DEEP-' || v_i::text, v_parent, 10, true);
    v_chain := array_append(v_chain, v_node);
    v_parent := v_node;
  END LOOP;

  WITH RECURSIVE descendants(id, depth, path) AS (
    SELECT a.id, 1, ARRAY[a.id]
      FROM public.agents a
     WHERE a.id=v_root
    UNION ALL
    SELECT child.id, parent.depth+1, parent.path || child.id
      FROM descendants parent
      JOIN public.agents child ON child.sponsor_agent_id=parent.id
     WHERE NOT child.id=ANY(parent.path)
  )
  SELECT max(depth) INTO v_depth
    FROM descendants
   WHERE id = v_parent;

  IF v_depth IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'Hierarchy deeper than 10 levels failed; expected 12, observed depth %', v_depth;
  END IF;

  -- Existing check constraint must still reject an invalid commission-tier value.
  v_rejected := false;
  BEGIN
    UPDATE public.agents SET hierarchy_level=11 WHERE id=v_root;
  EXCEPTION WHEN check_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Legacy hierarchy_level 1..10 constraint was not preserved';
  END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.agents SET sponsor_agent_id=v_root WHERE id=v_root;
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := position('AGENT_HIERARCHY_SELF_PARENT' in v_error) > 0;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Self-parent assignment was not rejected with the expected guard';
  END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.agents SET sponsor_agent_id=v_grandchild WHERE id=v_root;
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := position('AGENT_HIERARCHY_CYCLE' in v_error) > 0;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Circular parent assignment was not rejected with the expected guard';
  END IF;

  SELECT pg_get_functiondef(
    'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric,boolean)'::regprocedure
  ) INTO v_def;

  IF position('current_user_role()' in v_def)=0
     OR position('super_admin' in v_def)=0
     OR position('office_admin' in v_def)=0
     OR position('FORBIDDEN' in v_def)=0 THEN
    RAISE EXCEPTION '12-argument Agent RPC does not enforce a fail-closed Admin-only creation rule';
  END IF;

  -- The trigger must serialize sponsor-edge changes before reading ancestors;
  -- the ordinary single-session cycle assertions alone do not prove race safety.
  SELECT pg_get_functiondef(
    'public.enforce_agent_sponsor_tree()'::regprocedure
  ) INTO v_def;
  IF position('pg_advisory_xact_lock' in v_def)=0
     OR position('bnps-agent-sponsor-tree-guard' in v_def)=0 THEN
    RAISE EXCEPTION 'Sponsor-tree trigger is missing the transaction-scoped concurrency lock';
  END IF;

  IF has_function_privilege('authenticated',
       'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric)'::regprocedure,
       'EXECUTE') THEN
    RAISE EXCEPTION 'Legacy 11-argument RPC is directly executable by authenticated';
  END IF;
  IF NOT has_function_privilege('service_role',
       'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric)'::regprocedure,
       'EXECUTE') THEN
    RAISE EXCEPTION 'Legacy 11-argument RPC lost trusted service_role compatibility';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.create_agent_atomic(uuid,text,citext,character varying,character varying,uuid,character varying,text,text,character varying,numeric,boolean)'::regprocedure,
       'EXECUTE') THEN
    RAISE EXCEPTION '12-argument wrapper is not executable by authenticated';
  END IF;

  -- Exercise the RPC guard using synthetic JWT identities, not just function text.
  INSERT INTO public.profiles(id, auth_user_id, role, is_active)
  VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'super_admin', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'agent', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', NULL, true);

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  v_result := public.create_agent_atomic('10000000-0000-0000-0000-000000000011',
    'Synthetic Admin', 'admin-test@example.com'::citext,
    '1111111111', 'Jaijaipur', NULL, NULL, NULL, NULL, NULL, 5, false);
  IF coalesce((v_result->>'success')::boolean, false) IS NOT TRUE
     OR (v_result->>'agent_id') IS NULL OR (v_result->>'profile_id') IS NULL THEN
    RAISE EXCEPTION 'Admin RPC did not complete the legacy delegate path: %', v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.agents
     WHERE id=(v_result->>'agent_id')::uuid
       AND profile_id=(v_result->>'profile_id')::uuid
       AND is_active=false
       AND coalesce(kyc_activation_pending, false)=true
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id=(v_result->>'profile_id')::uuid
       AND role='agent' AND is_active=false
  ) THEN
    RAISE EXCEPTION 'Admin-created real Agent was not held inactive pending KYC';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  v_rejected := false;
  BEGIN
    PERFORM public.create_agent_atomic('10000000-0000-0000-0000-000000000012', 'Synthetic Agent', 'agent-test@example.com'::citext,
      '2222222222', 'Jaijaipur', NULL, NULL, NULL, NULL, NULL, 5, false);
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := position('FORBIDDEN' in v_error) > 0;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Non-admin Agent creation was not denied'; END IF;

  -- Test mode is not an authorization bypass: the same non-admin must be rejected.
  v_rejected := false;
  BEGIN
    PERFORM public.create_agent_atomic('10000000-0000-0000-0000-000000000013', 'Synthetic Test Agent', 'agent-test-mode@example.com'::citext,
      '2222222223', 'Jaijaipur', NULL, NULL, NULL, NULL, NULL, 5, true);
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := position('FORBIDDEN' in v_error) > 0;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Non-admin TEST Agent creation was not denied'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
  v_rejected := false;
  BEGIN
    PERFORM public.create_agent_atomic('10000000-0000-0000-0000-000000000014', 'Synthetic Null Role', 'null-role@example.com'::citext,
      '3333333333', 'Jaijaipur', NULL, NULL, NULL, NULL, NULL, 5, false);
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := position('FORBIDDEN' in v_error) > 0;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'NULL role was not denied by fail-closed guard'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
  v_rejected := false;
  BEGIN
    PERFORM public.create_agent_atomic('10000000-0000-0000-0000-000000000015', 'Synthetic Missing Profile', 'missing-profile@example.com'::citext,
      '4444444444', 'Jaijaipur', NULL, NULL, NULL, NULL, NULL, 5, false);
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := position('AUTH_REQUIRED' in v_error) > 0;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Missing profile was not denied'; END IF;

  RAISE NOTICE 'PASS: 12-level sponsor chain, legacy 1..10 constraint, self/cycle guards, real RPC role checks, null/missing role fail-closed, legacy ACL compatibility';
END;
$$;

ROLLBACK;
