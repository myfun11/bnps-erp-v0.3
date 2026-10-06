-- ============================================================================
-- BNPS ERP v0.3 — Phase 1: Authoritative Business RPC Functions
-- Organization: Bhumi Nidhi Power Solution
-- ============================================================================

-- 1. ATOMIC LEAD CONVERSION COMMAND
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
BEGIN
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
        p_actor_id,
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


-- 2. ATOMIC MULTI-TIER COMMISSION GENERATION
CREATE OR REPLACE FUNCTION generate_project_commission_atomic(
    p_project_id UUID,
    p_payment_stage payment_stage_type,
    p_actor_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_project RECORD;
    v_payment_paid BOOLEAN;
    v_base_amount NUMERIC(12, 2);
    v_current_agent_id UUID;
    v_curr_level INT := 10;
    v_sponsor_id UUID;
    v_rate_pct NUMERIC(5, 2);
    v_gross NUMERIC(12, 2);
    v_tds_pct NUMERIC(5, 2);
    v_tds_amt NUMERIC(12, 2);
    v_net NUMERIC(12, 2);
    v_hierarchy_tree JSONB := '[]'::JSONB;
    v_count INT := 0;
BEGIN
    -- 1. Lock Project Record
    SELECT * INTO v_project FROM projects WHERE id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Project % not found', p_project_id USING ERRCODE = 'P0002';
    END IF;

    -- 2. Validate Payment is PAID for this stage
    SELECT EXISTS (
        SELECT 1 FROM payments 
        WHERE project_id = p_project_id 
          AND stage = p_payment_stage 
          AND status = 'PAID'
    ) INTO v_payment_paid;

    IF NOT v_payment_paid THEN
        RAISE EXCEPTION 'PAYMENT_NOT_APPROVED: Cannot generate commission until payment stage % is PAID', p_payment_stage 
        USING ERRCODE = 'P0004';
    END IF;

    -- 3. Check for existing commission generation to prevent duplicate race conditions
    SELECT EXISTS (
        SELECT 1 FROM commission_transactions
        WHERE project_id = p_project_id AND payment_stage = p_payment_stage
    ) INTO v_payment_paid;

    IF v_payment_paid THEN
        RAISE EXCEPTION 'COMMISSION_ALREADY_GENERATED: Commission for stage % on project % already generated', p_payment_stage, v_project.project_code
        USING ERRCODE = 'P0005';
    END IF;

    -- 4. Calculate Base Amount (Contract Value excluding subsidy/GST)
    v_base_amount := v_project.total_contract_amount;
    v_current_agent_id := v_project.primary_agent_id;

    -- 5. Traverse upline hierarchy (Position 10 down to Position 1)
    WHILE v_current_agent_id IS NOT NULL AND v_curr_level >= 1 LOOP
        -- Fetch default rate for this position
        SELECT default_rate_percent INTO v_rate_pct 
        FROM commission_rates WHERE position = v_curr_level;

        IF v_rate_pct IS NULL THEN
            IF v_curr_level = 10 THEN v_rate_pct := 7.00;
            ELSIF v_curr_level IN (9, 8) THEN v_rate_pct := 1.00;
            ELSE v_rate_pct := 0.50;
            END IF;
        END IF;

        -- Fetch agent profile & sponsor
        SELECT sponsor_agent_id, tds_percentage INTO v_sponsor_id, v_tds_pct
        FROM agents WHERE id = v_current_agent_id;

        IF v_tds_pct IS NULL THEN v_tds_pct := 5.00; END IF;

        v_gross := ROUND((v_base_amount * v_rate_pct / 100.00), 2);
        v_tds_amt := ROUND((v_gross * v_tds_pct / 100.00), 2);
        v_net := v_gross - v_tds_amt;

        -- Build snapshot
        v_hierarchy_tree := v_hierarchy_tree || jsonb_build_object(
            'position', v_curr_level,
            'agent_id', v_current_agent_id,
            'rate_percent', v_rate_pct,
            'gross', v_gross,
            'tds', v_tds_amt,
            'net', v_net
        );

        -- Insert Commission Transaction (Deterministic Idempotency Key)
        INSERT INTO commission_transactions (
            project_id,
            payment_stage,
            position,
            agent_id,
            base_amount,
            rate_percent,
            gross_commission,
            tds_rate_percent,
            tds_amount,
            net_commission,
            hierarchy_snapshot,
            is_test
        ) VALUES (
            p_project_id,
            p_payment_stage,
            v_curr_level,
            v_current_agent_id,
            v_base_amount,
            v_rate_pct,
            v_gross,
            v_tds_pct,
            v_tds_amt,
            v_net,
            v_hierarchy_tree,
            v_project.is_test
        );

        -- Update agent earned balance
        UPDATE agents 
        SET total_commission_earned = total_commission_earned + v_net,
            updated_at = clock_timestamp()
        WHERE id = v_current_agent_id;

        v_count := v_count + 1;
        v_current_agent_id := v_sponsor_id;
        v_curr_level := v_curr_level - 1;
    END LOOP;

    -- Update project commission flag
    UPDATE projects SET commission_distributed = true WHERE id = p_project_id;

    -- Audit Log
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_data)
    VALUES (p_actor_id, 'COMMISSION_GENERATED', 'projects', p_project_id, jsonb_build_object(
        'payment_stage', p_payment_stage,
        'positions_generated', v_count,
        'base_amount', v_base_amount
    ));

    RETURN jsonb_build_object(
        'success', true,
        'project_code', v_project.project_code,
        'payment_stage', p_payment_stage,
        'positions_processed', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 3. GLOBAL UNIFIED SEARCH FUNCTION
CREATE OR REPLACE FUNCTION global_erp_search(p_query TEXT, p_max_limit INT DEFAULT 20)
RETURNS TABLE (
    entity_type TEXT,
    entity_id UUID,
    primary_label TEXT,
    secondary_label TEXT,
    status_label TEXT,
    created_date TIMESTAMPTZ
) AS $$
DECLARE
    v_clean_q TEXT := TRIM(p_query);
BEGIN
    RETURN QUERY
    -- 1. Search Customers
    SELECT 
        'customer'::TEXT,
        c.id,
        (c.customer_code || ' • ' || c.full_name)::TEXT,
        ('Mob: ' || c.primary_mobile || ' | Consumer: ' || c.consumer_number)::TEXT,
        c.lifecycle_status::TEXT,
        c.created_at
    FROM customers c
    WHERE c.customer_code ILIKE '%' || v_clean_q || '%'
       OR c.full_name ILIKE '%' || v_clean_q || '%'
       OR c.primary_mobile ILIKE '%' || v_clean_q || '%'
       OR c.consumer_number ILIKE '%' || v_clean_q || '%'

    UNION ALL

    -- 2. Search Leads
    SELECT 
        'lead'::TEXT,
        l.id,
        (l.lead_code || ' • ' || l.full_name)::TEXT,
        ('Mob: ' || l.mobile || ' | Stage: ' || l.stage::TEXT)::TEXT,
        l.stage::TEXT,
        l.created_at
    FROM leads l
    WHERE l.lead_code ILIKE '%' || v_clean_q || '%'
       OR l.full_name ILIKE '%' || v_clean_q || '%'
       OR l.mobile ILIKE '%' || v_clean_q || '%'

    UNION ALL

    -- 3. Search Projects
    SELECT 
        'project'::TEXT,
        pr.id,
        (pr.project_code || ' • ' || pr.capacity_kw::TEXT || ' kW')::TEXT,
        ('Total: ₹' || pr.total_contract_amount::TEXT)::TEXT,
        pr.status::TEXT,
        pr.created_at
    FROM projects pr
    WHERE pr.project_code ILIKE '%' || v_clean_q || '%'

    UNION ALL

    -- 4. Search PMSG Applications
    SELECT 
        'pmsg_application'::TEXT,
        pm.id,
        ('PMSG: ' || pm.portal_application_no)::TEXT,
        ('Capacity: ' || COALESCE(pm.registered_capacity_kw::TEXT, '0') || ' kW')::TEXT,
        pm.stage::TEXT,
        pm.created_at
    FROM pmsg_tracking pm
    WHERE pm.portal_application_no ILIKE '%' || v_clean_q || '%'

    LIMIT p_max_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- LEAD CREATION — ATOMIC AUTHORITATIVE DB COMMAND
-- ============================================================================
-- Purpose:
--   Creates a Lead entirely inside PostgreSQL.
--
-- Security:
--   - Actor is derived from the authenticated Supabase session.
--   - Agent source ownership is validated server-side.
--   - Lead ID is generated by PostgreSQL.
--   - Lead code is generated server-side.
--   - Lead creation and audit logging happen in one transaction.
--
-- Important:
--   Do NOT trust client-supplied actor/profile IDs for authorization.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_lead_atomic(
    p_source_agent_id UUID DEFAULT NULL,
    p_assigned_officer_id UUID DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_mobile VARCHAR(15) DEFAULT NULL,
    p_alternate_phone VARCHAR(15) DEFAULT NULL,
    p_email CITEXT DEFAULT NULL,
    p_discom_name TEXT DEFAULT 'CSPDCL',
    p_consumer_number VARCHAR(64) DEFAULT NULL,
    p_sanctioned_load_kw NUMERIC(6, 2) DEFAULT NULL,
    p_proposed_capacity_kw NUMERIC(6, 2) DEFAULT NULL,
    p_address_line TEXT DEFAULT NULL,
    p_state TEXT DEFAULT 'Chhattisgarh',
    p_district TEXT DEFAULT NULL,
    p_tehsil TEXT DEFAULT NULL,
    p_block TEXT DEFAULT NULL,
    p_panchayat_village TEXT DEFAULT NULL,
    p_pincode VARCHAR(10) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_is_test BOOLEAN DEFAULT false
)
RETURNS JSONB
AS $$
DECLARE
    v_actor_id UUID;
    v_role user_role_type;
    v_agent_id UUID;
    v_lead_id UUID;
    v_lead_code VARCHAR(32);
    v_lead RECORD;
    v_seq BIGINT;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. AUTHENTICATED ACTOR
    -- ------------------------------------------------------------------------

    v_actor_id := current_auth_profile_id();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP profile not found for current user'
            USING ERRCODE = 'P0001';
    END IF;

    v_role := current_user_role();

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP role not found for current user'
            USING ERRCODE = 'P0001';
    END IF;


    -- ------------------------------------------------------------------------
    -- 2. BASIC INPUT VALIDATION
    -- ------------------------------------------------------------------------

    IF NULLIF(BTRIM(p_full_name), '') IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Applicant name is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(BTRIM(p_mobile), '') IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Mobile number is required'
            USING ERRCODE = 'P0004';
    END IF;


    -- ------------------------------------------------------------------------
    -- 3. SOURCE AGENT SECURITY
    --
    -- Agent users cannot create a lead for another agent.
    -- Their own agent record is derived from their authenticated profile.
    -- ------------------------------------------------------------------------

    IF v_role = 'agent' THEN

        SELECT a.id
        INTO v_agent_id
        FROM agents a
        WHERE a.profile_id = v_actor_id
          AND a.is_active = true
        LIMIT 1;

        IF v_agent_id IS NULL THEN
            RAISE EXCEPTION 'AUTH_REQUIRED: Active agent record not found for current user'
                USING ERRCODE = 'P0001';
        END IF;

        IF p_source_agent_id IS NOT NULL
           AND p_source_agent_id <> v_agent_id THEN
            RAISE EXCEPTION 'FORBIDDEN: Agent cannot create a lead for another agent'
                USING ERRCODE = 'P0005';
        END IF;

        v_agent_id := v_agent_id;

    ELSE

        -- For non-agent users, only an explicitly supplied valid agent
        -- may be used as the source agent.
        IF p_source_agent_id IS NOT NULL THEN

            SELECT a.id
            INTO v_agent_id
            FROM agents a
            WHERE a.id = p_source_agent_id
              AND a.is_active = true
            LIMIT 1;

            IF v_agent_id IS NULL THEN
                RAISE EXCEPTION 'VALIDATION_ERROR: Source agent not found or inactive'
                    USING ERRCODE = 'P0004';
            END IF;

        ELSE
            v_agent_id := NULL;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- 4. ASSIGNED OFFICER VALIDATION
    -- ------------------------------------------------------------------------

    IF p_assigned_officer_id IS NOT NULL THEN

        PERFORM 1
        FROM profiles p
        WHERE p.id = p_assigned_officer_id
          AND p.is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: Assigned officer not found or inactive'
                USING ERRCODE = 'P0004';
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5. SERVER-SIDE LEAD CODE
    --
    -- Uses a transaction-safe PostgreSQL sequence instead of:
    --   COUNT(*) + 1
    --
    -- The sequence is defined once at database level in the DDL.
    -- ------------------------------------------------------------------------

        v_seq := nextval('leads_lead_code_seq');

    v_lead_code :=
        'LD-' ||
        TO_CHAR(CURRENT_DATE, 'YYMM') ||
        '-' ||
        LPAD(v_seq::TEXT, 6, '0');


    -- ------------------------------------------------------------------------
    -- 6. ATOMIC LEAD INSERT
    -- ------------------------------------------------------------------------

    INSERT INTO leads (
        lead_code,
        branch,
        source_agent_id,
        assigned_officer_id,
        full_name,
        mobile,
        alternate_phone,
        email,
        discom_name,
        consumer_number,
        sanctioned_load_kw,
        proposed_capacity_kw,
        address_line,
        state,
        district,
        tehsil,
        block,
        panchayat_village,
        pincode,
        stage,
        notes,
        is_test
    )
    VALUES (
        v_lead_code,
        (
            SELECT branch
            FROM profiles
            WHERE id = v_actor_id
            LIMIT 1
        ),
        v_agent_id,
        p_assigned_officer_id,
        BTRIM(p_full_name),
        BTRIM(p_mobile),
        NULLIF(BTRIM(p_alternate_phone), ''),
        p_email,
        COALESCE(NULLIF(BTRIM(p_discom_name), ''), 'CSPDCL'),
        NULLIF(BTRIM(p_consumer_number), ''),
        p_sanctioned_load_kw,
        p_proposed_capacity_kw,
        NULLIF(BTRIM(p_address_line), ''),
        COALESCE(NULLIF(BTRIM(p_state), ''), 'Chhattisgarh'),
        NULLIF(BTRIM(p_district), ''),
        NULLIF(BTRIM(p_tehsil), ''),
        NULLIF(BTRIM(p_block), ''),
        NULLIF(BTRIM(p_panchayat_village), ''),
        NULLIF(BTRIM(p_pincode), ''),
        'NEW',
        NULLIF(BTRIM(p_notes), ''),
        COALESCE(p_is_test, false)
    )
    RETURNING *
    INTO v_lead;


    -- ------------------------------------------------------------------------
    -- 7. AUTHORITATIVE AUDIT LOG
    -- ------------------------------------------------------------------------

    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    )
    VALUES (
        v_actor_id,
        'LEAD_CREATED',
        'leads',
        v_lead.id,
        jsonb_build_object(
            'lead_code', v_lead.lead_code,
            'full_name', v_lead.full_name,
            'mobile', v_lead.mobile,
            'source_agent_id', v_lead.source_agent_id,
            'assigned_officer_id', v_lead.assigned_officer_id,
            'stage', v_lead.stage,
            'is_test', v_lead.is_test
        )
    );


    -- ------------------------------------------------------------------------
    -- 8. RETURN AUTHORITATIVE DATABASE RECORD
    -- ------------------------------------------------------------------------

    RETURN jsonb_build_object(
        'success', true,
        'lead', to_jsonb(v_lead)
    );

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'DUPLICATE_RECORD: Lead could not be created because a unique value already exists'
            USING ERRCODE = '23505';

    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Referenced record does not exist'
            USING ERRCODE = '23503';
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;


-- Only authenticated Supabase users should be able to invoke this command.
REVOKE ALL ON FUNCTION create_lead_atomic(
    UUID,
    UUID,
    TEXT,
    VARCHAR(15),
    VARCHAR(15),
    CITEXT,
    TEXT,
    VARCHAR(64),
    NUMERIC(6,2),
    NUMERIC(6,2),
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    VARCHAR(10),
    TEXT,
    BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_lead_atomic(
    UUID,
    UUID,
    TEXT,
    VARCHAR(15),
    VARCHAR(15),
    CITEXT,
    TEXT,
    VARCHAR(64),
    NUMERIC(6,2),
    NUMERIC(6,2),
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    VARCHAR(10),
    TEXT,
    BOOLEAN
) TO authenticated;

-- ============================================================================
-- DOCUMENT BUSINESS COMMANDS — AUTHORITATIVE DATABASE RPCs
-- ============================================================================
-- Purpose:
--   All document business writes are performed through SECURITY DEFINER RPCs.
--
-- Security:
--   - Actor is always derived from the authenticated Supabase session.
--   - Client-supplied actor IDs are never trusted.
--   - Permission checks are performed server-side.
--   - Document state transitions are controlled here.
--   - Every successful business action creates an audit log.
--   - Direct client INSERT/UPDATE/DELETE remains blocked by RLS.
-- ============================================================================


-- ============================================================================
-- 1. CREATE DOCUMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION create_document_atomic(
    p_entity_type VARCHAR(64),
    p_entity_id UUID,
    p_doc_category VARCHAR(64),
    p_file_name TEXT,
    p_file_path TEXT,
    p_mime_type VARCHAR(64),
    p_file_size_bytes BIGINT DEFAULT NULL,
    p_is_test BOOLEAN DEFAULT false
)
RETURNS JSONB
AS $$
DECLARE
    v_actor_id UUID;
    v_document RECORD;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. AUTHENTICATED ACTOR
    -- ------------------------------------------------------------------------

    v_actor_id := current_auth_profile_id();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION
            'AUTH_REQUIRED: Active ERP profile not found for current user'
            USING ERRCODE = 'P0001';
    END IF;


    -- ------------------------------------------------------------------------
    -- 2. PERMISSION
    -- ------------------------------------------------------------------------

    IF NOT has_erp_permission('document.upload') THEN
        RAISE EXCEPTION
            'FORBIDDEN: User does not have document.upload permission'
            USING ERRCODE = 'P0005';
    END IF;


    -- ------------------------------------------------------------------------
    -- 3. INPUT VALIDATION
    -- ------------------------------------------------------------------------

    IF NULLIF(BTRIM(p_entity_type), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Entity type is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF p_entity_id IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Entity ID is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(BTRIM(p_doc_category), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Document category is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(BTRIM(p_file_name), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: File name is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(BTRIM(p_file_path), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: File path is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(BTRIM(p_mime_type), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: MIME type is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF p_file_size_bytes IS NOT NULL AND p_file_size_bytes < 0 THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: File size cannot be negative'
            USING ERRCODE = 'P0004';
    END IF;


    -- ------------------------------------------------------------------------
    -- 4. ENTITY TYPE VALIDATION
    -- ------------------------------------------------------------------------

    IF LOWER(BTRIM(p_entity_type)) NOT IN (
        'lead',
        'customer',
        'project',
        'agent',
        'installation',
        'loan'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Unsupported document entity type: %',
            p_entity_type
            USING ERRCODE = 'P0004';
    END IF;


    -- ------------------------------------------------------------------------
    -- 5. ENTITY EXISTENCE VALIDATION
    -- ------------------------------------------------------------------------
    -- Entity IDs are validated against their authoritative tables.
    -- This prevents orphan document metadata.

    IF LOWER(BTRIM(p_entity_type)) = 'lead' THEN

        PERFORM 1 FROM leads WHERE id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'RECORD_NOT_FOUND: Lead % does not exist',
                p_entity_id
                USING ERRCODE = 'P0002';
        END IF;

    ELSIF LOWER(BTRIM(p_entity_type)) = 'customer' THEN

        PERFORM 1 FROM customers WHERE id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'RECORD_NOT_FOUND: Customer % does not exist',
                p_entity_id
                USING ERRCODE = 'P0002';
        END IF;

    ELSIF LOWER(BTRIM(p_entity_type)) = 'project' THEN

        PERFORM 1 FROM projects WHERE id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'RECORD_NOT_FOUND: Project % does not exist',
                p_entity_id
                USING ERRCODE = 'P0002';
        END IF;

    ELSIF LOWER(BTRIM(p_entity_type)) = 'agent' THEN

        PERFORM 1 FROM agents WHERE id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'RECORD_NOT_FOUND: Agent % does not exist',
                p_entity_id
                USING ERRCODE = 'P0002';
        END IF;

    ELSIF LOWER(BTRIM(p_entity_type)) = 'installation' THEN

        PERFORM 1 FROM installations WHERE id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'RECORD_NOT_FOUND: Installation % does not exist',
                p_entity_id
                USING ERRCODE = 'P0002';
        END IF;

    ELSIF LOWER(BTRIM(p_entity_type)) = 'loan' THEN

        PERFORM 1 FROM loans WHERE id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'RECORD_NOT_FOUND: Loan % does not exist',
                p_entity_id
                USING ERRCODE = 'P0002';
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- 6. AUTHORITATIVE DOCUMENT INSERT
    -- ------------------------------------------------------------------------

    INSERT INTO documents (
        entity_type,
        entity_id,
        doc_category,
        file_name,
        file_path,
        mime_type,
        file_size_bytes,
        status,
        is_test
    )
    VALUES (
        LOWER(BTRIM(p_entity_type)),
        p_entity_id,
        LOWER(BTRIM(p_doc_category)),
        BTRIM(p_file_name),
        BTRIM(p_file_path),
        BTRIM(p_mime_type),
        p_file_size_bytes,
        'UPLOADED',
        COALESCE(p_is_test, false)
    )
    RETURNING *
    INTO v_document;


    -- ------------------------------------------------------------------------
    -- 7. AUDIT TRAIL
    -- ------------------------------------------------------------------------

    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    )
    VALUES (
        v_actor_id,
        'DOCUMENT_UPLOADED',
        'documents',
        v_document.id,
        jsonb_build_object(
            'document_id', v_document.id,
            'entity_type', v_document.entity_type,
            'entity_id', v_document.entity_id,
            'doc_category', v_document.doc_category,
            'file_name', v_document.file_name,
            'mime_type', v_document.mime_type,
            'file_size_bytes', v_document.file_size_bytes,
            'status', v_document.status,
            'is_test', v_document.is_test
        )
    );


    -- ------------------------------------------------------------------------
    -- 8. RETURN AUTHORITATIVE RECORD
    -- ------------------------------------------------------------------------

    RETURN jsonb_build_object(
        'success', true,
        'document', to_jsonb(v_document)
    );

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION
            'DUPLICATE_RECORD: Document could not be created because a unique value already exists'
            USING ERRCODE = '23505';

    WHEN foreign_key_violation THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Referenced record does not exist'
            USING ERRCODE = '23503';
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;


-- ============================================================================
-- 2. VERIFY DOCUMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_document_atomic(
    p_document_id UUID
)
RETURNS JSONB
AS $$
DECLARE
    v_actor_id UUID;
    v_document RECORD;
    v_old_data JSONB;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. AUTHENTICATED ACTOR
    -- ------------------------------------------------------------------------

    v_actor_id := current_auth_profile_id();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION
            'AUTH_REQUIRED: Active ERP profile not found for current user'
            USING ERRCODE = 'P0001';
    END IF;


    -- ------------------------------------------------------------------------
    -- 2. PERMISSION
    -- ------------------------------------------------------------------------

    IF NOT has_erp_permission('document.verify') THEN
        RAISE EXCEPTION
            'FORBIDDEN: User does not have document.verify permission'
            USING ERRCODE = 'P0005';
    END IF;


    -- ------------------------------------------------------------------------
    -- 3. LOCK DOCUMENT
    -- ------------------------------------------------------------------------

    SELECT *
    INTO v_document
    FROM documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'RECORD_NOT_FOUND: Document % does not exist',
            p_document_id
            USING ERRCODE = 'P0002';
    END IF;


    -- ------------------------------------------------------------------------
    -- 4. STATE VALIDATION
    -- ------------------------------------------------------------------------

    IF v_document.status = 'VERIFIED' THEN
        RAISE EXCEPTION
            'INVALID_TRANSITION: Document is already verified'
            USING ERRCODE = 'P0003';
    END IF;

    IF v_document.status = 'REJECTED' THEN
        RAISE EXCEPTION
            'INVALID_TRANSITION: Rejected document must be uploaded again before verification'
            USING ERRCODE = 'P0003';
    END IF;


    v_old_data := to_jsonb(v_document);


    -- ------------------------------------------------------------------------
    -- 5. VERIFY
    -- ------------------------------------------------------------------------

    UPDATE documents
    SET status = 'VERIFIED',
        verified_by = v_actor_id,
        verified_at = clock_timestamp(),
        rejection_reason = NULL
    WHERE id = p_document_id
    RETURNING *
    INTO v_document;


    -- ------------------------------------------------------------------------
    -- 6. AUDIT TRAIL
    -- ------------------------------------------------------------------------

    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data
    )
    VALUES (
        v_actor_id,
        'DOCUMENT_VERIFIED',
        'documents',
        p_document_id,
        v_old_data,
        to_jsonb(v_document)
    );


    RETURN jsonb_build_object(
        'success', true,
        'document', to_jsonb(v_document)
    );
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;


-- ============================================================================
-- 3. REJECT DOCUMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_document_atomic(
    p_document_id UUID,
    p_rejection_reason TEXT
)
RETURNS JSONB
AS $$
DECLARE
    v_actor_id UUID;
    v_document RECORD;
    v_old_data JSONB;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. AUTHENTICATED ACTOR
    -- ------------------------------------------------------------------------

    v_actor_id := current_auth_profile_id();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION
            'AUTH_REQUIRED: Active ERP profile not found for current user'
            USING ERRCODE = 'P0001';
    END IF;


    -- ------------------------------------------------------------------------
    -- 2. PERMISSION
    -- ------------------------------------------------------------------------

    IF NOT has_erp_permission('document.reject') THEN
        RAISE EXCEPTION
            'FORBIDDEN: User does not have document.reject permission'
            USING ERRCODE = 'P0005';
    END IF;


    -- ------------------------------------------------------------------------
    -- 3. VALIDATE REJECTION REASON
    -- ------------------------------------------------------------------------

    IF NULLIF(BTRIM(p_rejection_reason), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Rejection reason is required'
            USING ERRCODE = 'P0004';
    END IF;


    -- ------------------------------------------------------------------------
    -- 4. LOCK DOCUMENT
    -- ------------------------------------------------------------------------

    SELECT *
    INTO v_document
    FROM documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'RECORD_NOT_FOUND: Document % does not exist',
            p_document_id
            USING ERRCODE = 'P0002';
    END IF;


    -- ------------------------------------------------------------------------
    -- 5. STATE VALIDATION
    -- ------------------------------------------------------------------------

    IF v_document.status = 'VERIFIED' THEN
        RAISE EXCEPTION
            'INVALID_TRANSITION: Verified document cannot be rejected'
            USING ERRCODE = 'P0003';
    END IF;


    v_old_data := to_jsonb(v_document);


    -- ------------------------------------------------------------------------
    -- 6. REJECT
    -- ------------------------------------------------------------------------

    UPDATE documents
    SET status = 'REJECTED',
        verified_by = NULL,
        verified_at = NULL,
        rejection_reason = BTRIM(p_rejection_reason)
    WHERE id = p_document_id
    RETURNING *
    INTO v_document;


    -- ------------------------------------------------------------------------
    -- 7. AUDIT TRAIL
    -- ------------------------------------------------------------------------

    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data
    )
    VALUES (
        v_actor_id,
        'DOCUMENT_REJECTED',
        'documents',
        p_document_id,
        v_old_data,
        to_jsonb(v_document)
    );


    RETURN jsonb_build_object(
        'success', true,
        'document', to_jsonb(v_document)
    );
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;


-- ============================================================================
-- DOCUMENT RPC EXECUTION PRIVILEGES
-- ============================================================================

REVOKE ALL ON FUNCTION create_document_atomic(
    VARCHAR(64),
    UUID,
    VARCHAR(64),
    TEXT,
    TEXT,
    VARCHAR(64),
    BIGINT,
    BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_document_atomic(
    VARCHAR(64),
    UUID,
    VARCHAR(64),
    TEXT,
    TEXT,
    VARCHAR(64),
    BIGINT,
    BOOLEAN
) TO authenticated;


REVOKE ALL ON FUNCTION verify_document_atomic(
    UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION verify_document_atomic(
    UUID
) TO authenticated;


REVOKE ALL ON FUNCTION reject_document_atomic(
    UUID,
    TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION reject_document_atomic(
    UUID,
    TEXT
) TO authenticated;

-- ============================================================================
-- RPC EXECUTION SECURITY
-- Only authenticated Supabase users may invoke business commands.
-- ============================================================================

REVOKE ALL ON FUNCTION convert_lead_atomic(
    UUID,
    VARCHAR(64),
    UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION convert_lead_atomic(
    UUID,
    VARCHAR(64),
    UUID
) TO authenticated;


REVOKE ALL ON FUNCTION generate_project_commission_atomic(
    UUID,
    payment_stage_type,
    UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION generate_project_commission_atomic(
    UUID,
    payment_stage_type,
    UUID
) TO authenticated;
