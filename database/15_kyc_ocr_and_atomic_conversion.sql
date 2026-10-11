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
      CHECK (extraction_status IN ('PENDING','EXTRACTED','MATCHED','MISMATCH','NEEDS_REVIEW','ERROR'));
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

-- A SECURITY DEFINER insert RPC must not let an agent attach KYC documents to another entity.
CREATE OR REPLACE FUNCTION public.enforce_document_entity_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
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
$;

DROP TRIGGER IF EXISTS documents_entity_scope_before_insert ON public.documents;
CREATE TRIGGER documents_entity_scope_before_insert
BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_document_entity_scope();

-- Keep private object access aligned with the document metadata ownership/branch scope.
DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;
CREATE POLICY "documents_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND CASE
    WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}CREATE OR REPLACE FUNCTION public.kyc_normalize_identity(p_value text)
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

    v_complete := v_aadhaar.id IS NOT NULL AND v_pan.id IS NOT NULL AND v_bank.id IS NOT NULL
      AND v_aadhaar.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH') AND v_pan.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH') AND v_bank.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_aadhaar.extraction_is_legible IS TRUE AND v_pan.extraction_is_legible IS TRUE AND v_bank.extraction_is_legible IS TRUE
      AND coalesce(v_aadhaar.extraction_confidence,0)>=0.85
      AND coalesce(v_pan.extraction_confidence,0)>=0.85
      AND coalesce(v_bank.extraction_confidence,0)>=0.85;
    v_docs := ARRAY[v_aadhaar.id,v_pan.id,v_bank.id];
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
    AND public.kyc_normalize_identity(v_pan.extracted_name)=public.kyc_normalize_identity(v_full_name)
    AND public.kyc_normalize_identity(v_bank.extracted_name)=public.kyc_normalize_identity(v_full_name);

  IF v_entity_type='lead' THEN
    v_father_ok := public.kyc_normalize_identity(v_father_name)<>''
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_father_name)
      AND public.kyc_normalize_identity(v_pan.extracted_father_name)=public.kyc_normalize_identity(v_father_name)
      AND public.kyc_normalize_identity(v_bank.extracted_father_name)=public.kyc_normalize_identity(v_father_name);
    v_dob_ok := public.kyc_normalize_dob(v_aadhaar.extracted_dob)=public.kyc_normalize_dob(v_dob)
      AND public.kyc_normalize_dob(v_pan.extracted_dob)=public.kyc_normalize_dob(v_dob)
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

CREATE OR REPLACE FUNCTION convert_lead_atomic(
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
        WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='pan'
          AND d.status='VERIFIED' AND d.extraction_status='MATCHED' AND d.kyc_match_status='MATCHED'
          AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='pan' ORDER BY d2.created_at DESC LIMIT 1)
    ) OR NOT EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='bank_proof'
          AND d.status='VERIFIED' AND d.extraction_status='MATCHED' AND d.kyc_match_status='MATCHED'
          AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='bank_proof' ORDER BY d2.created_at DESC LIMIT 1)
    ) THEN
        RAISE EXCEPTION 'KYC_PENDING: Aadhaar, PAN and bank passbook OCR must match before customer conversion' USING ERRCODE = 'P0003';
    END IF;

    -- Preserve the existing operational document requirements as a server-side gate.
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='electricity_bill' AND d.status='VERIFIED'
      AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='electricity_bill' ORDER BY d2.created_at DESC LIMIT 1))
      OR NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='noc_b1' AND d.status='VERIFIED'
      AND d.id=(SELECT d2.id FROM public.documents d2 WHERE d2.entity_type='lead' AND d2.entity_id=p_lead_id AND d2.doc_category='noc_b1' ORDER BY d2.created_at DESC LIMIT 1))
      OR NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.entity_type='lead' AND d.entity_id=p_lead_id AND d.doc_category='site_photo' AND d.status='VERIFIED'
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
            'REGISTERED',
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
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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

    THEN public.document_entity_access_allowed(
      split_part(name, '/', 1),
      split_part(name, '/', 2)::uuid,
      '',
      'document.upload'
    )
    ELSE false
  END
);

DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
CREATE POLICY "documents_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
      FROM public.documents d
     WHERE d.file_path = storage.objects.name
       AND public.document_entity_access_allowed(
         d.entity_type, d.entity_id, d.doc_category, 'document.view'
       )
  )
);

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
