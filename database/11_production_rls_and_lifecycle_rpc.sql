-- ============================================================================
-- BNPS ERP v0.3 — Production RLS Hardening, Atomic Lifecycle & Quotation RPC
-- Organization: Bhumi Nidhi Power Solution (PM Surya Ghar Rooftop Solar)
-- Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- ============================================================================

-- ============================================================================
-- 1. ATOMIC INSTALLATION COMPLETION & CUSTOMER LIFECYCLE PERSISTENCE
-- ============================================================================
-- Business Rule:
-- When an installation is completed:
-- 1. Sets net_meter_installed = true, net_meter_serial_no, discom_inspection_signoff = true.
-- 2. Sets projects status to 'COMPLETED'.
-- 3. Atomically sets customer.lifecycle_status to 'INSTALLED'.
-- 4. Customer record is NEVER deleted, preserving all documents, quotation, and history.
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_installation_atomic(
    p_installation_id UUID,
    p_net_meter_serial_no TEXT,
    p_net_meter_installed_date DATE,
    p_discom_inspection_date DATE,
    p_inspector_name TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_profile_id UUID := current_auth_profile_id();
    v_role user_role_type := current_user_role();
    v_inst RECORD;
    v_project RECORD;
    v_customer RECORD;
BEGIN
    -- 1. Authorization check
    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Profile not found for current session'
            USING ERRCODE = '42501';
    END IF;

    IF v_role NOT IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'technician') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSION: Not authorized to complete installation'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch and lock installation
    SELECT * INTO v_inst FROM installations WHERE id = p_installation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Installation ID % does not exist', p_installation_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 3. Update installation record atomically
    UPDATE installations
    SET 
        net_meter_installed = true,
        net_meter_serial_no = p_net_meter_serial_no,
        net_meter_installed_date = COALESCE(p_net_meter_installed_date, CURRENT_DATE),
        discom_inspection_signoff = true,
        discom_inspection_date = COALESCE(p_discom_inspection_date, CURRENT_DATE),
        inspector_name = COALESCE(p_inspector_name, 'CSPDCL Testing Division'),
        installation_completed_date = COALESCE(p_discom_inspection_date, CURRENT_DATE),
        notes = COALESCE(p_notes, notes),
        updated_at = clock_timestamp()
    WHERE id = p_installation_id;

    -- 4. Update project status to COMPLETED
    UPDATE projects
    SET 
        status = 'COMPLETED',
        updated_at = clock_timestamp()
    WHERE id = v_inst.project_id
    RETURNING * INTO v_project;

    -- 5. Atomically update customer lifecycle_status to INSTALLED
    IF v_project.customer_id IS NOT NULL THEN
        UPDATE customers
        SET 
            lifecycle_status = 'INSTALLED',
            updated_at = clock_timestamp()
        WHERE id = v_project.customer_id
        RETURNING * INTO v_customer;
    END IF;

    -- 6. Insert audit log
    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    ) VALUES (
        v_actor_profile_id,
        'INSTALLATION_COMPLETED',
        'installation',
        p_installation_id,
        jsonb_build_object(
            'installation_id', p_installation_id,
            'project_id', v_inst.project_id,
            'customer_id', v_project.customer_id,
            'net_meter_serial_no', p_net_meter_serial_no,
            'inspector_name', p_inspector_name,
            'customer_lifecycle_status', 'INSTALLED'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'installation_id', p_installation_id,
        'project_id', v_inst.project_id,
        'customer_id', v_project.customer_id,
        'customer_lifecycle_status', 'INSTALLED'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_installation_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_installation_atomic TO authenticated;


-- ============================================================================
-- 2. AUTHORITATIVE QUOTATION FINANCIAL CALCULATION RPC
-- ============================================================================
-- Calculates all statutory financial figures in PostgreSQL using NUMERIC(14,2)
-- Composite solar GST: 13.80%
-- Central DBT Subsidy: 1kW=₹30k, 2kW=₹60k, 3kW+=₹78k
-- Chhattisgarh State Subsidy: <3kW=₹5k, 3-4kW=₹15k, 5kW+=₹25k
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_quotation_financials(
    p_capacity_kw NUMERIC(6, 2),
    p_subtotal_before_tax NUMERIC(14, 2)
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_gst_percentage NUMERIC(5, 2) := 13.80;
    v_gst_amount NUMERIC(12, 2);
    v_gross_cost NUMERIC(14, 2);
    v_central_subsidy NUMERIC(12, 2) := 0.00;
    v_state_subsidy NUMERIC(12, 2) := 0.00;
    v_net_customer_cost NUMERIC(14, 2);
    v_monthly_units INT;
    v_monthly_savings NUMERIC(12, 2);
    v_loan_eligible NUMERIC(14, 2);
    v_monthly_rate NUMERIC(10, 6) := 0.07 / 12.0;
    v_n INT := 60;
    v_est_emi NUMERIC(10, 2);
    v_compound_factor NUMERIC(14, 6);
BEGIN
    IF p_capacity_kw IS NULL OR p_capacity_kw <= 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: System capacity kW must be positive';
    END IF;

    -- GST calculation
    v_gst_amount := ROUND((p_subtotal_before_tax * (v_gst_percentage / 100.0)), 2);
    v_gross_cost := p_subtotal_before_tax + v_gst_amount;

    -- Central PM Surya Ghar DBT Subsidy
    IF p_capacity_kw <= 1.0 THEN
        v_central_subsidy := 30000.00;
    ELSIF p_capacity_kw <= 2.0 THEN
        v_central_subsidy := 60000.00;
    ELSE
        v_central_subsidy := 78000.00;
    END IF;

    -- Chhattisgarh State Renewable Subsidy
    IF p_capacity_kw >= 5.0 THEN
        v_state_subsidy := 25000.00;
    ELSIF p_capacity_kw >= 3.0 THEN
        v_state_subsidy := 15000.00;
    ELSE
        v_state_subsidy := 5000.00;
    END IF;

    -- Net Customer Payable to BNPS (Authoritative Rule: Govt subsidy is DBT benefit paid directly
    -- to eligible customer bank account post-commissioning and does NOT reduce vendor project cost)
    v_net_customer_cost := v_gross_cost;

    -- Savings estimation
    v_monthly_units := ROUND(p_capacity_kw * 4.3 * 30);
    v_monthly_savings := ROUND(v_monthly_units * 6.80, 2);

    -- Loan eligibility & 5-year EMI calculation
    v_loan_eligible := ROUND(v_gross_cost * 0.90, 2);
    v_compound_factor := POWER(1.0 + v_monthly_rate, v_n);
    v_est_emi := ROUND((v_loan_eligible * v_monthly_rate * v_compound_factor) / (v_compound_factor - 1.0), 2);

    RETURN jsonb_build_object(
        'capacity_kw', p_capacity_kw,
        'subtotal_before_tax', p_subtotal_before_tax,
        'gst_percentage', v_gst_percentage,
        'gst_amount', v_gst_amount,
        'total_project_cost', v_gross_cost,
        'central_subsidy_amount', v_central_subsidy,
        'state_subsidy_amount', v_state_subsidy,
        'net_customer_cost', v_net_customer_cost,
        'monthly_units_est', v_monthly_units,
        'monthly_savings_est', v_monthly_savings,
        'annual_savings_est', ROUND(v_monthly_savings * 12.0, 2),
        'loan_eligible_amount', v_loan_eligible,
        'est_monthly_emi', v_est_emi
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION calculate_quotation_financials FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_quotation_financials TO authenticated;


-- ============================================================================
-- 3. HARDENED DOCUMENT RLS POLICY & AGENT ISOLATION
-- ============================================================================
-- Enforces:
-- 1. Management roles can review all documents.
-- 2. Agent A CANNOT see Agent B's PAN, Aadhaar, Bank documents or metadata.
-- 3. Agent can ONLY view documents linked to their own agent ID.
-- ============================================================================

DROP POLICY IF EXISTS documents_select_policy ON documents;

CREATE POLICY documents_select_policy
ON documents
FOR SELECT
TO authenticated
USING (
    has_erp_permission('document.view')
    OR (
        current_user_role() = 'agent'
        AND entity_type = 'agent'
        AND entity_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        )
    )
    OR (
        current_user_role() = 'agent'
        AND entity_type = 'lead'
        AND entity_id IN (
            SELECT id FROM leads WHERE source_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    )
);

-- ============================================================================
-- 4. PRIVATE STORAGE POLICIES FOR SENSITIVE DOCUMENTS BUCKET
-- ============================================================================

DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;

CREATE POLICY "documents_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND (
        public.has_erp_permission('document.view')
        OR (
            public.current_user_role() = 'agent'
            AND (storage.foldername(name))[1] = 'agents'
            AND (storage.foldername(name))[2] IN (
                SELECT id::text FROM public.agents WHERE profile_id = public.current_auth_profile_id()
            )
        )
    )
);
