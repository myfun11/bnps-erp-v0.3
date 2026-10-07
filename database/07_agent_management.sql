-- ============================================================================
-- BNPS ERP v0.3
-- 07_AGENT_MANAGEMENT.SQL
-- LIVE AGENT RECRUITMENT / ONBOARDING
-- ============================================================================

-- ============================================================================
-- 1. AGENT CREATE PERMISSION
-- ============================================================================

INSERT INTO permissions (
    code,
    name,
    module,
    description
)
VALUES (
    'agent.create',
    'Recruit Agent',
    'agents',
    'Create and onboard a new BNPS agent'
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- 2. DEFAULT ROLE PERMISSION
-- ============================================================================

INSERT INTO role_permissions (
    role,
    permission_id
)
SELECT
    v.role_name::user_role_type,
    p.id
FROM (
    VALUES
        ('super_admin'),
        ('office_admin')
) AS v(role_name)
CROSS JOIN permissions p
WHERE p.code = 'agent.create'
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 3. ATOMIC AGENT CREATION
-- ============================================================================
--
-- Auth user is created by the secure Edge Function.
-- This RPC creates the corresponding BNPS profile + agent record.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION create_agent_atomic(
    p_auth_user_id UUID,
    p_full_name TEXT,
    p_email CITEXT,
    p_phone VARCHAR(20),
    p_branch VARCHAR(64),
    p_sponsor_agent_id UUID DEFAULT NULL,
    p_pan_number VARCHAR(10) DEFAULT NULL,
    p_bank_account_no TEXT DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_bank_ifsc VARCHAR(11) DEFAULT NULL,
    p_tds_percentage NUMERIC(5,2) DEFAULT 5.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_profile_id UUID;
    v_agent_id UUID;
    v_agent_code VARCHAR(32);
    v_next_agent_number BIGINT;
BEGIN

    -- ------------------------------------------------------------------------
    -- Authenticated BNPS caller
    -- ------------------------------------------------------------------------

    v_actor_id := current_auth_profile_id();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION
            'AUTH_REQUIRED: Active BNPS profile not found'
            USING ERRCODE = 'P0001';
    END IF;


    -- ------------------------------------------------------------------------
    -- Permission
    -- ------------------------------------------------------------------------

    IF NOT has_erp_permission('agent.create') THEN
        RAISE EXCEPTION
            'FORBIDDEN: You do not have permission to recruit agents'
            USING ERRCODE = 'P0005';
    END IF;


    -- ------------------------------------------------------------------------
    -- Required fields
    -- ------------------------------------------------------------------------

    IF p_auth_user_id IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Auth user ID is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(TRIM(p_full_name), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Agent full name is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(TRIM(p_phone), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Agent mobile number is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF p_email IS NULL OR NULLIF(TRIM(p_email::TEXT), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Agent email is required'
            USING ERRCODE = 'P0004';
    END IF;

    IF NULLIF(TRIM(p_branch), '') IS NULL THEN
        RAISE EXCEPTION
            'VALIDATION_ERROR: Agent branch is required'
            USING ERRCODE = 'P0004';
    END IF;


    -- ------------------------------------------------------------------------
    -- Duplicate Auth/Profile protection
    -- ------------------------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM profiles
        WHERE auth_user_id = p_auth_user_id
    ) THEN
        RAISE EXCEPTION
            'DUPLICATE: BNPS profile already exists for this Auth user'
            USING ERRCODE = 'P0004';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM profiles
        WHERE LOWER(email::TEXT) = LOWER(p_email::TEXT)
    ) THEN
        RAISE EXCEPTION
            'DUPLICATE: Email is already registered in BNPS'
            USING ERRCODE = 'P0004';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM profiles
        WHERE phone = p_phone
    ) THEN
        RAISE EXCEPTION
            'DUPLICATE: Mobile number is already registered in BNPS'
            USING ERRCODE = 'P0004';
    END IF;


    -- ------------------------------------------------------------------------
    -- Sponsor validation
    -- ------------------------------------------------------------------------

    IF p_sponsor_agent_id IS NOT NULL THEN

        IF NOT EXISTS (
            SELECT 1
            FROM agents
            WHERE id = p_sponsor_agent_id
              AND is_active = true
        ) THEN

            RAISE EXCEPTION
                'VALIDATION_ERROR: Sponsor agent not found or inactive'
                USING ERRCODE = 'P0004';

        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- Generate unique Agent Code
    --
    -- Existing format:
    -- BNPS-AG-101
    --
    -- Advisory transaction lock prevents concurrent duplicate generation.
    -- ------------------------------------------------------------------------

    PERFORM pg_advisory_xact_lock(
        hashtextextended('bnps-agent-code-generation', 0)
    );

    SELECT
        COALESCE(
            MAX(
                SUBSTRING(agent_code FROM '^BNPS-AG-([0-9]+)$')::BIGINT
            ),
            0
        ) + 1
    INTO v_next_agent_number
    FROM agents;

    v_agent_code :=
        'BNPS-AG-' ||
        LPAD(v_next_agent_number::TEXT, 3, '0');


    -- ------------------------------------------------------------------------
    -- Create BNPS Profile
    -- ------------------------------------------------------------------------

    INSERT INTO profiles (
        auth_user_id,
        full_name,
        email,
        phone,
        role,
        branch,
        is_active,
        is_test
    )
    VALUES (
        p_auth_user_id,
        TRIM(p_full_name),
        p_email,
        p_phone,
        'agent',
        p_branch,
        true,
        false
    )
    RETURNING id
    INTO v_profile_id;


    -- ------------------------------------------------------------------------
    -- Create Agent
    -- ------------------------------------------------------------------------

    INSERT INTO agents (
        profile_id,
        agent_code,
        branch,
        sponsor_agent_id,
        hierarchy_level,
        pan_number,
        bank_account_no,
        bank_name,
        bank_ifsc,
        tds_percentage,
        is_active,
        is_test
    )
    VALUES (
        v_profile_id,
        v_agent_code,
        p_branch,
        p_sponsor_agent_id,
        10,
        p_pan_number,
        p_bank_account_no,
        p_bank_name,
        p_bank_ifsc,
        COALESCE(p_tds_percentage, 5.00),
        true,
        false
    )
    RETURNING id
    INTO v_agent_id;


    -- ------------------------------------------------------------------------
    -- Audit
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
        'AGENT_CREATED',
        'agents',
        v_agent_id,
        jsonb_build_object(
            'agent_code', v_agent_code,
            'profile_id', v_profile_id,
            'full_name', p_full_name,
            'email', p_email,
            'phone', p_phone,
            'branch', p_branch,
            'sponsor_agent_id', p_sponsor_agent_id
        )
    );


    -- ------------------------------------------------------------------------
    -- Result
    -- ------------------------------------------------------------------------

    RETURN jsonb_build_object(
        'success', true,
        'agent_id', v_agent_id,
        'profile_id', v_profile_id,
        'agent_code', v_agent_code,
        'auth_user_id', p_auth_user_id
    );

END;
$$;


-- ============================================================================
-- 4. RPC SECURITY
-- ============================================================================

REVOKE ALL ON FUNCTION create_agent_atomic(
    UUID,
    TEXT,
    CITEXT,
    VARCHAR(20),
    VARCHAR(64),
    UUID,
    VARCHAR(10),
    TEXT,
    TEXT,
    VARCHAR(11),
    NUMERIC(5,2)
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_agent_atomic(
    UUID,
    TEXT,
    CITEXT,
    VARCHAR(20),
    VARCHAR(64),
    UUID,
    VARCHAR(10),
    TEXT,
    TEXT,
    VARCHAR(11),
    NUMERIC(5,2)
) TO authenticated;


-- ============================================================================
-- END
-- ============================================================================