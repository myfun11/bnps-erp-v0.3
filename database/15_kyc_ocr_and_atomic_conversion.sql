-- BNPS ERP v0.3 — KYC OCR and database-enforced lead conversion gate
-- Source-audited against live project oyogabtshehgwhbhxhid on 2026-10-11.
-- REVIEW ONLY: this file is not applied to the live database by this PR.
-- Sensitive extracted values are limited to name, father name and DOB. Never store Aadhaar number or raw OCR output.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extracted_name text,
  ADD COLUMN IF NOT EXISTS extracted_father_name text,
  ADD COLUMN IF NOT EXISTS extracted_dob text,
  ADD COLUMN IF NOT EXISTS extraction_document_type text,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS extraction_is_legible boolean,
  ADD COLUMN IF NOT EXISTS extraction_provider text,
  ADD COLUMN IF NOT EXISTS extraction_model text,
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS extraction_error text,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_match_status text NOT NULL DEFAULT 'PENDING';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS dob date;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS dob date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='documents_extraction_status_check') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_extraction_status_check
      CHECK (extraction_status IN ('PENDING','PROCESSING','EXTRACTED','MATCHED','MISMATCH','NEEDS_REVIEW','ERROR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='documents_kyc_match_status_check') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_kyc_match_status_check
      CHECK (kyc_match_status IN ('PENDING','MATCHED','MISMATCH'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='documents_extraction_confidence_check') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_extraction_confidence_check
      CHECK (extraction_confidence IS NULL OR (extraction_confidence >= 0 AND extraction_confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_entity_category_created_idx
  ON public.documents (entity_type, entity_id, doc_category, created_at DESC);

-- Enforce the first-login password change at the database authorization boundary.
-- This prevents bypassing the frontend gate by calling PostgREST/RPC directly.
CREATE OR REPLACE FUNCTION public.current_session_requires_password_change()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt()->'app_metadata'->>'must_change_password', 'false') = 'true';
$$;

REVOKE ALL ON FUNCTION public.current_session_requires_password_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_auth_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = true
    AND NOT public.current_session_requires_password_change()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = true
    AND NOT public.current_session_requires_password_change()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_erp_permission(perm_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_permission_id uuid;
  v_user_effect varchar(10);
  v_has_role_permission boolean := false;
BEGIN
  IF public.current_session_requires_password_change() THEN
    RETURN false;
  END IF;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id INTO v_permission_id
  FROM public.permissions p
  WHERE p.code = perm_code
  LIMIT 1;

  IF v_permission_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT upo.effect INTO v_user_effect
  FROM public.user_permission_overrides upo
  WHERE upo.user_id = v_profile_id AND upo.permission_id = v_permission_id
  LIMIT 1;

  IF v_user_effect = 'DENY' THEN
    RETURN false;
  END IF;
  IF v_user_effect = 'GRANT' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.dynamic_role_permissions drp ON drp.role_id = ur.role_id
    WHERE ur.user_id = v_profile_id AND drp.permission_id = v_permission_id
  ) INTO v_has_role_permission;

  IF v_has_role_permission THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.profiles p ON p.role = rp.role
    JOIN public.permissions pp ON pp.id = rp.permission_id
    WHERE p.id = v_profile_id AND pp.code = perm_code
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- A SECURITY DEFINER insert RPC must not let an agent attach KYC documents to another entity.
CREATE OR REPLACE FUNCTION public.enforce_document_entity_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NOT public.document_entity_access_allowed(
    NEW.entity_type, NEW.entity_id, NEW.doc_category, 'document.upload'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Document entity is outside the caller scope' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_document_entity_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS documents_entity_scope_before_insert ON public.documents;
CREATE TRIGGER documents_entity_scope_before_insert
BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_document_entity_scope();

CREATE OR REPLACE FUNCTION public.kyc_normalize_identity(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(lower(btrim(coalesce(p_value,''))), '[^[:alnum:]]+', ' ', 'g'),
    '^(shri|smt|mr|mrs|ms|dr|late|s o|d o|w o)[[:space:]]+', ''
  ));
$$;

CREATE OR REPLACE FUNCTION public.kyc_normalize_dob(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v text := btrim(coalesce(p_value,''));
  v_day text;
  v_month text;
  v_year text;
  v_date date;
BEGIN
  IF v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    v_date := v::date;
    RETURN to_char(v_date, 'YYYY-MM-DD');
  END IF;
  IF v ~ '^[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}$' THEN
    v_day := split_part(regexp_replace(v, '[.-]', '/', 'g'), '/', 1);
    v_month := split_part(regexp_replace(v, '[.-]', '/', 'g'), '/', 2);
    v_year := split_part(regexp_replace(v, '[.-]', '/', 'g'), '/', 3);
    v_date := make_date(v_year::integer, v_month::integer, v_day::integer);
    RETURN to_char(v_date, 'YYYY-MM-DD');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Runs only from the trusted server-side OCR function (service_role).
-- The browser can never write extraction results or set a document VERIFIED itself.
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
     WHERE a.id=p_entity_id AND a.is_active=true FOR UPDATE OF a;
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

REVOKE ALL ON FUNCTION public.kyc_normalize_identity(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kyc_normalize_dob(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_entity_kyc(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_entity_kyc(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.convert_lead_atomic(
    p_lead_id UUID,
    p_consumer_number VARCHAR(64),
    p_actor_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_lead RECORD;
    v_customer_id UUID;
    v_existing_cust_id UUID;
    v_customer_code VARCHAR(32);
    v_agent_id UUID;
    v_res JSONB;
    v_actor_profile_id UUID;
    v_actor_role user_role_type;
    v_actor_branch TEXT;
BEGIN
    v_actor_profile_id := public.current_auth_profile_id();
    v_actor_role := public.current_user_role();
    IF v_actor_profile_id IS NULL OR v_actor_role IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP profile is required' USING ERRCODE = '42501';
    END IF;
    IF v_actor_role NOT IN ('super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice') THEN
        RAISE EXCEPTION 'FORBIDDEN: User cannot convert leads' USING ERRCODE = '42501';
    END IF;

    -- 1. Lock Lead Record
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Lead ID % does not exist', p_lead_id USING ERRCODE = 'P0002';
    END IF;

    IF v_lead.stage = 'CONVERTED' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Lead % is already converted', v_lead.lead_code USING ERRCODE = 'P0003';
    END IF;

    IF v_lead.stage = 'LOST' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Cannot convert LOST lead %', v_lead.lead_code USING ERRCODE = 'P0003';
    END IF;

    SELECT p.branch INTO v_actor_branch FROM public.profiles p WHERE p.id = v_actor_profile_id;
    IF v_actor_role NOT IN ('super_admin', 'office_admin')
       AND (v_actor_branch IS NULL OR v_lead.branch IS NULL OR lower(btrim(v_actor_branch)) <> lower(btrim(v_lead.branch))) THEN
        RAISE EXCEPTION 'FORBIDDEN: Lead is outside the caller branch' USING ERRCODE = '42501';
    END IF;

    IF NULLIF(btrim(v_lead.father_name), '') IS NULL OR v_lead.dob IS NULL THEN
        RAISE EXCEPTION 'KYC_PENDING: Lead father name and DOB must be saved before verification' USING ERRCODE = 'P0003';
    END IF;

    -- Latest KYC documents must be trusted-OCR matched and auto-verified.
    IF NOT EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category IN ('aadhaar','aadhaar_front')
          AND d.status='VERIFIED' AND d.extraction_status='MATCHED' AND d.kyc_match_status='MATCHED'
          AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category IN ('aadhaar','aadhaar_front') ORDER BY d2.created_at DESC LIMIT 1)
    ) OR NOT EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='bank_proof'
          AND d.status='VERIFIED' AND d.extraction_status='MATCHED' AND d.kyc_match_status='MATCHED'
          AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='bank_proof' ORDER BY d2.created_at DESC LIMIT 1)
    ) OR (
        EXISTS (SELECT 1 FROM public.documents p WHERE p.entity_type='lead' AND p.entity_id=p_lead_id AND p.doc_category='pan'
          AND p.id=(SELECT p2.id FROM public.documents p2 WHERE p2.entity_type='lead' AND p2.entity_id=p_lead_id AND p2.doc_category='pan' ORDER BY p2.created_at DESC LIMIT 1)
          AND p.status<>'REJECTED')
        AND NOT EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='pan'
            AND d.status='VERIFIED' AND d.extraction_status='MATCHED' AND d.kyc_match_status='MATCHED'
            AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='pan' ORDER BY d2.created_at DESC LIMIT 1)
        )
    ) THEN
        RAISE EXCEPTION 'KYC_PENDING: Aadhaar and bank passbook OCR must match; if PAN is uploaded it must also match' USING ERRCODE = 'P0003';
    END IF;

    -- Preserve the existing operational document requirements as a server-side gate.
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='electricity_bill' AND d.status='VERIFIED'
      AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='electricity_bill' ORDER BY d2.created_at DESC LIMIT 1))
      OR NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='noc_b1' AND d.status IN ('UPLOADED','VERIFIED')
      AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='noc_b1' ORDER BY d2.created_at DESC LIMIT 1))
      OR NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='site_photo' AND d.status IN ('UPLOADED','VERIFIED')
      AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='site_photo' ORDER BY d2.created_at DESC LIMIT 1)) THEN
        RAISE EXCEPTION 'DOCUMENTS_INCOMPLETE: Electricity bill, NOC/B1 and site photo must be verified before conversion' USING ERRCODE = 'P0003';
    END IF;

    v_agent_id := v_lead.source_agent_id;

    -- 2. Check for Duplicate Customer by Mobile or Consumer Number
    SELECT id INTO v_existing_cust_id FROM customers 
    WHERE primary_mobile = v_lead.mobile 
       OR consumer_number = COALESCE(p_consumer_number, v_lead.consumer_number)
    LIMIT 1;

    IF v_existing_cust_id IS NOT NULL THEN
        v_customer_id := v_existing_cust_id;
    ELSE
        -- Generate Customer Code (BNPS-CUST-YYYY-XXXXX)
        v_customer_code := 'BNPS-CUST-' || to_char(CURRENT_DATE, 'YYMM') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');

        INSERT INTO customers (
            customer_code,
            branch,
            full_name,
            father_name,
            dob,
            primary_mobile,
            alternate_mobile,
            email,
            discom_name,
            consumer_number,
            sanctioned_load_kw,
            installation_address,
            district,
            tehsil,
            block,
            panchayat_village,
            state,
            pincode,
            lifecycle_status,
            is_test
        ) VALUES (
            v_customer_code,
            v_lead.branch,
            v_lead.full_name,
            v_lead.father_name,
            v_lead.dob,
            v_lead.mobile,
            v_lead.alternate_phone,
            v_lead.email,
            COALESCE(v_lead.discom_name, 'CSPDCL'),
            COALESCE(p_consumer_number, v_lead.consumer_number, 'PENDING-' || v_customer_code),
            v_lead.sanctioned_load_kw,
            COALESCE(v_lead.address_line, 'Address Pending Site Survey'),
            v_lead.district,
            v_lead.tehsil,
            v_lead.block,
            v_lead.panchayat_village,
            COALESCE(v_lead.state, 'Chhattisgarh'),
            v_lead.pincode,
            'UNREGISTERED',
            v_lead.is_test
        ) RETURNING id INTO v_customer_id;
    END IF;

    -- Preserve all lead documents and history by moving document metadata to the new/existing customer.
    UPDATE public.documents
       SET entity_type='customer', entity_id=v_customer_id
     WHERE entity_type='lead' AND entity_id=p_lead_id;

    -- 3. Create Acquisition Record
    INSERT INTO acquisitions (
        customer_id,
        lead_id,
        sourcing_agent_id,
        conversion_notes,
        is_test
    ) VALUES (
        v_customer_id,
        v_lead.id,
        v_agent_id,
        'Converted from Lead ' || v_lead.lead_code,
        v_lead.is_test
    );


    -- 5. Update Lead Status
    UPDATE leads 
    SET stage = 'CONVERTED',
        converted_customer_id = v_customer_id,
        updated_at = clock_timestamp()
    WHERE id = p_lead_id;

    -- 6. Audit Trail
    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    ) VALUES (
        v_actor_profile_id,
        'LEAD_CONVERTED',
        'leads',
        p_lead_id,
        jsonb_build_object('lead_code', v_lead.lead_code, 'customer_id', v_customer_id)
    );

    v_res := jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'customer_id', v_customer_id,
        'customer_code', v_customer_code
    );

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.convert_lead_atomic(uuid, character varying, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead_atomic(uuid, character varying, uuid) TO authenticated;


-- 2. ATOMIC MULTI-TIER COMMISSION GENERATION

-- Preserve the caller-authenticated lead creation workflow while persisting declared identity fields.
CREATE OR REPLACE FUNCTION public.create_lead_atomic(
  p_source_agent_id uuid,
  p_assigned_officer_id uuid,
  p_full_name text,
  p_mobile character varying,
  p_alternate_phone character varying,
  p_email citext,
  p_discom_name text,
  p_consumer_number character varying,
  p_sanctioned_load_kw numeric,
  p_proposed_capacity_kw numeric,
  p_address_line text,
  p_state text,
  p_district text,
  p_tehsil text,
  p_block text,
  p_panchayat_village text,
  p_pincode character varying,
  p_notes text,
  p_is_test boolean,
  p_father_name text,
  p_dob date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_lead_id uuid;
  v_lead jsonb;
BEGIN
  v_result := public.create_lead_atomic(
    p_source_agent_id, p_assigned_officer_id, p_full_name, p_mobile,
    p_alternate_phone, p_email, p_discom_name, p_consumer_number,
    p_sanctioned_load_kw, p_proposed_capacity_kw, p_address_line, p_state,
    p_district, p_tehsil, p_block, p_panchayat_village, p_pincode, p_notes, p_is_test
  );
  IF coalesce((v_result->>'success')::boolean,false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;
  v_lead_id := (v_result->'lead'->>'id')::uuid;
  UPDATE public.leads l
     SET father_name=NULLIF(btrim(p_father_name),''),
         dob=p_dob
   WHERE l.id=v_lead_id
   RETURNING to_jsonb(l.*) INTO v_lead;
  RETURN jsonb_set(v_result,'{lead}',v_lead,true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_lead_atomic(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lead_atomic(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean,text,date) TO authenticated;

-- The original overload remains for compatibility with older clients, but cannot bypass conversion KYC.
REVOKE ALL ON FUNCTION public.create_lead_atomic(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lead_atomic(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean) TO authenticated;


-- ---------------------------------------------------------------------------
-- SECURITY PATCH: protect existing SECURITY DEFINER RPC access paths.
-- This migration is source-only until separately approved for live application.
-- ---------------------------------------------------------------------------

-- Global search must execute as the caller so table RLS enforces row/branch scope.
-- It also refuses anonymous calls and sessions still required to change password.
CREATE OR REPLACE FUNCTION public.global_erp_search(
  p_query text,
  p_max_limit integer DEFAULT 20
)
RETURNS TABLE(
  entity_type text,
  entity_id uuid,
  primary_label text,
  secondary_label text,
  status_label text,
  created_date timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_q text := btrim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_max_limit, 20), 50));
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(auth.jwt()->'app_metadata'->>'must_change_password', 'false') = 'true' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: authenticated session required' USING ERRCODE = '42501';
  END IF;

  IF v_clean_q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'customer'::text, c.id,
         (c.customer_code || ' • ' || c.full_name)::text,
         ('Mob: ' || c.primary_mobile || ' | Consumer: ' || c.consumer_number)::text,
         c.lifecycle_status::text, c.created_at
  FROM public.customers c
  WHERE c.customer_code ILIKE '%' || v_clean_q || '%'
     OR c.full_name ILIKE '%' || v_clean_q || '%'
     OR c.primary_mobile ILIKE '%' || v_clean_q || '%'
     OR c.consumer_number ILIKE '%' || v_clean_q || '%'

  UNION ALL

  SELECT 'lead'::text, l.id,
         (l.lead_code || ' • ' || l.full_name)::text,
         ('Mob: ' || l.mobile || ' | Stage: ' || l.stage::text)::text,
         l.stage::text, l.created_at
  FROM public.leads l
  WHERE l.lead_code ILIKE '%' || v_clean_q || '%'
     OR l.full_name ILIKE '%' || v_clean_q || '%'
     OR l.mobile ILIKE '%' || v_clean_q || '%'

  UNION ALL

  SELECT 'project'::text, p.id,
         (p.project_code || ' • ' || p.capacity_kw::text || ' kW')::text,
         ('Total: ₹' || p.total_contract_amount::text)::text,
         p.status::text, p.created_at
  FROM public.projects p
  WHERE p.project_code ILIKE '%' || v_clean_q || '%'

  UNION ALL

  SELECT 'pmsg_application'::text, pm.id,
         ('PMSG: ' || pm.portal_application_no)::text,
         ('Capacity: ' || coalesce(pm.registered_capacity_kw::text, '0') || ' kW')::text,
         pm.stage::text, pm.created_at
  FROM public.pmsg_tracking pm
  WHERE pm.portal_application_no ILIKE '%' || v_clean_q || '%'
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.global_erp_search(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_erp_search(text, integer) TO authenticated;

-- Keep the existing dashboard calculations intact, but make the old SECURITY
-- DEFINER implementation private and put a first-login/auth gate in front of it.
DO $$
BEGIN
  IF to_regprocedure('public.get_dashboard_summary_unchecked()') IS NULL
     AND to_regprocedure('public.get_dashboard_summary()') IS NOT NULL THEN
    ALTER FUNCTION public.get_dashboard_summary() RENAME TO get_dashboard_summary_unchecked;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary_unchecked() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(auth.jwt()->'app_metadata'->>'must_change_password', 'false') = 'true'
     OR public.current_auth_profile_id() IS NULL THEN
    RAISE EXCEPTION 'ACCESS_DENIED: authenticated ERP profile required' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_dashboard_summary_unchecked();
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary() TO authenticated;

-- Commission generation is a privileged financial action. Preserve the existing
-- atomic calculation internally, but expose only a role-checked wrapper and never
-- trust the caller-supplied actor id for the audit trail.
DO $$
BEGIN
  IF to_regprocedure('public.generate_project_commission_atomic_unchecked(uuid,public.payment_stage_type,uuid)') IS NULL
     AND to_regprocedure('public.generate_project_commission_atomic(uuid,public.payment_stage_type,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.generate_project_commission_atomic(uuid, public.payment_stage_type, uuid)
      RENAME TO generate_project_commission_atomic_unchecked;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_project_commission_atomic_unchecked(uuid, public.payment_stage_type, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_project_commission_atomic(
  p_project_id uuid,
  p_payment_stage public.payment_stage_type,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.user_role_type;
  v_actor_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(auth.jwt()->'app_metadata'->>'must_change_password', 'false') = 'true' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: authenticated session required' USING ERRCODE = '42501';
  END IF;

  v_actor_profile_id := public.current_auth_profile_id();
  v_role := public.current_user_role();

  IF v_actor_profile_id IS NULL
     OR v_role IS NULL
     OR v_role NOT IN ('super_admin', 'office_admin', 'accountant') THEN
    RAISE EXCEPTION 'ACCESS_DENIED: role cannot generate commissions' USING ERRCODE = '42501';
  END IF;

  RETURN public.generate_project_commission_atomic_unchecked(
    p_project_id, p_payment_stage, v_actor_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_project_commission_atomic(uuid, public.payment_stage_type, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_project_commission_atomic(uuid, public.payment_stage_type, uuid)
  TO authenticated;


-- Agent network RPC: enforce caller branch scope and limit raw KYC/bank fields to
-- super-admin/office-admin or the agent's own record.
CREATE OR REPLACE FUNCTION public.get_agent_network(
  p_search text DEFAULT ''::text,
  p_branch text DEFAULT NULL::text,
  p_hierarchy_level integer DEFAULT NULL::integer
)
RETURNS TABLE(
  id uuid,
  profile_id uuid,
  agent_code character varying,
  branch character varying,
  sponsor_agent_id uuid,
  hierarchy_level integer,
  pan_number text,
  aadhaar_masked text,
  bank_account_no text,
  bank_name text,
  bank_ifsc text,
  tds_percentage numeric,
  total_commission_earned numeric,
  total_commission_paid numeric,
  outstanding_advance numeric,
  is_active boolean,
  is_test boolean,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  phone text,
  email text,
  sponsor_name text,
  sponsor_code character varying
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public.current_auth_profile_id();
  v_role public.user_role_type := public.current_user_role();
  v_actor_branch text;
  v_q text := lower(btrim(coalesce(p_search, '')));
  v_can_all boolean := false;
BEGIN
  IF v_profile_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION: Authenticated ERP profile required' USING ERRCODE = '42501';
  END IF;

  SELECT p.branch INTO v_actor_branch
  FROM public.profiles p
  WHERE p.id = v_profile_id;

  v_can_all := v_role IN ('super_admin', 'office_admin');

  RETURN QUERY
  SELECT
    a.id,
    a.profile_id,
    a.agent_code,
    p.branch,
    a.sponsor_agent_id,
    a.hierarchy_level,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.pan_number::text ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.aadhaar_masked::text ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.bank_account_no::text ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.bank_name::text ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.bank_ifsc::text ELSE NULL END,
    a.tds_percentage,
    a.total_commission_earned,
    a.total_commission_paid,
    a.outstanding_advance,
    a.is_active,
    a.is_test,
    a.created_at,
    a.updated_at,
    p.full_name::text,
    p.phone::text,
    p.email::text,
    sp.full_name::text,
    sa.agent_code::character varying
  FROM public.agents a
  JOIN public.profiles p ON p.id = a.profile_id
  LEFT JOIN public.agents sa ON sa.id = a.sponsor_agent_id
  LEFT JOIN public.profiles sp ON sp.id = sa.profile_id
  WHERE
    (
      v_can_all
      OR a.profile_id = v_profile_id
      OR (
        v_role IN ('branch_manager', 'accountant')
        AND v_actor_branch IS NOT NULL
        AND p.branch = v_actor_branch
      )
    )
    AND (v_can_all OR p_branch IS NULL OR p.branch = p_branch)
    AND (p_hierarchy_level IS NULL OR a.hierarchy_level = p_hierarchy_level)
    AND (
      v_q = ''
      OR lower(a.agent_code) LIKE '%' || v_q || '%'
      OR lower(p.full_name) LIKE '%' || v_q || '%'
      OR p.phone LIKE '%' || v_q || '%'
      OR lower(coalesce(p.email::text, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(p.branch, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(sp.full_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(sa.agent_code, '')) LIKE '%' || v_q || '%'
    )
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_network(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_network(text, text, integer) TO authenticated;

-- This RPC already checks agent.create and active-profile helpers internally;
-- remove anonymous execution as an additional least-privilege boundary.
REVOKE ALL ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric
) TO authenticated;


-- Wrap the legacy 19-argument lead RPC with explicit role and branch checks.
-- The 21-argument KYC-aware overload calls this wrapper, so both paths share policy.
DO $$
BEGIN
  IF to_regprocedure('public.create_lead_atomic_unchecked(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean)') IS NULL
     AND to_regprocedure('public.create_lead_atomic(uuid,uuid,text,character varying,character varying,citext,text,character varying,numeric,numeric,text,text,text,text,text,text,character varying,text,boolean)') IS NOT NULL THEN
    ALTER FUNCTION public.create_lead_atomic(
      uuid, uuid, text, character varying, character varying, citext, text,
      character varying, numeric, numeric, text, text, text, text, text, text,
      character varying, text, boolean
    ) RENAME TO create_lead_atomic_unchecked;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lead_atomic_unchecked(
  uuid, uuid, text, character varying, character varying, citext, text,
  character varying, numeric, numeric, text, text, text, text, text, text,
  character varying, text, boolean
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_lead_atomic(
  p_source_agent_id uuid DEFAULT NULL,
  p_assigned_officer_id uuid DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_mobile character varying DEFAULT NULL,
  p_alternate_phone character varying DEFAULT NULL,
  p_email citext DEFAULT NULL,
  p_discom_name text DEFAULT 'CSPDCL',
  p_consumer_number character varying DEFAULT NULL,
  p_sanctioned_load_kw numeric DEFAULT NULL,
  p_proposed_capacity_kw numeric DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_state text DEFAULT 'Chhattisgarh',
  p_district text DEFAULT NULL,
  p_tehsil text DEFAULT NULL,
  p_block text DEFAULT NULL,
  p_panchayat_village text DEFAULT NULL,
  p_pincode character varying DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_test boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_auth_profile_id();
  v_role public.user_role_type := public.current_user_role();
  v_actor_branch text;
BEGIN
  IF auth.uid() IS NULL OR v_actor_profile_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP profile required' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN (
    'super_admin', 'office_admin', 'branch_manager', 'field_officer',
    'operational_manager', 'backoffice', 'receptionist', 'agent'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Role cannot create leads' USING ERRCODE = '42501';
  END IF;

  SELECT p.branch INTO v_actor_branch
  FROM public.profiles p
  WHERE p.id = v_actor_profile_id;

  IF v_role NOT IN ('super_admin', 'office_admin') THEN
    IF v_actor_branch IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Caller has no branch scope' USING ERRCODE = '42501';
    END IF;

    IF p_source_agent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = p_source_agent_id
        AND a.is_active = true
        AND a.branch = v_actor_branch
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Source agent is outside caller branch' USING ERRCODE = '42501';
    END IF;

    IF p_assigned_officer_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_assigned_officer_id
        AND p.is_active = true
        AND p.branch = v_actor_branch
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Assigned officer is outside caller branch' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public.create_lead_atomic_unchecked(
    p_source_agent_id, p_assigned_officer_id, p_full_name, p_mobile,
    p_alternate_phone, p_email, p_discom_name, p_consumer_number,
    p_sanctioned_load_kw, p_proposed_capacity_kw, p_address_line, p_state,
    p_district, p_tehsil, p_block, p_panchayat_village, p_pincode, p_notes,
    p_is_test
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_lead_atomic(
  uuid, uuid, text, character varying, character varying, citext, text,
  character varying, numeric, numeric, text, text, text, text, text, text,
  character varying, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lead_atomic(
  uuid, uuid, text, character varying, character varying, citext, text,
  character varying, numeric, numeric, text, text, text, text, text, text,
  character varying, text, boolean
) TO authenticated;
