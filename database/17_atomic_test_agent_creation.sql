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

  v_agent_id := (v_result->>'agent_id')::uuid;
  v_profile_id := (v_result->>'profile_id')::uuid;

  IF coalesce(p_is_test, false) THEN
    UPDATE public.agents
       SET is_test = true, is_active = true, updated_at = clock_timestamp()
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
    -- Real agents are not allowed to sign in until trusted KYC has matched all required documents.
    UPDATE public.agents
       SET is_active = false, updated_at = clock_timestamp()
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

  RETURN v_result || jsonb_build_object('is_test', coalesce(p_is_test, false),
                                        'kyc_required', NOT coalesce(p_is_test, false));
END;
$;

REVOKE ALL ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric, boolean
) TO authenticated;

-- Activate a real Agent only after the trusted evaluator has matched the latest four KYC documents.
-- The function is service-role-only; browsers cannot directly activate an Agent.
CREATE OR REPLACE FUNCTION public.activate_agent_after_kyc(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
  v_profile_id uuid;
  v_is_test boolean;
  v_required_category text;
BEGIN
  SELECT a.profile_id, a.is_test
    INTO v_profile_id, v_is_test
  FROM public.agents a
  WHERE a.id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'AGENT_NOT_FOUND: Agent was not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_is_test THEN
    RETURN jsonb_build_object('success', true, 'activated', false, 'is_test', true,
                              'message', 'Test Agent activation is governed by test mode.');
  END IF;

  FOREACH v_required_category IN ARRAY ARRAY['pan','aadhaar_front','aadhaar_back','bank_proof']::text[] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.entity_type = 'agent'
        AND d.entity_id = p_agent_id
        AND d.doc_category = v_required_category
        AND d.status = 'VERIFIED'
        AND d.extraction_status = 'MATCHED'
        AND d.kyc_match_status = 'MATCHED'
        AND d.id = (
          SELECT d2.id
          FROM public.documents d2
          WHERE d2.entity_type = 'agent'
            AND d2.entity_id = p_agent_id
            AND d2.doc_category = v_required_category
          ORDER BY d2.created_at DESC
          LIMIT 1
        )
    ) THEN
      RETURN jsonb_build_object('success', false, 'activated', false, 'is_test', false,
                                'message', 'Required latest Agent KYC documents are not all matched.');
    END IF;
  END LOOP;

  UPDATE public.agents
     SET is_active = true, updated_at = clock_timestamp()
   WHERE id = p_agent_id AND profile_id = v_profile_id AND is_test = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AGENT_ACTIVATION_FAILED: Agent could not be activated' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
     SET is_active = true, updated_at = clock_timestamp()
   WHERE id = v_profile_id AND role = 'agent' AND is_test = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AGENT_ACTIVATION_FAILED: Agent profile could not be activated' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'activated', true, 'is_test', false);
END;
$;

REVOKE ALL ON FUNCTION public.activate_agent_after_kyc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_agent_after_kyc(uuid) TO service_role;

-- Refresh PostgREST's RPC schema cache so the new overload is discoverable.
NOTIFY pgrst, 'reload schema';
