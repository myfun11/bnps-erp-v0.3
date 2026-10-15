-- BNPS ERP v0.3 — Migration 22: safely reconcile document immutability with atomic lead conversion.
-- Source-only migration. Apply to live Supabase only after explicit approval and runtime test sign-off.
-- This narrowly permits a lead's documents to be reassigned to that exact converted customer;
-- the original lead/<lead UUID>/ storage path and document category remain immutable.

CREATE OR REPLACE FUNCTION public.enforce_document_entity_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_permission text;
  v_allowed_conversion_reassignment boolean := false;
BEGIN
  -- Trusted backend maintenance may operate without an end-user JWT.
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.entity_type IS DISTINCT FROM OLD.entity_type
    OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
    OR NEW.file_path IS DISTINCT FROM OLD.file_path
    OR NEW.doc_category IS DISTINCT FROM OLD.doc_category
  ) THEN
    v_allowed_conversion_reassignment :=
      OLD.entity_type = 'lead'
      AND NEW.entity_type = 'customer'
      AND NEW.entity_id IS DISTINCT FROM OLD.entity_id
      AND NEW.file_path IS NOT DISTINCT FROM OLD.file_path
      AND NEW.doc_category IS NOT DISTINCT FROM OLD.doc_category
      AND lower(split_part(OLD.file_path, '/', 1)) = 'lead'
      AND split_part(OLD.file_path, '/', 2) = OLD.entity_id::text
      AND EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.id = OLD.entity_id
          AND l.stage::text = 'CONVERTED'
          AND l.converted_customer_id = NEW.entity_id
      );

    IF NOT v_allowed_conversion_reassignment THEN
      RAISE EXCEPTION 'DOCUMENT_IDENTITY_FIELDS_ARE_IMMUTABLE'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_permission := 'document.upload';
    IF lower(split_part(NEW.file_path, '/', 1)) <> lower(NEW.entity_type)
       OR split_part(NEW.file_path, '/', 2) <> NEW.entity_id::text THEN
      RAISE EXCEPTION 'DOCUMENT_PATH_ENTITY_MISMATCH'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'VERIFIED' THEN
      v_permission := 'document.verify';
    ELSIF NEW.status::text = 'REJECTED' THEN
      v_permission := 'document.reject';
    ELSE
      RAISE EXCEPTION 'DOCUMENT_STATUS_TRANSITION_NOT_ALLOWED'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT public.document_entity_access_allowed(
    NEW.entity_type, NEW.entity_id, NEW.doc_category, v_permission
  ) THEN
    RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgname = 'trg_enforce_document_entity_access'
      AND t.tgrelid = 'public.documents'::regclass
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER trg_enforce_document_entity_access
      BEFORE INSERT OR UPDATE ON public.documents
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_document_entity_access();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_document_entity_access() FROM PUBLIC, anon, authenticated;

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

    -- Mark the lead converted first. The storage-object guard validates the five required
    -- real Storage objects while documents still retain their original lead ownership.
    -- This remains atomic: any later failure rolls back the lead/customer/acquisition changes.
    UPDATE public.leads
       SET stage = 'CONVERTED',
           converted_customer_id = v_customer_id,
           updated_at = clock_timestamp()
     WHERE id = p_lead_id;

    -- 3. Create Acquisition Record before reassigning documents so the existing entity-scope
    -- trigger can prove the source Agent is linked to this customer.
    INSERT INTO public.acquisitions (
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

    -- Preserve all document rows/history. A narrow trigger exception permits only this
    -- lead-to-its-converted-customer reassignment while retaining the original lead file path.
    UPDATE public.documents
       SET entity_type = 'customer',
           entity_id = v_customer_id
     WHERE entity_type = 'lead'
       AND entity_id = p_lead_id;



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

NOTIFY pgrst, 'reload schema';
