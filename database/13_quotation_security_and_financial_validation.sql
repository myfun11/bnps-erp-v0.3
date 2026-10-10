-- ============================================================================
-- BNPS ERP v0.3 — Migration 13: Quotation Security, RLS & Server-Side Financial Validation
-- Target: PostgreSQL 15+ / Supabase PostgreSQL (Do NOT execute automatically — review & approve first)
-- Organization: Bhumi Nidhi Power Solution (PM Surya Ghar Rooftop Solar)
-- ============================================================================
-- Purpose:
--   1. Enforce strict Row Level Security (RLS) on public.quotations.
--   2. Enforce role, branch, and agent/lead ownership server-side.
--   3. Enforce test and production record separation (is_test).
--   4. Validate and reconcile financial figures via calculate_quotation_financials
--      logic in a BEFORE INSERT OR UPDATE trigger.
--   5. Enforce authoritative DBT business rule: net_customer_cost = total_project_cost.
--   6. Enforce quotation status transition rules in database (prevent invalid lifecycle jumps).
--   7. Prevent unauthorized cross-branch edits and field tampering.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS FOR SECURITY & ISOLATION CONTEXT
-- ----------------------------------------------------------------------------

-- Helper: Retrieve active profile's is_test status
CREATE OR REPLACE FUNCTION current_user_is_test()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(is_test, false)
    FROM profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION current_user_is_test() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_is_test() TO authenticated;

-- Helper: Retrieve active profile's authoritative branch
CREATE OR REPLACE FUNCTION current_user_branch()
RETURNS VARCHAR(64) AS $$
    SELECT branch
    FROM profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION current_user_branch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_branch() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. REGISTER QUOTATION PERMISSIONS (IDEMPOTENT)
-- ----------------------------------------------------------------------------

INSERT INTO permissions (code, name, module, description)
VALUES 
    ('quotation.view', 'View Quotations', 'quotations', 'View rooftop solar quotations'),
    ('quotation.create', 'Create Quotations', 'quotations', 'Create and generate rooftop solar quotations'),
    ('quotation.update', 'Update Quotations', 'quotations', 'Update solar quotation status and details'),
    ('quotation.convert', 'Convert Quotations', 'quotations', 'Convert approved quotation to customer and project')
ON CONFLICT (code) DO NOTHING;

-- Map permissions to default role assignments
INSERT INTO role_permissions (role, permission_id)
SELECT r.role, p.id
FROM (VALUES 
    ('super_admin'::user_role_type),
    ('office_admin'::user_role_type),
    ('branch_manager'::user_role_type),
    ('field_officer'::user_role_type),
    ('accountant'::user_role_type),
    ('backoffice'::user_role_type),
    ('agent'::user_role_type)
) AS r(role)
CROSS JOIN permissions p
WHERE p.code = 'quotation.view'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT r.role, p.id
FROM (VALUES 
    ('super_admin'::user_role_type),
    ('office_admin'::user_role_type),
    ('branch_manager'::user_role_type),
    ('field_officer'::user_role_type),
    ('backoffice'::user_role_type),
    ('agent'::user_role_type)
) AS r(role)
CROSS JOIN permissions p
WHERE p.code = 'quotation.create'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT r.role, p.id
FROM (VALUES 
    ('super_admin'::user_role_type),
    ('office_admin'::user_role_type),
    ('branch_manager'::user_role_type),
    ('field_officer'::user_role_type),
    ('backoffice'::user_role_type)
) AS r(role)
CROSS JOIN permissions p
WHERE p.code = 'quotation.update'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT r.role, p.id
FROM (VALUES 
    ('super_admin'::user_role_type),
    ('office_admin'::user_role_type),
    ('branch_manager'::user_role_type),
    ('field_officer'::user_role_type),
    ('backoffice'::user_role_type)
) AS r(role)
CROSS JOIN permissions p
WHERE p.code = 'quotation.convert'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. SERVER-SIDE FINANCIAL RECONCILIATION & STATUS TRANSITION TRIGGER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_quotation_security_and_financials()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_profile_id UUID := current_auth_profile_id();
    v_role user_role_type := current_user_role();
    v_actor_branch VARCHAR(64) := current_user_branch();
    v_is_test BOOLEAN := current_user_is_test();
    v_expected_gst NUMERIC(12, 2);
    v_expected_gross NUMERIC(14, 2);
    v_expected_central NUMERIC(12, 2);
    v_expected_state NUMERIC(12, 2);
    v_monthly_units INT;
    v_monthly_savings NUMERIC(12, 2);
BEGIN
    -- 1. Server-side Actor Verification & Test/Prod Separation
    IF v_actor_profile_id IS NOT NULL THEN
        -- Non-super_admin users are strictly tied to their session's test environment
        IF v_role <> 'super_admin' THEN
            NEW.is_test := v_is_test;
        ELSE
            NEW.is_test := COALESCE(NEW.is_test, v_is_test, false);
        END IF;

        -- Branch enforcement for branch-scoped operational roles
        IF v_role IN ('branch_manager', 'field_officer') THEN
            IF NEW.branch IS NULL OR LOWER(TRIM(NEW.branch)) <> LOWER(TRIM(v_actor_branch)) THEN
                RAISE EXCEPTION 'FORBIDDEN: User cannot create or assign quotations outside authorized branch (%)', 
                    COALESCE(v_actor_branch, 'Unassigned')
                    USING ERRCODE = 'P0005';
            END IF;
        END IF;

        -- Agent lead ownership validation
        IF v_role = 'agent' THEN
            IF NEW.lead_id IS NULL THEN
                RAISE EXCEPTION 'VALIDATION_ERROR: Agents may only create quotations linked to an existing assigned lead'
                    USING ERRCODE = 'P0004';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM leads l
                JOIN agents a ON l.source_agent_id = a.id
                WHERE l.id = NEW.lead_id AND a.profile_id = v_actor_profile_id
            ) THEN
                RAISE EXCEPTION 'FORBIDDEN: Agent does not own the originating lead for this quotation'
                    USING ERRCODE = 'P0005';
            END IF;
        END IF;
    END IF;

    -- 2. Status Transition Machine Enforcement
    IF TG_OP = 'INSERT' THEN
        -- Quotations cannot be directly inserted as CONVERTED; conversion requires atomic RPC
        IF NEW.status = 'CONVERTED' THEN
            RAISE EXCEPTION 'INVALID_OPERATION: Direct insertion of CONVERTED quotation is forbidden. Must use conversion RPC'
                USING ERRCODE = 'P0003';
        END IF;
        IF NEW.status IS NULL THEN
            NEW.status := 'SENT';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If already CONVERTED, status is terminal
        IF OLD.status = 'CONVERTED' THEN
            IF NEW.status <> 'CONVERTED' THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: Cannot modify status of an already CONVERTED quotation (% -> %)', 
                    OLD.status, NEW.status
                    USING ERRCODE = 'P0003';
            END IF;
            -- Critical financial/technical fields cannot be mutated once converted
            IF NEW.total_project_cost <> OLD.total_project_cost OR NEW.capacity_kw <> OLD.capacity_kw THEN
                RAISE EXCEPTION 'INVALID_OPERATION: Cannot alter technical or financial specifications of a CONVERTED quotation'
                    USING ERRCODE = 'P0003';
            END IF;
        END IF;

        -- Direct update to CONVERTED without customer_id is rejected
        IF NEW.status = 'CONVERTED' AND OLD.status <> 'CONVERTED' AND NEW.customer_id IS NULL THEN
            RAISE EXCEPTION 'INVALID_TRANSITION: Cannot mark quotation CONVERTED without an associated customer_id'
                USING ERRCODE = 'P0003';
        END IF;

        -- Branch immutability: Branch managers/field officers cannot move quotations to another branch
        IF v_role IN ('branch_manager', 'field_officer') AND LOWER(TRIM(NEW.branch)) <> LOWER(TRIM(OLD.branch)) THEN
            RAISE EXCEPTION 'FORBIDDEN: Cannot transfer quotation across branches'
                USING ERRCODE = 'P0005';
        END IF;

        NEW.updated_at := clock_timestamp();
    END IF;

    -- 3. Authoritative Financial Validation & Reconciliation
    IF NEW.capacity_kw IS NULL OR NEW.capacity_kw <= 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: System capacity kW must be positive'
            USING ERRCODE = 'P0004';
    END IF;

    IF NEW.subtotal_cost IS NULL OR NEW.subtotal_cost <= 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Subtotal cost before tax must be positive'
            USING ERRCODE = 'P0004';
    END IF;

    -- Statutory Composite GST (13.80%) calculation check
    NEW.gst_percentage := 13.80;
    v_expected_gst := ROUND((NEW.subtotal_cost * (NEW.gst_percentage / 100.0)), 2);
    v_expected_gross := NEW.subtotal_cost + v_expected_gst;

    IF NEW.gst_amount IS NULL OR ABS(NEW.gst_amount - v_expected_gst) > 2.00 THEN
        NEW.gst_amount := v_expected_gst;
    END IF;

    IF NEW.total_project_cost IS NULL OR ABS(NEW.total_project_cost - v_expected_gross) > 2.00 THEN
        NEW.total_project_cost := v_expected_gross;
    END IF;

    -- Authoritative Business Rule: Govt Subsidy is DBT directly to Customer Bank A/C.
    -- Net Customer Payable to BNPS MUST equal full gross project cost.
    NEW.net_customer_cost := NEW.total_project_cost;

    -- Central PM Surya Ghar DBT Subsidy statutory caps
    IF NEW.capacity_kw <= 1.0 THEN
        v_expected_central := 30000.00;
    ELSIF NEW.capacity_kw <= 2.0 THEN
        v_expected_central := 60000.00;
    ELSE
        v_expected_central := 78000.00;
    END IF;
    NEW.central_subsidy_amount := v_expected_central;

    -- Chhattisgarh State Renewable DBT Subsidy slabs
    IF NEW.capacity_kw >= 5.0 THEN
        v_expected_state := 25000.00;
    ELSIF NEW.capacity_kw >= 3.0 THEN
        v_expected_state := 15000.00;
    ELSE
        v_expected_state := 5000.00;
    END IF;
    NEW.state_subsidy_amount := v_expected_state;

    -- Recalculate Savings Estimates if absent or zero
    IF NEW.monthly_savings_est IS NULL OR NEW.monthly_savings_est <= 0 THEN
        v_monthly_units := ROUND(NEW.capacity_kw * 4.3 * 30);
        v_monthly_savings := ROUND(v_monthly_units * 6.80, 2);
        NEW.monthly_savings_est := v_monthly_savings;
        NEW.annual_savings_est := ROUND(v_monthly_savings * 12.0, 2);
    END IF;

    IF NEW.loan_eligible_amount IS NULL OR NEW.loan_eligible_amount <= 0 THEN
        NEW.loan_eligible_amount := ROUND(NEW.total_project_cost * 0.90, 2);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION validate_quotation_security_and_financials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_quotation_security_and_financials() TO authenticated;

-- Attach Trigger to public.quotations
DROP TRIGGER IF EXISTS trg_validate_quotation_security_and_financials ON quotations;
CREATE TRIGGER trg_validate_quotation_security_and_financials
    BEFORE INSERT OR UPDATE ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION validate_quotation_security_and_financials();

-- ----------------------------------------------------------------------------
-- 4. HARDENED ROW LEVEL SECURITY (RLS) POLICIES FOR public.quotations
-- ----------------------------------------------------------------------------

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE quotations FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE quotations TO authenticated;
GRANT ALL ON TABLE quotations TO service_role;

-- A. SELECT POLICY
DROP POLICY IF EXISTS quotations_select_policy ON quotations;
CREATE POLICY quotations_select_policy ON quotations
    FOR SELECT TO authenticated
    USING (
        -- Test / Production isolation: Super admin sees all; others strictly isolated to own environment
        (is_test = current_user_is_test() OR current_user_role() = 'super_admin')
        AND (
            -- Executive & HQ oversight roles
            current_user_role() IN ('super_admin', 'office_admin', 'accountant', 'backoffice')
            -- Branch-scoped operational staff
            OR (
                current_user_role() IN ('branch_manager', 'field_officer')
                AND branch IS NOT NULL
                AND current_user_branch() IS NOT NULL
                AND LOWER(TRIM(branch)) = LOWER(TRIM(current_user_branch()))
            )
            -- Sourcing Agent: Only quotations originating from own sourced leads
            OR (
                current_user_role() = 'agent'
                AND lead_id IN (
                    SELECT id FROM leads WHERE source_agent_id IN (
                        SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
                    )
                )
            )
        )
    );

-- B. INSERT POLICY
DROP POLICY IF EXISTS quotations_insert_policy ON quotations;
CREATE POLICY quotations_insert_policy ON quotations
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Test / Production isolation enforcement
        is_test = current_user_is_test()
        -- Initial status must be DRAFT or SENT
        AND status IN ('DRAFT', 'SENT')
        AND (
            -- Executive roles
            current_user_role() IN ('super_admin', 'office_admin', 'backoffice')
            -- Branch managers & field officers restricted to own branch
            OR (
                current_user_role() IN ('branch_manager', 'field_officer')
                AND branch IS NOT NULL
                AND current_user_branch() IS NOT NULL
                AND LOWER(TRIM(branch)) = LOWER(TRIM(current_user_branch()))
            )
            -- Sourcing Agent: Must have own lead
            OR (
                current_user_role() = 'agent'
                AND lead_id IS NOT NULL
                AND lead_id IN (
                    SELECT id FROM leads WHERE source_agent_id IN (
                        SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
                    )
                )
            )
        )
    );

-- C. UPDATE POLICY
DROP POLICY IF EXISTS quotations_update_policy ON quotations;
CREATE POLICY quotations_update_policy ON quotations
    FOR UPDATE TO authenticated
    USING (
        (is_test = current_user_is_test() OR current_user_role() = 'super_admin')
        AND (
            current_user_role() IN ('super_admin', 'office_admin', 'backoffice')
            OR (
                current_user_role() IN ('branch_manager', 'field_officer')
                AND branch IS NOT NULL
                AND current_user_branch() IS NOT NULL
                AND LOWER(TRIM(branch)) = LOWER(TRIM(current_user_branch()))
            )
        )
    )
    WITH CHECK (
        (is_test = current_user_is_test() OR current_user_role() = 'super_admin')
        AND (
            current_user_role() IN ('super_admin', 'office_admin', 'backoffice')
            OR (
                current_user_role() IN ('branch_manager', 'field_officer')
                AND branch IS NOT NULL
                AND current_user_branch() IS NOT NULL
                AND LOWER(TRIM(branch)) = LOWER(TRIM(current_user_branch()))
            )
        )
    );

-- D. DELETE POLICY (Super admin only)
DROP POLICY IF EXISTS quotations_delete_policy ON quotations;
CREATE POLICY quotations_delete_policy ON quotations
    FOR DELETE TO authenticated
    USING (
        current_user_role() = 'super_admin'
    );

COMMIT;
