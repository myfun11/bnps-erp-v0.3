-- BNPS ERP v0.3 — atomic TEST ONLY Agent/Profile creation.
-- Apply only after reviewing against the live schema. This migration is not auto-applied to production.
-- The 12-argument overload wraps the existing 11-argument creator and applies test flags
-- in the same PostgreSQL transaction. Any tagging failure rolls back the Agent/Profile rows.

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

  IF coalesce(p_is_test, false) THEN
    v_agent_id := (v_result->>'agent_id')::uuid;
    v_profile_id := (v_result->>'profile_id')::uuid;

    UPDATE public.agents
       SET is_test = true, updated_at = clock_timestamp()
     WHERE id = v_agent_id AND profile_id = v_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEST_MODE_TAG_FAILED: Agent row could not be tagged atomically'
        USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.profiles
       SET is_test = true, updated_at = clock_timestamp()
     WHERE id = v_profile_id AND role = 'agent' AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEST_MODE_TAG_FAILED: Active Agent profile could not be tagged atomically'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object('is_test', coalesce(p_is_test, false));
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

-- Refresh PostgREST's RPC schema cache so the new overload is discoverable.
NOTIFY pgrst, 'reload schema';
