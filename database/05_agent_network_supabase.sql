-- ============================================================================
-- BNPS ERP v0.3 — Agent Network Supabase implementation
-- ============================================================================
-- Run after 01_phase1_ddl_and_constraints.sql and 02_rls_and_security.sql.
-- This migration removes Agent Network dependence on erpStore.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS branch TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch);

CREATE OR REPLACE FUNCTION get_agent_network(
  p_search TEXT DEFAULT '',
  p_branch TEXT DEFAULT NULL,
  p_hierarchy_level INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  agent_code VARCHAR(32),
  branch TEXT,
  sponsor_agent_id UUID,
  hierarchy_level INT,
  pan_number TEXT,
  aadhaar_masked TEXT,
  bank_account_no TEXT,
  bank_name TEXT,
  bank_ifsc TEXT,
  tds_percentage NUMERIC(5,2),
  total_commission_earned NUMERIC(14,2),
  total_commission_paid NUMERIC(14,2),
  outstanding_advance NUMERIC(14,2),
  is_active BOOLEAN,
  is_test BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  sponsor_name TEXT,
  sponsor_code VARCHAR(32)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID := current_auth_profile_id();
  v_role user_role_type := current_user_role();
  v_q TEXT := lower(trim(coalesce(p_search, '')));
  v_can_all BOOLEAN := false;
BEGIN
  IF v_profile_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION: Authenticated ERP profile required'
      USING ERRCODE = 'P0004';
  END IF;

  v_can_all := v_role IN ('super_admin','office_admin','branch_manager','accountant');

  RETURN QUERY
  SELECT
    a.id,
    a.profile_id,
    a.agent_code,
    p.branch,
    a.sponsor_agent_id,
    a.hierarchy_level,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.pan_number::TEXT ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.aadhaar_masked::TEXT ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.bank_account_no::TEXT ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.bank_name::TEXT ELSE NULL END,
    CASE WHEN v_can_all OR a.profile_id = v_profile_id THEN a.bank_ifsc::TEXT ELSE NULL END,
    a.tds_percentage,
    a.total_commission_earned,
    a.total_commission_paid,
    a.outstanding_advance,
    a.is_active,
    a.is_test,
    a.created_at,
    a.updated_at,
    p.full_name,
    p.phone,
    p.email::TEXT,
    sp.full_name,
    sa.agent_code
  FROM agents a
  JOIN profiles p ON p.id = a.profile_id
  LEFT JOIN agents sa ON sa.id = a.sponsor_agent_id
  LEFT JOIN profiles sp ON sp.id = sa.profile_id
  WHERE
    (
      v_can_all
      OR a.profile_id = v_profile_id
    )
    AND (p_branch IS NULL OR p.branch = p_branch)
    AND (p_hierarchy_level IS NULL OR a.hierarchy_level = p_hierarchy_level)
    AND (
      v_q = ''
      OR lower(a.agent_code) LIKE '%' || v_q || '%'
      OR lower(p.full_name) LIKE '%' || v_q || '%'
      OR p.phone LIKE '%' || v_q || '%'
      OR lower(coalesce(p.email::TEXT,'')) LIKE '%' || v_q || '%'
      OR lower(coalesce(p.branch,'')) LIKE '%' || v_q || '%'
      OR lower(coalesce(sp.full_name,'')) LIKE '%' || v_q || '%'
      OR lower(coalesce(sa.agent_code,'')) LIKE '%' || v_q || '%'
    )
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_agent_network(TEXT,TEXT,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_agent_network(TEXT,TEXT,INT) TO authenticated;

CREATE OR REPLACE FUNCTION create_agent_atomic(
  p_auth_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_branch TEXT,
  p_sponsor_agent_id UUID DEFAULT NULL,
  p_pan_number TEXT DEFAULT NULL,
  p_bank_account_no TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_ifsc TEXT DEFAULT NULL,
  p_tds_percentage NUMERIC(5,2) DEFAULT 5.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := current_auth_profile_id();
  v_role user_role_type := current_user_role();
  v_profile_id UUID;
  v_agent_id UUID;
  v_agent_code VARCHAR(32);
  v_sponsor_exists BOOLEAN;
  v_attempt INT := 0;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('super_admin','office_admin','branch_manager') THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION: Agent onboarding requires authorized management role'
      USING ERRCODE = 'P0004';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Supabase Auth user id is required' USING ERRCODE = 'P0004';
  END IF;

  IF NULLIF(BTRIM(p_full_name),'') IS NULL OR NULLIF(BTRIM(p_phone),'') IS NULL
     OR NULLIF(BTRIM(p_email),'') IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Name, phone and email are required' USING ERRCODE = 'P0004';
  END IF;

  IF p_sponsor_agent_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM agents WHERE id = p_sponsor_agent_id AND is_active = true)
      INTO v_sponsor_exists;
    IF NOT v_sponsor_exists THEN
      RAISE EXCEPTION 'RECORD_NOT_FOUND: Selected sponsor agent does not exist or is inactive'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'DUPLICATE_PROFILE: Supabase Auth user is already linked to an ERP profile'
      USING ERRCODE = 'P0005';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE phone = BTRIM(p_phone)) THEN
    RAISE EXCEPTION 'DUPLICATE_AGENT: Mobile number is already registered'
      USING ERRCODE = 'P0005';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE email = BTRIM(p_email)::citext) THEN
    RAISE EXCEPTION 'DUPLICATE_AGENT: Email address is already registered'
      USING ERRCODE = 'P0005';
  END IF;

  INSERT INTO profiles (
    auth_user_id, full_name, email, phone, role, branch, is_active, is_test
  )
  VALUES (
    p_auth_user_id, BTRIM(p_full_name), BTRIM(p_email), BTRIM(p_phone),
    'agent', BTRIM(p_branch), true, false
  )
  RETURNING id INTO v_profile_id;

  LOOP
    v_attempt := v_attempt + 1;
    v_agent_code := 'AGT' || LPAD((FLOOR(RANDOM() * 90000) + 10000)::INT::TEXT, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM agents WHERE agent_code = v_agent_code);
    IF v_attempt >= 20 THEN
      RAISE EXCEPTION 'SYSTEM_ERROR: Could not allocate a unique agent code';
    END IF;
  END LOOP;

  INSERT INTO agents (
    profile_id, agent_code, sponsor_agent_id, hierarchy_level,
    pan_number, bank_account_no, bank_name, bank_ifsc, tds_percentage,
    is_active, is_test
  )
  VALUES (
    v_profile_id, v_agent_code, p_sponsor_agent_id, 10,
    NULLIF(UPPER(BTRIM(p_pan_number)), ''),
    NULLIF(BTRIM(p_bank_account_no), ''),
    NULLIF(BTRIM(p_bank_name), ''),
    NULLIF(UPPER(BTRIM(p_bank_ifsc)), ''),
    COALESCE(p_tds_percentage, 5.00),
    true, false
  )
  RETURNING id INTO v_agent_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (
    v_actor, 'AGENT_ONBOARDED', 'agents', v_agent_id,
    jsonb_build_object(
      'agent_code', v_agent_code,
      'profile_id', v_profile_id,
      'sponsor_agent_id', p_sponsor_agent_id,
      'branch', p_branch
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'agent_id', v_agent_id,
    'profile_id', v_profile_id,
    'agent_code', v_agent_code
  );
END;
$$;

REVOKE ALL ON FUNCTION create_agent_atomic(
  UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_agent_atomic(
  UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,NUMERIC
) TO authenticated;
