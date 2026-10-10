-- ============================================================================
-- BNPS ERP v0.3 — Migration 14: Hardened Lead Document Gate for Conversion
-- Organization: Bhumi Nidhi Power Solution (Headquarters: Jaijaipur, Chhattisgarh)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND CANONICAL DOCUMENT CATEGORIES IF CHECK CONSTRAINT EXISTS
-- ----------------------------------------------------------------------------
-- Note: documents.doc_category is VARCHAR(64). In case any previous check constraint
-- was created on doc_category, this block ensures 'noc_b1' is safely accepted.
DO $$
BEGIN
    -- Check if any constraint exists restricting doc_category
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'documents'::regclass 
          AND conname = 'chk_documents_category'
    ) THEN
        ALTER TABLE documents DROP CONSTRAINT chk_documents_category;
        ALTER TABLE documents ADD CONSTRAINT chk_documents_category 
            CHECK (doc_category IN ('aadhaar', 'pan', 'electricity_bill', 'bank_proof', 'noc_b1', 'site_photo', 'net_meter_cert'));
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. AUTHORITATIVE CONVERT_LEAD_ATOMIC FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION convert_lead_atomic(
    p_lead_id UUID,
    p_consumer_number VARCHAR(64),
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_lead RECORD;
    v_customer_id UUID;
    v_existing_cust RECORD;
    v_customer_code VARCHAR(32);
    v_agent_id UUID;
    v_has_ebill BOOLEAN := false;
    v_has_aadhaar BOOLEAN := false;
    v_has_bank_proof BOOLEAN := false;
    v_has_noc_b1 BOOLEAN := false;
    v_has_site_photo BOOLEAN := false;
    v_has_complete_location BOOLEAN := false;
    v_attempts INT := 0;
    v_res JSONB;
BEGIN
    -- ------------------------------------------------------------------------
    -- STEP 1: STRICT AUTHENTICATION & ACTOR PERMISSION (NO CLIENT FALLBACK)
    -- ------------------------------------------------------------------------
    v_actor_id := current_auth_profile_id();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP profile not found for authenticated session'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT has_erp_permission('lead.convert') THEN
        RAISE EXCEPTION 'FORBIDDEN: User does not have lead.convert permission'
            USING ERRCODE = 'P0005';
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 2: LOCK LEAD & VALIDATE WORKFLOW STAGE
    -- ------------------------------------------------------------------------
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Lead ID % does not exist', p_lead_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_lead.stage = 'CONVERTED' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Lead % is already converted', v_lead.lead_code
            USING ERRCODE = 'P0003';
    END IF;

    IF v_lead.stage = 'LOST' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Cannot convert LOST lead %', v_lead.lead_code
            USING ERRCODE = 'P0003';
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 3: ENFORCE LOCATION VALIDATION (GEOGRAPHY + SITE PHOTO)
    -- ------------------------------------------------------------------------
    -- Part A: Complete geographic record on the lead
    v_has_complete_location := (
        v_lead.address_line IS NOT NULL AND BTRIM(v_lead.address_line) <> '' AND
        v_lead.district IS NOT NULL AND BTRIM(v_lead.district) <> '' AND
        v_lead.pincode IS NOT NULL AND BTRIM(v_lead.pincode) <> '' AND
        v_lead.tehsil IS NOT NULL AND BTRIM(v_lead.tehsil) <> '' AND
        v_lead.block IS NOT NULL AND BTRIM(v_lead.block) <> '' AND
        v_lead.panchayat_village IS NOT NULL AND BTRIM(v_lead.panchayat_village) <> ''
    );

    IF NOT v_has_complete_location THEN
        RAISE EXCEPTION 'DOCUMENTS_INCOMPLETE: Complete geographic location (address, district, tehsil, block, village, pincode) is required on lead %', v_lead.lead_code
            USING ERRCODE = 'P0004';
    END IF;

    -- Part B: Valid site photo proof
    SELECT EXISTS (
        SELECT 1 FROM documents 
        WHERE entity_type = 'lead' 
          AND entity_id = p_lead_id 
          AND doc_category = 'site_photo' 
          AND status IN ('UPLOADED', 'VERIFIED')
    ) INTO v_has_site_photo;

    IF NOT v_has_site_photo THEN
        RAISE EXCEPTION 'DOCUMENTS_INCOMPLETE: Site photo / location proof document (site_photo) must be uploaded prior to conversion'
            USING ERRCODE = 'P0004';
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 4: ENFORCE 4 OTHER REQUIRED DOCUMENTS (PAN IS OPTIONAL)
    -- ------------------------------------------------------------------------
    -- 1. Electricity Bill
    SELECT EXISTS (
        SELECT 1 FROM documents 
        WHERE entity_type = 'lead' 
          AND entity_id = p_lead_id 
          AND doc_category = 'electricity_bill' 
          AND status IN ('UPLOADED', 'VERIFIED')
    ) INTO v_has_ebill;

    -- 2. Aadhaar
    SELECT EXISTS (
        SELECT 1 FROM documents 
        WHERE entity_type = 'lead' 
          AND entity_id = p_lead_id 
          AND doc_category = 'aadhaar' 
          AND status IN ('UPLOADED', 'VERIFIED')
    ) INTO v_has_aadhaar;

    -- 3. Bank Proof / Passbook
    SELECT EXISTS (
        SELECT 1 FROM documents 
        WHERE entity_type = 'lead' 
          AND entity_id = p_lead_id 
          AND doc_category = 'bank_proof' 
          AND status IN ('UPLOADED', 'VERIFIED')
    ) INTO v_has_bank_proof;

    -- 4. NOC / B1 Document
    SELECT EXISTS (
        SELECT 1 FROM documents 
        WHERE entity_type = 'lead' 
          AND entity_id = p_lead_id 
          AND doc_category = 'noc_b1' 
          AND status IN ('UPLOADED', 'VERIFIED')
    ) INTO v_has_noc_b1;

    IF NOT (v_has_ebill AND v_has_aadhaar AND v_has_bank_proof AND v_has_noc_b1) THEN
        RAISE EXCEPTION 'DOCUMENTS_INCOMPLETE: All 5 required documents (Electricity Bill, Aadhaar, Bank Proof, NOC/B1, Site Photo) must be uploaded and valid'
            USING ERRCODE = 'P0004';
    END IF;

    -- PAN is OPTIONAL and is never checked or blocked.

    v_agent_id := v_lead.source_agent_id;

    -- ------------------------------------------------------------------------
    -- STEP 5: DUPLICATE CUSTOMER SAFEGUARDS (NO SILENT MERGE OF CONFLICTS)
    -- ------------------------------------------------------------------------
    SELECT id, customer_code, full_name, primary_mobile, consumer_number
    INTO v_existing_cust
    FROM customers 
    WHERE primary_mobile = v_lead.mobile 
       OR consumer_number = COALESCE(p_consumer_number, v_lead.consumer_number)
    LIMIT 1;

    IF v_existing_cust.id IS NOT NULL THEN
        -- Reject if the names differ, preventing silent hijack of unrelated records
        IF LOWER(BTRIM(v_existing_cust.full_name)) <> LOWER(BTRIM(v_lead.full_name)) THEN
            RAISE EXCEPTION 'DUPLICATE_CUSTOMER: Mobile or consumer number matches customer % (%). Identity mismatch with lead (%). Manual review required.',
                v_existing_cust.customer_code, v_existing_cust.full_name, v_lead.full_name
                USING ERRCODE = 'P0004';
        END IF;

        v_customer_id := v_existing_cust.id;
        v_customer_code := v_existing_cust.customer_code;
    ELSE
        -- --------------------------------------------------------------------
        -- STEP 6: COLLISION-SAFE CUSTOMER CODE GENERATION & SAFE INSERT
        -- --------------------------------------------------------------------
        LOOP
            v_customer_code := 'BNPS-CUST-' || to_char(CURRENT_DATE, 'YYMM') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM customers WHERE customer_code = v_customer_code);
            v_attempts := v_attempts + 1;
            IF v_attempts > 10 THEN
                RAISE EXCEPTION 'SYSTEM_ERROR: Unique customer code generation exceeded maximum attempts'
                    USING ERRCODE = 'P0004';
            END IF;
        END LOOP;

        -- Insert customer using actual lead geography (NO invented defaults)
        INSERT INTO customers (
            customer_code,
            branch,
            full_name,
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
            COALESCE(v_lead.branch, 'Jaijaipur'),
            v_lead.full_name,
            v_lead.mobile,
            v_lead.alternate_phone,
            v_lead.email,
            COALESCE(v_lead.discom_name, 'CSPDCL'),
            COALESCE(p_consumer_number, v_lead.consumer_number),
            v_lead.sanctioned_load_kw,
            v_lead.address_line,
            v_lead.district,
            v_lead.tehsil,
            v_lead.block,
            v_lead.panchayat_village,
            COALESCE(v_lead.state, 'Chhattisgarh'),
            v_lead.pincode,
            'REGISTERED',
            COALESCE(v_lead.is_test, false)
        ) RETURNING id INTO v_customer_id;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 7: ACQUISITION CONSISTENCY (SAFE & IDEMPOTENT)
    -- ------------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM acquisitions WHERE lead_id = p_lead_id AND customer_id <> v_customer_id) THEN
        RAISE EXCEPTION 'DATA_CONFLICT: Lead % is already linked to a conflicting customer acquisition record', v_lead.lead_code
            USING ERRCODE = 'P0004';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM acquisitions WHERE lead_id = p_lead_id) THEN
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
            COALESCE(v_lead.is_test, false)
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 8: UPDATE LEAD STATUS (NO METADATA ROW CLONING)
    -- ------------------------------------------------------------------------
    UPDATE leads 
    SET stage = 'CONVERTED',
        converted_customer_id = v_customer_id,
        updated_at = clock_timestamp()
    WHERE id = p_lead_id;

    -- ------------------------------------------------------------------------
    -- STEP 9: AUDIT LOG ENTRY (ACTOR IS AUTHENTICATED PROFILE)
    -- ------------------------------------------------------------------------
    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    ) VALUES (
        v_actor_id,
        'LEAD_CONVERTED',
        'leads',
        p_lead_id,
        jsonb_build_object(
            'lead_code', v_lead.lead_code,
            'customer_id', v_customer_id,
            'customer_code', v_customer_code,
            'consumer_number', COALESCE(p_consumer_number, v_lead.consumer_number),
            'branch', COALESCE(v_lead.branch, 'Jaijaipur')
        )
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

-- Revoke execute from public/anon, grant only to authenticated
REVOKE EXECUTE ON FUNCTION convert_lead_atomic(UUID, VARCHAR, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION convert_lead_atomic(UUID, VARCHAR, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION convert_lead_atomic(UUID, VARCHAR, UUID) TO authenticated;
