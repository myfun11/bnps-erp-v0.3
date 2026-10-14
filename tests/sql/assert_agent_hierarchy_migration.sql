-- Disposable PostgreSQL runtime assertions for migration 20.
-- Uses only synthetic rows and rolls them back before the CI job ends.
BEGIN;

DO $$
DECLARE
  v_root uuid := gen_random_uuid();
  v_child uuid := gen_random_uuid();
  v_grandchild uuid := gen_random_uuid();
  v_depth integer;
  v_rejected boolean;
  v_error text;
  v_def text;
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
   WHERE id IN (v_root, v_child, v_grandchild);

  IF v_depth IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Three-level hierarchy failed; observed depth %', v_depth;
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
     OR position('office_admin' in v_def)=0 THEN
    RAISE EXCEPTION '12-argument Agent RPC does not enforce the Admin-only creation rule';
  END IF;

  RAISE NOTICE 'PASS: three-level hierarchy, self-parent rejection, circular-parent rejection, Admin-only RPC guard';
END;
$$;

ROLLBACK;
