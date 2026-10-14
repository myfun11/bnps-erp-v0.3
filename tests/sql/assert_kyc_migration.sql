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

  RAISE NOTICE 'KYC migration post-conditions passed';
END;
$$;
