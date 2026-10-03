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
            full_name,
            primary_mobile,
            alternate_mobile,
            email,
            discom_name,
            consumer_number,
            installation_address,
            district,
            pincode,
            lifecycle_status,
            is_test
        ) VALUES (
            v_customer_code,
            v_lead.full_name,
            v_lead.mobile,
            v_lead.alternate_phone,
            v_lead.email,
            v_lead.discom_name,
            COALESCE(p_consumer_number, v_lead.consumer_number, 'PENDING-' || v_customer_code),
            COALESCE(v_lead.address_line, 'Address Pending Site Survey'),
            COALESCE(v_lead.district, 'Jaipur'),
            COALESCE(v_lead.pincode, '302001'),
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

    -- 4. Initialize PMSG Tracking if not already created
    INSERT INTO pmsg_tracking (
        customer_id,
        stage,
        registered_capacity_kw,
        is_test
    ) VALUES (
        v_customer_id,
        'INITIATED',
        v_lead.proposed_capacity_kw,
        v_lead.is_test
    ) ON CONFLICT (customer_id) DO NOTHING;

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
