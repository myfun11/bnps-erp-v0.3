-- ============================================================================
-- BNPS ERP v0.3 — Migration 12: Quotation Financial Reconciliation
-- Authoritative Business Rule: Govt Subsidy is DBT Benefit to Customer A/C
-- It does NOT reduce customer amount payable to BNPS (vendor).
-- Target: Supabase PostgreSQL (Do NOT execute automatically - review & approve first)
-- ============================================================================

BEGIN;

-- 1. Align calculate_quotation_financials RPC
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

    -- Central PM Surya Ghar DBT Subsidy (Informational DBT Benefit)
    IF p_capacity_kw <= 1.0 THEN
        v_central_subsidy := 30000.00;
    ELSIF p_capacity_kw <= 2.0 THEN
        v_central_subsidy := 60000.00;
    ELSE
        v_central_subsidy := 78000.00;
    END IF;

    -- Chhattisgarh State Renewable Subsidy (Informational DBT Benefit)
    IF p_capacity_kw >= 5.0 THEN
        v_state_subsidy := 25000.00;
    ELSIF p_capacity_kw >= 3.0 THEN
        v_state_subsidy := 15000.00;
    ELSE
        v_state_subsidy := 5000.00;
    END IF;

    -- Net Customer Payable to BNPS: Equals full gross project cost.
    -- Subsidy is credited directly to eligible customer's bank account via DBT post-commissioning.
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

-- 2. Align convert_quotation_to_customer_atomic RPC to map customer_payable_amount to full total_project_cost
CREATE OR REPLACE FUNCTION convert_quotation_to_customer_atomic(
    p_quotation_id UUID,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_actor_profile_id UUID := current_auth_profile_id();
    v_role user_role_type := current_user_role();
    v_actor_branch VARCHAR(64);
    v_quot RECORD;
    v_customer_id UUID;
    v_project_id UUID;
    v_installation_id UUID;
    v_agent_id UUID;
    v_customer_code VARCHAR(32);
    v_project_code VARCHAR(32);
    v_res JSONB;
BEGIN
    -- 1. Actor authentication check (Fail-closed)
    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Active ERP profile not found for current session'
            USING ERRCODE = 'P0001';
    END IF;

    -- 2. Authorization check (Fail-closed on NULL or unlisted role)
    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice') THEN
        RAISE EXCEPTION 'FORBIDDEN: User does not have permission to convert quotations'
            USING ERRCODE = 'P0005';
    END IF;

    -- Fetch authoritative branch of the actor from profile
    SELECT branch INTO v_actor_branch FROM profiles WHERE id = v_actor_profile_id;

    -- 3. Lock and validate quotation
    SELECT * INTO v_quot FROM quotations WHERE id = p_quotation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Quotation ID % does not exist', p_quotation_id USING ERRCODE = 'P0002';
    END IF;

    IF v_quot.status = 'CONVERTED' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Quotation % is already converted', v_quot.quotation_no USING ERRCODE = 'P0003';
    END IF;

    -- 4. Branch authorization check for branch-scoped roles
    IF v_role IN ('branch_manager', 'field_officer') THEN
        IF v_actor_branch IS NULL OR v_quot.branch IS NULL OR LOWER(TRIM(v_quot.branch)) <> LOWER(TRIM(v_actor_branch)) THEN
            RAISE EXCEPTION 'FORBIDDEN: User cannot convert quotations outside their authorized branch (%)', COALESCE(v_actor_branch, 'Unassigned')
                USING ERRCODE = 'P0005';
        END IF;
    END IF;

    -- 5. Determine primary sourcing agent
    IF v_quot.lead_id IS NOT NULL THEN
        SELECT source_agent_id INTO v_agent_id FROM leads WHERE id = v_quot.lead_id;
    END IF;

    IF v_agent_id IS NULL AND v_quot.branch IS NOT NULL THEN
        SELECT id INTO v_agent_id FROM agents 
        WHERE LOWER(TRIM(branch)) = LOWER(TRIM(v_quot.branch)) AND is_active = true 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    IF v_agent_id IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Cannot resolve active sourcing agent for branch %', v_quot.branch USING ERRCODE = 'P0004';
    END IF;

    -- 6. Upsert Customer Record
    IF v_quot.customer_id IS NOT NULL THEN
        v_customer_id := v_quot.customer_id;
    ELSE
        SELECT id INTO v_customer_id FROM customers WHERE primary_mobile = v_quot.phone LIMIT 1;
        IF v_customer_id IS NULL THEN
            v_customer_code := 'BNPS-CUST-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
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

    -- 7. Create Project Record
    -- Authoritative Rule: customer_payable_amount equals total_contract_amount (full vendor project cost)
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
        v_quot.total_project_cost,
        'SITE_SURVEY',
        false,
        v_quot.is_test
    ) RETURNING id INTO v_project_id;

    -- 8. Pre-create Installation Record
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

    -- 9. Update Quotation Status
    UPDATE quotations
    SET customer_id = v_customer_id,
        status = 'CONVERTED',
        updated_at = clock_timestamp()
    WHERE id = p_quotation_id;

    -- 10. If originating from Lead, transition Lead
    IF v_quot.lead_id IS NOT NULL THEN
        UPDATE leads
        SET stage = 'CONVERTED',
            converted_customer_id = v_customer_id,
            updated_at = clock_timestamp()
        WHERE id = v_quot.lead_id;
    END IF;

    v_res := jsonb_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'project_id', v_project_id,
        'installation_id', v_installation_id
    );

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION convert_quotation_to_customer_atomic(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION convert_quotation_to_customer_atomic(UUID, UUID) TO authenticated;

COMMIT;
