-- ============================================================================
-- BNPS ERP v0.3
-- 05_DYNAMIC_RBAC.SQL
--
-- Purpose:
--   Future-proof dynamic RBAC.
--
-- Permission precedence:
--   USER DENY > USER GRANT > ROLE GRANT > DEFAULT DENY
--
-- Existing profiles.role is retained for backward compatibility.
-- New authorization should progressively use this dynamic layer.
-- ============================================================================


-- ============================================================================
-- 1. DYNAMIC ROLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);


-- ============================================================================
-- 2. USER -> ROLE ASSIGNMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    PRIMARY KEY (user_id, role_id)
);


-- ============================================================================
-- 3. USER-SPECIFIC PERMISSION OVERRIDES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    effect VARCHAR(10) NOT NULL
        CHECK (effect IN ('GRANT', 'DENY')),

    assigned_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    PRIMARY KEY (user_id, permission_id)
);


-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user
    ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
    ON user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user
    ON user_permission_overrides(user_id);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_permission
    ON user_permission_overrides(permission_id);


-- ============================================================================
-- 5. SEED SYSTEM ROLES
-- ============================================================================

INSERT INTO roles (code, name, description, is_system_role)
VALUES
    ('super_admin', 'Super Admin', 'Highest system authority', true),
    ('office_admin', 'Office Admin', 'Office administration authority', true),
    ('branch_manager', 'Branch Manager', 'Branch management authority', true),
    ('operational_manager', 'Operational Manager', 'Operational module authority', true),
    ('accountant', 'Accountant', 'Finance and accounting authority', true),
    ('field_officer', 'Field Officer', 'Field operations authority', true),
    ('technician', 'Technician', 'Installation and technical authority', true),
    ('receptionist', 'Receptionist', 'Front desk authority', true),
    ('backoffice', 'Back Office', 'Back office authority', true),
    ('agent', 'Agent', 'Sales/lead agent authority', true)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- 6. MIGRATE EXISTING PROFILE ROLES
--
-- Existing users retain their current role.
-- This is deliberately INSERT-only and does not change profiles.role.
-- ============================================================================

INSERT INTO user_roles (user_id, role_id)
SELECT
    p.id,
    r.id
FROM profiles p
JOIN roles r
    ON r.code = p.role::TEXT
WHERE p.is_active = true
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================================
-- DOCUMENT PERMISSIONS
-- ============================================================================
-- Documents use the dynamic RBAC permission layer.
-- Permission definitions are kept in the existing permissions table so both
-- legacy and dynamic authorization can resolve the same permission codes.
-- ============================================================================

INSERT INTO permissions (code, name, module, description)
VALUES
    (
        'document.view',
        'View Documents',
        'Documents',
        'View documents and document metadata'
    ),
    (
        'document.upload',
        'Upload Documents',
        'Documents',
        'Upload and register documents'
    ),
    (
        'document.verify',
        'Verify Documents',
        'Documents',
        'Verify uploaded documents'
    ),
    (
        'document.reject',
        'Reject Documents',
        'Documents',
        'Reject uploaded documents with a reason'
    )
ON CONFLICT (code) DO NOTHING;


-- Legacy role mapping.
-- This is intentionally kept because has_erp_permission() currently supports
-- legacy role_permissions as a fallback during RBAC migration.

INSERT INTO role_permissions (role, permission_id)
SELECT
    v.role::user_role_type,
    p.id
FROM (
    VALUES
        ('super_admin',       'document.view'),
        ('super_admin',       'document.upload'),
        ('super_admin',       'document.verify'),
        ('super_admin',       'document.reject'),

        ('office_admin',      'document.view'),
        ('office_admin',      'document.upload'),
        ('office_admin',      'document.verify'),
        ('office_admin',      'document.reject'),

        ('branch_manager',    'document.view'),
        ('branch_manager',    'document.upload'),
        ('branch_manager',    'document.verify'),
        ('branch_manager',    'document.reject'),

        ('operational_manager','document.view'),
        ('operational_manager','document.upload'),
        ('operational_manager','document.verify'),
        ('operational_manager','document.reject'),

        ('accountant',        'document.view'),

        ('field_officer',     'document.view'),
        ('field_officer',     'document.upload'),

        ('backoffice',        'document.view'),
        ('backoffice',        'document.upload'),
        ('backoffice',        'document.verify'),
        ('backoffice',        'document.reject'),

        ('receptionist',      'document.upload')
) AS v(role, permission_code)
JOIN permissions p
    ON p.code = v.permission_code
ON CONFLICT (role, permission_id) DO NOTHING;
-- ============================================================================
-- 7. MIGRATE EXISTING ROLE PERMISSIONS INTO DYNAMIC ROLES
--
-- Existing role_permissions already references the legacy enum.
-- We preserve it and create dynamic equivalents.
-- ============================================================================

CREATE TABLE IF NOT EXISTS dynamic_role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    PRIMARY KEY (role_id, permission_id)
);


INSERT INTO dynamic_role_permissions (role_id, permission_id)
SELECT
    r.id,
    rp.permission_id
FROM role_permissions rp
JOIN roles r
    ON r.code = rp.role::TEXT
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 8. DYNAMIC PERMISSION RESOLUTION
-- ============================================================================

CREATE OR REPLACE FUNCTION has_erp_permission(perm_code TEXT)
RETURNS BOOLEAN
AS $$
DECLARE
    v_profile_id UUID;
    v_permission_id UUID;
    v_user_effect VARCHAR(10);
    v_has_role_permission BOOLEAN := false;
BEGIN

    SELECT id
    INTO v_profile_id
    FROM profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RETURN false;
    END IF;


    SELECT id
    INTO v_permission_id
    FROM permissions
    WHERE code = perm_code
    LIMIT 1;

    IF v_permission_id IS NULL THEN
        RETURN false;
    END IF;


    -- ================================================================
    -- 1. USER-SPECIFIC OVERRIDE HAS HIGHEST PRIORITY
    -- ================================================================

    SELECT effect
    INTO v_user_effect
    FROM user_permission_overrides
    WHERE user_id = v_profile_id
      AND permission_id = v_permission_id
    LIMIT 1;

    IF v_user_effect = 'DENY' THEN
        RETURN false;
    END IF;

    IF v_user_effect = 'GRANT' THEN
        RETURN true;
    END IF;


    -- ================================================================
    -- 2. DYNAMIC ROLE PERMISSION
    -- ================================================================

    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN dynamic_role_permissions drp
            ON drp.role_id = ur.role_id
        WHERE ur.user_id = v_profile_id
          AND drp.permission_id = v_permission_id
    )
    INTO v_has_role_permission;

    IF v_has_role_permission THEN
        RETURN true;
    END IF;


    -- ================================================================
    -- 3. LEGACY ROLE FALLBACK
    --
    -- Keeps existing application functional while migration proceeds.
    -- ================================================================

    IF EXISTS (
        SELECT 1
        FROM role_permissions rp
        JOIN profiles p
            ON p.role = rp.role
        JOIN permissions pp
            ON pp.id = rp.permission_id
        WHERE p.id = v_profile_id
          AND pp.code = perm_code
    ) THEN
        RETURN true;
    END IF;


    -- ================================================================
    -- 4. DEFAULT DENY
    -- ================================================================

    RETURN false;

END;
$$
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp;


-- ============================================================================
-- 9. SUPER ADMIN UNIVERSAL ACCESS
-- ============================================================================
--
-- Keep this explicit because Super Admin is the highest authority.
-- ============================================================================

CREATE OR REPLACE FUNCTION is_current_super_admin()
RETURNS BOOLEAN
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM profiles
        WHERE auth_user_id = auth.uid()
          AND is_active = true
          AND role = 'super_admin'
    );
$$
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp;


-- ============================================================================
-- 10. RLS
-- ============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 11. ROLES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS roles_select_policy ON roles;
DROP POLICY IF EXISTS roles_insert_policy ON roles;
DROP POLICY IF EXISTS roles_update_policy ON roles;
DROP POLICY IF EXISTS roles_delete_policy ON roles;

CREATE POLICY roles_select_policy
ON roles
FOR SELECT
USING (
    is_current_super_admin()
);

CREATE POLICY roles_insert_policy
ON roles
FOR INSERT
WITH CHECK (
    is_current_super_admin()
);

CREATE POLICY roles_update_policy
ON roles
FOR UPDATE
USING (
    is_current_super_admin()
)
WITH CHECK (
    is_current_super_admin()
);

CREATE POLICY roles_delete_policy
ON roles
FOR DELETE
USING (
    is_current_super_admin()
);


-- ============================================================================
-- 12. USER ROLES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS user_roles_select_policy ON user_roles;
DROP POLICY IF EXISTS user_roles_insert_policy ON user_roles;
DROP POLICY IF EXISTS user_roles_update_policy ON user_roles;
DROP POLICY IF EXISTS user_roles_delete_policy ON user_roles;

CREATE POLICY user_roles_select_policy
ON user_roles
FOR SELECT
USING (
    user_id = current_auth_profile_id()
    OR is_current_super_admin()
);

CREATE POLICY user_roles_insert_policy
ON user_roles
FOR INSERT
WITH CHECK (
    is_current_super_admin()
    AND assigned_by = current_auth_profile_id()
);

CREATE POLICY user_roles_update_policy
ON user_roles
FOR UPDATE
USING (
    is_current_super_admin()
)
WITH CHECK (
    is_current_super_admin()
    AND assigned_by = current_auth_profile_id()
);

CREATE POLICY user_roles_delete_policy
ON user_roles
FOR DELETE
USING (
    is_current_super_admin()
);


-- ============================================================================
-- 13. DYNAMIC ROLE PERMISSION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS dynamic_role_permissions_select_policy
ON dynamic_role_permissions;

DROP POLICY IF EXISTS dynamic_role_permissions_insert_policy
ON dynamic_role_permissions;

DROP POLICY IF EXISTS dynamic_role_permissions_update_policy
ON dynamic_role_permissions;

DROP POLICY IF EXISTS dynamic_role_permissions_delete_policy
ON dynamic_role_permissions;


CREATE POLICY dynamic_role_permissions_select_policy
ON dynamic_role_permissions
FOR SELECT
USING (
    is_current_super_admin()
);

CREATE POLICY dynamic_role_permissions_insert_policy
ON dynamic_role_permissions
FOR INSERT
WITH CHECK (
    is_current_super_admin()
);

CREATE POLICY dynamic_role_permissions_update_policy
ON dynamic_role_permissions
FOR UPDATE
USING (
    is_current_super_admin()
)
WITH CHECK (
    is_current_super_admin()
);

CREATE POLICY dynamic_role_permissions_delete_policy
ON dynamic_role_permissions
FOR DELETE
USING (
    is_current_super_admin()
);


-- ============================================================================
-- 14. USER OVERRIDE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS user_permission_overrides_select_policy
ON user_permission_overrides;

DROP POLICY IF EXISTS user_permission_overrides_insert_policy
ON user_permission_overrides;

DROP POLICY IF EXISTS user_permission_overrides_update_policy
ON user_permission_overrides;

DROP POLICY IF EXISTS user_permission_overrides_delete_policy
ON user_permission_overrides;


CREATE POLICY user_permission_overrides_select_policy
ON user_permission_overrides
FOR SELECT
USING (
    user_id = current_auth_profile_id()
    OR is_current_super_admin()
);

CREATE POLICY user_permission_overrides_insert_policy
ON user_permission_overrides
FOR INSERT
WITH CHECK (
    is_current_super_admin()
    AND assigned_by = current_auth_profile_id()
);

CREATE POLICY user_permission_overrides_update_policy
ON user_permission_overrides
FOR UPDATE
USING (
    is_current_super_admin()
)
WITH CHECK (
    is_current_super_admin()
    AND assigned_by = current_auth_profile_id()
);

CREATE POLICY user_permission_overrides_delete_policy
ON user_permission_overrides
FOR DELETE
USING (
    is_current_super_admin()
);


-- ============================================================================
-- END
-- ============================================================================