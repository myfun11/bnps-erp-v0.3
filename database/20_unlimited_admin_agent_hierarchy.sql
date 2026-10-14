-- BNPS ERP v0.3 — unlimited-depth sponsor hierarchy with Admin-only Agent creation.
-- SOURCE PATCH ONLY: review and validate before applying to any Supabase project.
-- "Unlimited" means no application-defined depth cap; commission payout positions remain capped by existing business rules.

CREATE OR REPLACE FUNCTION public.enforce_agent_sponsor_tree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_active boolean;
  v_would_cycle boolean;
BEGIN
  IF NEW.sponsor_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.sponsor_agent_id = NEW.id THEN
    RAISE EXCEPTION 'AGENT_HIERARCHY_SELF_PARENT: An Agent cannot sponsor itself'
      USING ERRCODE = '23514';
  END IF;

  SELECT a.is_active INTO v_parent_active
  FROM public.agents a
  WHERE a.id = NEW.sponsor_agent_id;

  IF NOT FOUND OR v_parent_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'AGENT_HIERARCHY_INVALID_PARENT: Parent Agent must exist and be active'
      USING ERRCODE = '23514';
  END IF;

  -- Walk the proposed parent's existing ancestor chain. UNION (not UNION ALL)
  -- guarantees termination even if legacy data already contains a cycle.
  WITH RECURSIVE ancestors(id, sponsor_agent_id) AS (
    SELECT a.id, a.sponsor_agent_id
    FROM public.agents a
    WHERE a.id = NEW.sponsor_agent_id
    UNION
    SELECT parent.id, parent.sponsor_agent_id
    FROM public.agents parent
    JOIN ancestors child ON parent.id = child.sponsor_agent_id
  )
  SELECT EXISTS (
    SELECT 1 FROM ancestors
    WHERE NEW.id IS NOT NULL AND id = NEW.id
  )
  INTO v_would_cycle;

  IF v_would_cycle THEN
    RAISE EXCEPTION 'AGENT_HIERARCHY_CYCLE: Parent assignment would create a circular hierarchy'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'agents_sponsor_tree_guard'
      AND tgrelid = 'public.agents'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER agents_sponsor_tree_guard
      BEFORE INSERT OR UPDATE OF sponsor_agent_id ON public.agents
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_agent_sponsor_tree();
  END IF;
END;
$$;

-- Defense in depth: only Admin roles may create Agents, even if a permission
-- override accidentally grants agent.create to another role.
CREATE OR REPLACE FUNCTION public.create_agent_atomic(
  p_auth_user_id uuid,
  p_full_name text,
  p_email citext,
  p_phone character varying,
  p_branch character varying,
  p_sponsor_agent_id uuid,
  p_pan_number character varying,
  p_bank_account_no text,
  p_bank_name text,
  p_bank_ifsc character varying,
  p_tds_percentage numeric,
  p_is_test boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_agent_id uuid;
  v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_auth_profile_id() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP profile required' USING ERRCODE = '42501';
  END IF;

  IF public.current_user_role() NOT IN ('super_admin', 'office_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Super Admin or Office Admin may create Agents'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(p_is_test, false)
     AND public.current_user_role() NOT IN ('super_admin', 'office_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Super Admin or Office Admin may create test agents'
      USING ERRCODE = '42501';
  END IF;

  -- Preserve the established validation, permission and business logic.
  v_result := public.create_agent_atomic(
    p_auth_user_id, p_full_name, p_email, p_phone, p_branch,
    p_sponsor_agent_id, p_pan_number, p_bank_account_no, p_bank_name,
    p_bank_ifsc, p_tds_percentage
  );

  IF coalesce((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_agent_id := (v_result->>'agent_id')::uuid;
  v_profile_id := (v_result->>'profile_id')::uuid;

  IF coalesce(p_is_test, false) THEN
    UPDATE public.agents
       SET is_test = true, is_active = true, kyc_activation_pending = false, updated_at = clock_timestamp()
     WHERE id = v_agent_id AND profile_id = v_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEST_MODE_TAG_FAILED: Agent row could not be tagged atomically'
        USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.profiles
       SET is_test = true, is_active = true, updated_at = clock_timestamp()
     WHERE id = v_profile_id AND role = 'agent';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEST_MODE_TAG_FAILED: Agent profile could not be tagged atomically'
        USING ERRCODE = 'P0002';
    END IF;
  ELSE
    -- Real Agents remain inactive until trusted KYC is matched.
    UPDATE public.agents
       SET is_active = false, kyc_activation_pending = true, updated_at = clock_timestamp()
     WHERE id = v_agent_id AND profile_id = v_profile_id AND is_test = false;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AGENT_PENDING_KYC: Agent could not be held inactive pending KYC'
        USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.profiles
       SET is_active = false, updated_at = clock_timestamp()
     WHERE id = v_profile_id AND role = 'agent' AND is_test = false;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AGENT_PENDING_KYC: Agent profile could not be held inactive pending KYC'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object(
    'is_test', coalesce(p_is_test, false),
    'kyc_required', NOT coalesce(p_is_test, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric, boolean
) TO authenticated;

NOTIFY pgrst, 'reload schema';
