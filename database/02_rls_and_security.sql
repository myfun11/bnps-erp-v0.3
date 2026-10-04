-- ============================================================================
-- BNPS ERP v0.3 — Phase 1: Row Level Security (RLS) & Security Policies
-- Organization: Bhumi Nidhi Power Solution
-- ============================================================================

-- Helper functions for RLS context
CREATE OR REPLACE FUNCTION current_auth_profile_id()
RETURNS UUID AS $$
    SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role_type AS $$
    SELECT role FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION has_erp_permission(perm_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_role user_role_type;
    v_prof_id UUID;
    v_has_role_perm BOOLEAN := false;
    v_has_user_perm BOOLEAN := false;
BEGIN
    SELECT id, role INTO v_prof_id, v_role FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
    IF v_role IS NULL THEN
        RETURN false;
    END IF;

    -- Super Admin has universal access
    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Check Role Permissions
    SELECT EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role = v_role AND p.code = perm_code
    ) INTO v_has_role_perm;

    IF v_has_role_perm THEN
        RETURN true;
    END IF;

    -- Check Individual User Overrides
    SELECT EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = v_prof_id AND p.code = perm_code
    ) INTO v_has_user_perm;

    RETURN v_has_user_perm;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- ENABLE RLS ON ALL DOMAIN TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmsg_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. PROFILES POLICIES
-- ============================================================================

-- Self profile read or Admin read all
CREATE POLICY profiles_select_policy ON profiles
    FOR SELECT USING (
        auth_user_id = auth.uid()
        OR current_user_role() IN ('super_admin', 'office_admin')
    );

CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE USING (
        auth_user_id = auth.uid()
        OR current_user_role() = 'super_admin'
    );

-- ============================================================================
-- 2. AGENTS POLICIES & SENSITIVE DATA SHIELD
-- ============================================================================

-- Agent can view their own full record.
-- Admins can view all agents.
CREATE POLICY agents_select_policy ON agents
    FOR SELECT USING (
        profile_id = current_auth_profile_id()
        OR current_user_role() IN ('super_admin', 'office_admin', 'accountant')
    );

-- Redacted Public View for Downline visibility (No PAN, Bank Acc, Aadhaar cross-exposure)
CREATE OR REPLACE VIEW agents_public_profile AS
SELECT 
    a.id,
    a.agent_code,
    p.full_name AS agent_name,
    a.sponsor_agent_id,
    a.hierarchy_level,
    a.is_active,
    a.created_at
FROM agents a
JOIN profiles p ON a.profile_id = p.id;

-- ============================================================================
-- 3. LEADS POLICIES
-- ============================================================================

-- Agents can see only their sourced leads; Officers & Admins see assigned/all
CREATE POLICY leads_select_policy ON leads
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin')
        OR (current_user_role() = 'agent' AND source_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        ))
        OR assigned_officer_id = current_auth_profile_id()
    );

CREATE POLICY leads_insert_policy ON leads
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'field_officer')
        OR (current_user_role() = 'agent' AND source_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        ))
    );

CREATE POLICY leads_update_policy ON leads
    FOR UPDATE USING (
        current_user_role() IN ('super_admin', 'office_admin')
        OR assigned_officer_id = current_auth_profile_id()
        OR (current_user_role() = 'agent' AND source_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        ) AND stage IN ('NEW', 'CONTACTED', 'INTERESTED', 'DOCUMENT_PENDING'))
    );

-- ============================================================================
-- 4. CUSTOMERS & PMSG TRACKING POLICIES
-- ============================================================================

CREATE POLICY customers_select_policy ON customers
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant', 'field_officer', 'technician')
        OR id IN (
            SELECT customer_id FROM acquisitions WHERE sourcing_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    );

CREATE POLICY pmsg_tracking_select_policy ON pmsg_tracking
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant', 'field_officer')
        OR customer_id IN (
            SELECT customer_id FROM acquisitions WHERE sourcing_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    );

-- ============================================================================
-- 5. PROJECTS & INSTALLATIONS POLICIES
-- ============================================================================

CREATE POLICY projects_select_policy ON projects
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant', 'field_officer', 'technician')
        OR primary_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        )
    );

CREATE POLICY installations_select_policy ON installations
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant', 'technician')
        OR technician_profile_id = current_auth_profile_id()
        OR project_id IN (
            SELECT id FROM projects WHERE primary_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    );

-- ============================================================================
-- 6. PAYMENTS & FINANCIAL AUDIT POLICIES
-- ============================================================================

CREATE POLICY payments_select_policy ON payments
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant')
        OR project_id IN (
            SELECT id FROM projects WHERE primary_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    );

-- Only Accountant or Office/Super Admin can insert or update payments
CREATE POLICY payments_insert_policy ON payments
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant')
    );

CREATE POLICY payments_update_policy ON payments
    FOR UPDATE USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant')
    );

-- ============================================================================
-- 7. COMMISSION TRANSACTIONS POLICIES
-- ============================================================================

-- Agents can only see their own earned commission records.
CREATE POLICY commission_select_policy ON commission_transactions
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant')
        OR agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        )
    );

-- Commissions are strictly generated by server-side RPC functions
CREATE POLICY commission_insert_policy ON commission_transactions
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin')
    );

-- ============================================================================
-- 8. DOCUMENTS & AUDIT TRAIL
-- ============================================================================

CREATE POLICY documents_select_policy ON documents
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'accountant', 'field_officer')
        OR verified_by = current_auth_profile_id()
    );

CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin')
    );
