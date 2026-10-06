-- ============================================================================
-- BNPS ERP v0.3 â€” Phase 1: Row Level Security (RLS) & Security Policies
-- Organization: Bhumi Nidhi Power Solution
-- ============================================================================

-- Helper functions for RLS context
CREATE OR REPLACE FUNCTION current_auth_profile_id()
RETURNS UUID AS $$
    SELECT id
    FROM profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role_type AS $$
    SELECT role
    FROM profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION has_erp_permission(perm_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_role user_role_type;
    v_prof_id UUID;
    v_has_role_perm BOOLEAN := false;
    v_has_user_perm BOOLEAN := false;
BEGIN
    SELECT id, role
INTO v_prof_id, v_role
FROM profiles
WHERE auth_user_id = auth.uid()
  AND is_active = true
LIMIT 1;
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
-- RBAC MASTER TABLES: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RBAC MASTER TABLE POLICIES
-- Only active Super Admins may directly manage RBAC master data.
-- ============================================================================

-- permissions
CREATE POLICY permissions_select_policy ON permissions
    FOR SELECT USING (
        current_user_role() = 'super_admin'
    );

CREATE POLICY permissions_insert_policy ON permissions
    FOR INSERT WITH CHECK (
        current_user_role() = 'super_admin'
    );

CREATE POLICY permissions_update_policy ON permissions
    FOR UPDATE
    USING (
        current_user_role() = 'super_admin'
    )
    WITH CHECK (
        current_user_role() = 'super_admin'
    );

CREATE POLICY permissions_delete_policy ON permissions
    FOR DELETE USING (
        current_user_role() = 'super_admin'
    );

-- role_permissions
CREATE POLICY role_permissions_select_policy ON role_permissions
    FOR SELECT USING (
        current_user_role() = 'super_admin'
    );

CREATE POLICY role_permissions_insert_policy ON role_permissions
    FOR INSERT WITH CHECK (
        current_user_role() = 'super_admin'
    );

CREATE POLICY role_permissions_update_policy ON role_permissions
    FOR UPDATE
    USING (
        current_user_role() = 'super_admin'
    )
    WITH CHECK (
        current_user_role() = 'super_admin'
    );

CREATE POLICY role_permissions_delete_policy ON role_permissions
    FOR DELETE USING (
        current_user_role() = 'super_admin'
    );

-- user_permissions
CREATE POLICY user_permissions_select_policy ON user_permissions
    FOR SELECT USING (
        current_user_role() = 'super_admin'
    );

CREATE POLICY user_permissions_insert_policy ON user_permissions
    FOR INSERT WITH CHECK (
        current_user_role() = 'super_admin'
        AND granted_by IS NOT NULL
        AND granted_by = current_auth_profile_id()
    );

CREATE POLICY user_permissions_update_policy ON user_permissions
    FOR UPDATE
    USING (
        current_user_role() = 'super_admin'
    )
    WITH CHECK (
        current_user_role() = 'super_admin'
        AND granted_by IS NOT NULL
        AND granted_by = current_auth_profile_id()
    );

CREATE POLICY user_permissions_delete_policy ON user_permissions
    FOR DELETE USING (
        current_user_role() = 'super_admin'
    );

-- ============================================================================
-- 1. PROFILES POLICIES
-- ============================================================================

-- Self profile read or Admin read all
CREATE POLICY profiles_select_policy ON profiles
    FOR SELECT USING (
        auth_user_id = auth.uid()
        OR current_user_role() IN ('super_admin', 'office_admin', 'branch_manager')
    );

DROP POLICY IF EXISTS profiles_update_policy ON profiles;

CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE
    USING (
        current_user_role() = 'super_admin'
    )
    WITH CHECK (
        current_user_role() = 'super_admin'
    );

-- ============================================================================
-- PROFILE SECURITY: LAST ACTIVE SUPER ADMIN PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_last_active_super_admin_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only relevant when an existing active Super Admin is being changed.
    IF OLD.role = 'super_admin'
       AND OLD.is_active = true
       AND (
           NEW.role <> 'super_admin'
           OR NEW.is_active = false
       )
    THEN
        IF NOT EXISTS (
            SELECT 1
            FROM profiles
            WHERE id <> OLD.id
              AND role = 'super_admin'
              AND is_active = true
        )
        THEN
            RAISE EXCEPTION
                'LAST_ACTIVE_SUPER_ADMIN: At least one active Super Admin must remain.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_last_active_super_admin_change
ON profiles;

CREATE TRIGGER trg_prevent_last_active_super_admin_change
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_last_active_super_admin_change();
-- ============================================================================
-- 2. AGENTS POLICIES & SENSITIVE DATA SHIELD
-- ============================================================================

-- Agent can view their own full record.
-- Admins can view all agents.
CREATE POLICY agents_select_policy ON agents
    FOR SELECT USING (
        profile_id = current_auth_profile_id()
        OR current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'accountant')
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
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'backoffice', 'receptionist')
        OR (current_user_role() = 'agent' AND source_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        ))
        OR assigned_officer_id = current_auth_profile_id()
    );

CREATE POLICY leads_insert_policy ON leads
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice', 'receptionist')
        OR (current_user_role() = 'agent' AND source_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        ))
    );

CREATE POLICY leads_update_policy ON leads
    FOR UPDATE USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'backoffice')
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
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'accountant', 'field_officer', 'technician', 'backoffice', 'receptionist')
        OR id IN (
            SELECT customer_id FROM acquisitions WHERE sourcing_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    );

CREATE POLICY pmsg_tracking_insert_policy ON pmsg_tracking
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'backoffice', 'receptionist')
    );
CREATE POLICY pmsg_tracking_update_policy ON pmsg_tracking
    FOR UPDATE USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'backoffice', 'receptionist')
    )
    WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'backoffice', 'receptionist')
    );
CREATE POLICY pmsg_tracking_select_policy ON pmsg_tracking
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'accountant', 'field_officer', 'backoffice')
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
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'accountant', 'field_officer', 'technician', 'backoffice')
        OR primary_agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        )
    );

CREATE POLICY installations_select_policy ON installations
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'operational_manager', 'accountant', 'technician')
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
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'accountant')
        OR project_id IN (
            SELECT id FROM projects WHERE primary_agent_id IN (
                SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
            )
        )
    );

-- Only Accountant or Office/Super Admin can insert or update payments
CREATE POLICY payments_insert_policy ON payments
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'accountant')
    );

CREATE POLICY payments_update_policy ON payments
    FOR UPDATE USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'accountant')
    );

-- ============================================================================
-- 7. COMMISSION TRANSACTIONS POLICIES
-- ============================================================================

-- Agents can only see their own earned commission records.
CREATE POLICY commission_select_policy ON commission_transactions
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager', 'accountant')
        OR agent_id IN (
            SELECT id FROM agents WHERE profile_id = current_auth_profile_id()
        )
    );

-- Commissions are strictly generated by server-side RPC functions
CREATE POLICY commission_insert_policy ON commission_transactions
    FOR INSERT WITH CHECK (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager')
    );

-- ============================================================================
-- 8. DOCUMENTS & AUDIT TRAIL
-- ============================================================================

DROP POLICY IF EXISTS documents_select_policy ON documents;

CREATE POLICY documents_select_policy
ON documents
FOR SELECT
USING (
    has_erp_permission('document.view')
);

CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT USING (
        current_user_role() IN ('super_admin', 'office_admin', 'branch_manager')
    );

