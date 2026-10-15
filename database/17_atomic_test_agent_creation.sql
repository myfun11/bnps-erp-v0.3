-- BNPS ERP v0.3 — atomic TEST ONLY Agent/Profile creation.
-- Apply only after reviewing against the live schema. This migration is not auto-applied to production.
-- The 12-argument overload wraps the existing 11-argument creator and applies test flags
-- in the same PostgreSQL transaction. Any tagging failure rolls back the Agent/Profile rows.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS kyc_activation_pending boolean NOT NULL DEFAULT false;

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
    -- Real agents are not allowed to sign in until trusted KYC has matched all required documents.
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

  RETURN v_result || jsonb_build_object('is_test', coalesce(p_is_test, false),
                                        'kyc_required', NOT coalesce(p_is_test, false));
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

-- Evaluate pending real Agents before activation; manually disabled Agents remain excluded.
CREATE OR REPLACE FUNCTION public.evaluate_entity_kyc(p_entity_type text, p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_type text := lower(btrim(coalesce(p_entity_type,'')));
  v_full_name text;
  v_father_name text;
  v_dob text;
  v_aadhaar public.documents%ROWTYPE;
  v_aadhaar_back public.documents%ROWTYPE;
  v_pan public.documents%ROWTYPE;
  v_bank public.documents%ROWTYPE;
  v_docs uuid[] := ARRAY[]::uuid[];
  v_name_ok boolean := false;
  v_father_ok boolean := false;
  v_dob_ok boolean := false;
  v_complete boolean := false;
BEGIN
  IF v_entity_type NOT IN ('lead','agent') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Unsupported KYC entity' USING ERRCODE='22023';
  END IF;

  IF v_entity_type='lead' THEN
    SELECT l.full_name, l.father_name, l.dob::text
      INTO v_full_name, v_father_name, v_dob
      FROM public.leads l WHERE l.id=p_entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found' USING ERRCODE='P0002'; END IF;

    SELECT d.* INTO v_aadhaar FROM public.documents d
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category IN ('aadhaar','aadhaar_front')
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_pan FROM public.documents d
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category='pan'
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_bank FROM public.documents d
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category='bank_proof'
     ORDER BY d.created_at DESC LIMIT 1;
    IF v_pan.status='REJECTED' THEN v_pan := NULL; END IF;

    -- Lead conversion requires Aadhaar + bank passbook. PAN is optional;
    -- if uploaded, it must pass trusted OCR and all identity checks.
    v_complete := v_aadhaar.id IS NOT NULL AND v_bank.id IS NOT NULL
      AND v_aadhaar.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_bank.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_aadhaar.extraction_is_legible IS TRUE AND v_bank.extraction_is_legible IS TRUE
      AND coalesce(v_aadhaar.extraction_confidence,0)>=0.85
      AND coalesce(v_bank.extraction_confidence,0)>=0.85
      AND (v_pan.id IS NULL OR (
        v_pan.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
        AND v_pan.extraction_is_legible IS TRUE
        AND coalesce(v_pan.extraction_confidence,0)>=0.85
      ));
    v_docs := array_remove(ARRAY[v_aadhaar.id,v_pan.id,v_bank.id], NULL);
  ELSE
    SELECT p.full_name INTO v_full_name
      FROM public.agents a JOIN public.profiles p ON p.id=a.profile_id
     WHERE a.id=p_entity_id AND (a.is_active=true OR a.kyc_activation_pending=true) FOR UPDATE OF a;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active agent not found' USING ERRCODE='P0002'; END IF;

    SELECT d.* INTO v_aadhaar FROM public.documents d
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='aadhaar_front'
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_aadhaar_back FROM public.documents d
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='aadhaar_back'
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_pan FROM public.documents d
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='pan'
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_bank FROM public.documents d
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='bank_proof'
     ORDER BY d.created_at DESC LIMIT 1;

    v_complete := v_aadhaar.id IS NOT NULL AND v_aadhaar_back.id IS NOT NULL AND v_pan.id IS NOT NULL AND v_bank.id IS NOT NULL
      AND v_aadhaar.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH') AND v_aadhaar_back.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_pan.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH') AND v_bank.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_aadhaar.extraction_is_legible IS TRUE AND v_aadhaar_back.extraction_is_legible IS TRUE
      AND v_pan.extraction_is_legible IS TRUE AND v_bank.extraction_is_legible IS TRUE
      AND coalesce(v_aadhaar.extraction_confidence,0)>=0.85 AND coalesce(v_aadhaar_back.extraction_confidence,0)>=0.85
      AND coalesce(v_pan.extraction_confidence,0)>=0.85 AND coalesce(v_bank.extraction_confidence,0)>=0.85;
    v_docs := ARRAY[v_aadhaar.id,v_aadhaar_back.id,v_pan.id,v_bank.id];
  END IF;

  IF NOT v_complete OR public.kyc_normalize_identity(v_full_name)='' THEN
    RETURN jsonb_build_object('status','PENDING','reason','required_documents_or_trusted_extraction_pending');
  END IF;

  v_name_ok :=
    public.kyc_normalize_identity(v_aadhaar.extracted_name)=public.kyc_normalize_identity(v_full_name)
    AND public.kyc_normalize_identity(v_bank.extracted_name)=public.kyc_normalize_identity(v_full_name)
    AND (v_pan.id IS NULL OR
      public.kyc_normalize_identity(v_pan.extracted_name)=public.kyc_normalize_identity(v_full_name));

  IF v_entity_type='lead' THEN
    v_father_ok := public.kyc_normalize_identity(v_father_name)<>''
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_father_name)
      AND public.kyc_normalize_identity(v_bank.extracted_father_name)=public.kyc_normalize_identity(v_father_name)
      AND (v_pan.id IS NULL OR public.kyc_normalize_identity(v_pan.extracted_father_name)=public.kyc_normalize_identity(v_father_name));
    v_dob_ok := public.kyc_normalize_dob(v_aadhaar.extracted_dob)=public.kyc_normalize_dob(v_dob)
      AND (v_pan.id IS NULL OR public.kyc_normalize_dob(v_pan.extracted_dob)=public.kyc_normalize_dob(v_dob))
      AND public.kyc_normalize_dob(v_dob) IS NOT NULL;
  ELSE
    v_father_ok := public.kyc_normalize_identity(v_aadhaar.extracted_father_name)<>''
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_pan.extracted_father_name)
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_bank.extracted_father_name);
    v_dob_ok := public.kyc_normalize_dob(v_aadhaar.extracted_dob) IS NOT NULL
      AND public.kyc_normalize_dob(v_aadhaar.extracted_dob)=public.kyc_normalize_dob(v_pan.extracted_dob);
  END IF;

  IF v_name_ok AND v_father_ok AND v_dob_ok THEN
    UPDATE public.documents
       SET extraction_status='MATCHED', kyc_match_status='MATCHED',
           status='VERIFIED', verified_by=NULL, verified_at=clock_timestamp(),
           extraction_error=NULL
     WHERE id=ANY(v_docs) AND status<>'REJECTED';
    RETURN jsonb_build_object('status','MATCHED','auto_verified',true,'documents_verified',cardinality(v_docs));
  END IF;

  UPDATE public.documents
     SET extraction_status='MISMATCH', kyc_match_status='MISMATCH',
         status='UPLOADED', verified_by=NULL, verified_at=NULL,
         rejection_reason=NULL
   WHERE id=ANY(v_docs) AND status<>'REJECTED';
  RETURN jsonb_build_object('status','MISMATCH','auto_verified',false,
    'name_match',v_name_ok,'father_name_match',v_father_ok,'dob_match',v_dob_ok);
END;
$$;

-- Activate a real Agent only after the trusted evaluator has matched the latest four KYC documents.
-- The function is service-role-only; browsers cannot directly activate an Agent.
CREATE OR REPLACE FUNCTION public.activate_agent_after_kyc(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_is_test boolean;
  v_kyc_activation_pending boolean;
  v_required_category text;
BEGIN
  SELECT a.profile_id, a.is_test, a.kyc_activation_pending
    INTO v_profile_id, v_is_test, v_kyc_activation_pending
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

  IF NOT coalesce(v_kyc_activation_pending, false) THEN
    RETURN jsonb_build_object('success', false, 'activated', false, 'is_test', false,
                              'message', 'Agent is not pending KYC activation.');
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
     SET is_active = true, kyc_activation_pending = false, updated_at = clock_timestamp()
   WHERE id = p_agent_id AND profile_id = v_profile_id AND is_test = false AND kyc_activation_pending = true;
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
$$;

REVOKE ALL ON FUNCTION public.activate_agent_after_kyc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_agent_after_kyc(uuid) TO service_role;

-- Refresh PostgREST's RPC schema cache so the new overload is discoverable.
NOTIFY pgrst, 'reload schema';
