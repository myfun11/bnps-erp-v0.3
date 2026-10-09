-- ============================================================================
-- BNPS ERP v0.3
-- 10_QUOTATIONS_TABLE_DDL_AND_RPC.SQL
-- Authoritative PostgreSQL DDL & RLS for Rooftop Solar Quotations
-- ============================================================================

-- 1. Quotation Status Enum
DO $$ BEGIN
    CREATE TYPE quotation_status_type AS ENUM (
        'DRAFT',
        'SENT',
        'ACCEPTED',
        'CONVERTED',
        'EXPIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Quotations Table Definition
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_no VARCHAR(64) NOT NULL UNIQUE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    lead_code VARCHAR(32),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address_line TEXT,
    state VARCHAR(64) DEFAULT 'Chhattisgarh',
    district VARCHAR(64),
    tehsil VARCHAR(64),
    block VARCHAR(64),
    panchayat_village VARCHAR(128),
    pincode VARCHAR(10),
    branch VARCHAR(64) DEFAULT 'Jaijaipur',
    consumer_number VARCHAR(64),
    sanctioned_load_kw NUMERIC(6, 2),
    discom_name VARCHAR(128) DEFAULT 'CSPDCL',
    roof_type VARCHAR(64),
    system_type VARCHAR(32) DEFAULT 'ON_GRID',
    cell_type VARCHAR(64) DEFAULT 'Bifacial DCR',
    solar_brand VARCHAR(128) DEFAULT 'Waaree / Tier-1 Solar',
    module_type VARCHAR(64),
    module_quantity INT,
    module_wattage_wp NUMERIC(6, 2) DEFAULT 550,
    panel_unit_price NUMERIC(12, 2),
    panel_total_price NUMERIC(12, 2),
    inverter_brand VARCHAR(128) DEFAULT 'Growatt',
    inverter_kw NUMERIC(6, 2),
    inverter_model VARCHAR(128),
    inverter_price NUMERIC(12, 2),
    structure_type VARCHAR(64) DEFAULT 'ELEVATED_GI_HOT_DIP',
    structure_price NUMERIC(12, 2),
    battery_capacity_kwh NUMERIC(6, 2),
    battery_brand VARCHAR(128),
    battery_price NUMERIC(12, 2),
    installation_charge NUMERIC(12, 2) DEFAULT 0.00,
    transport_other_charge NUMERIC(12, 2) DEFAULT 0.00,
    equipment_items JSONB DEFAULT '[]'::jsonb,
    capacity_kw NUMERIC(6, 2) NOT NULL,
    rate_per_kw NUMERIC(12, 2),
    subtotal_cost NUMERIC(14, 2),
    gst_percentage NUMERIC(5, 2) DEFAULT 13.80,
    gst_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_project_cost NUMERIC(14, 2) NOT NULL,
    central_subsidy_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    state_subsidy_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_customer_cost NUMERIC(14, 2) NOT NULL,
    monthly_savings_est NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    annual_savings_est NUMERIC(14, 2),
    payback_period_years NUMERIC(4, 1),
    lifetime_savings_est NUMERIC(14, 2),
    loan_eligible_amount NUMERIC(14, 2),
    est_monthly_emi NUMERIC(10, 2),
    status quotation_status_type NOT NULL DEFAULT 'SENT',
    valid_until DATE,
    prepared_by VARCHAR(128),
    notes TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_branch ON quotations(branch);

-- 3. Row Level Security on Quotations Table
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotations_select_policy ON quotations;
CREATE POLICY quotations_select_policy ON quotations
    FOR SELECT TO authenticated
    USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'accountant', 'field_officer', 'backoffice')
        OR (current_user_role() = 'agent' AND lead_id IN (
            SELECT id FROM leads WHERE source_agent_id = current_auth_profile_id()
        ))
    );

DROP POLICY IF EXISTS quotations_insert_policy ON quotations;
CREATE POLICY quotations_insert_policy ON quotations
    FOR INSERT TO authenticated
    WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice', 'agent')
    );

DROP POLICY IF EXISTS quotations_update_policy ON quotations;
CREATE POLICY quotations_update_policy ON quotations
    FOR UPDATE TO authenticated
    USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice')
    )
    WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice')
    );

-- 4. Atomic RPC to Convert Quotation to Customer & Project
CREATE OR REPLACE FUNCTION convert_quotation_to_customer_atomic(
    p_quotation_id UUID,
    p_actor_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_quot RECORD;
    v_customer_id UUID;
    v_project_id UUID;
    v_installation_id UUID;
    v_agent_id UUID;
    v_customer_code VARCHAR(32);
    v_project_code VARCHAR(32);
    v_res JSONB;
BEGIN
    SELECT * INTO v_quot FROM quotations WHERE id = p_quotation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Quotation ID % does not exist', p_quotation_id USING ERRCODE = 'P0002';
    END IF;

    IF v_quot.status = 'CONVERTED' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Quotation % is already converted', v_quot.quotation_no USING ERRCODE = 'P0003';
    END IF;

    -- Determine primary sourcing agent
    IF v_quot.lead_id IS NOT NULL THEN
        SELECT source_agent_id INTO v_agent_id FROM leads WHERE id = v_quot.lead_id;
    END IF;
    IF v_agent_id IS NULL THEN
        SELECT id INTO v_agent_id FROM agents WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- Check if Customer exists or create new
    IF v_quot.customer_id IS NOT NULL THEN
        v_customer_id := v_quot.customer_id;
    ELSE
        SELECT id INTO v_customer_id FROM customers WHERE primary_mobile = v_quot.phone LIMIT 1;
        IF v_customer_id IS NULL THEN
            v_customer_code := 'BNPS-CUST-' || to_char(CURRENT_DATE, 'YYMM') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
            INSERT INTO customers (
                customer_code,
                branch,
                full_name,
                primary_mobile,
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
                COALESCE(v_quot.branch, 'Jaijaipur'),
                v_quot.customer_name,
                v_quot.phone,
                v_quot.email,
                COALESCE(v_quot.discom_name, 'CSPDCL'),
                COALESCE(v_quot.consumer_number, 'PENDING-' || v_customer_code),
                COALESCE(v_quot.sanctioned_load_kw, v_quot.capacity_kw),
                COALESCE(v_quot.address_line, 'Site Address Verified'),
                v_quot.district,
                v_quot.tehsil,
                v_quot.block,
                v_quot.panchayat_village,
                COALESCE(v_quot.state, 'Chhattisgarh'),
                COALESCE(v_quot.pincode, '495690'),
                'REGISTERED',
                v_quot.is_test
            ) RETURNING id INTO v_customer_id;
        END IF;
    END IF;

    -- Create Project Record
    v_project_code := 'PRJ-CG-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0');
    INSERT INTO projects (
        project_code,
        customer_id,
        primary_agent_id,
        capacity_kw,
        total_contract_amount,
        discom_subsidy_amount,
        customer_payable_amount,
        status,
        commission_distributed,
        is_test
    ) VALUES (
        v_project_code,
        v_customer_id,
        v_agent_id,
        v_quot.capacity_kw,
        v_quot.total_project_cost,
        v_quot.central_subsidy_amount,
        v_quot.net_customer_cost,
        'SITE_SURVEY',
        false,
        v_quot.is_test
    ) RETURNING id INTO v_project_id;

    -- Pre-create Installation Record
    INSERT INTO installations (
        project_id,
        structure_type,
        solar_module_make,
        solar_module_capacity_wp,
        solar_module_quantity,
        inverter_make,
        inverter_capacity_kw,
        net_meter_installed,
        discom_inspection_signoff
    ) VALUES (
        v_project_id,
        COALESCE(v_quot.structure_type, 'ELEVATED_GI_HOT_DIP'),
        COALESCE(v_quot.solar_brand, 'Tier-1 Solar 550Wp'),
        COALESCE(v_quot.module_wattage_wp, 550),
        COALESCE(v_quot.module_quantity, 6),
        COALESCE(v_quot.inverter_brand, 'Growatt On-Grid'),
        COALESCE(v_quot.inverter_kw, v_quot.capacity_kw),
        false,
        false
    ) RETURNING id INTO v_installation_id;

    -- Update Quotation status to CONVERTED
    UPDATE quotations
    SET status = 'CONVERTED',
        customer_id = v_customer_id,
        updated_at = clock_timestamp()
    WHERE id = p_quotation_id;

    -- If originated from lead, convert lead
    IF v_quot.lead_id IS NOT NULL THEN
        UPDATE leads
        SET stage = 'CONVERTED',
            converted_customer_id = v_customer_id,
            updated_at = clock_timestamp()
        WHERE id = v_quot.lead_id;
    END IF;

    -- Audit log
    INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data
    ) VALUES (
        p_actor_id,
        'QUOTATION_CONVERTED_TO_PROJECT',
        'quotations',
        p_quotation_id,
        jsonb_build_object(
            'quotation_no', v_quot.quotation_no,
            'customer_id', v_customer_id,
            'project_id', v_project_id,
            'project_code', v_project_code,
            'installation_id', v_installation_id
        )
    );

    v_res := jsonb_build_object(
        'success', true,
        'quotation_id', p_quotation_id,
        'customer_id', v_customer_id,
        'project_id', v_project_id,
        'project_code', v_project_code,
        'installation_id', v_installation_id
    );

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION convert_quotation_to_customer_atomic(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION convert_quotation_to_customer_atomic(UUID, UUID) TO authenticated;
