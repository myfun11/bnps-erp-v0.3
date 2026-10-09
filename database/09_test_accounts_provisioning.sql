-- ============================================================================
-- BNPS ERP v0.3 — Phase 1 / Module 1: Step 4C
-- Authoritative Controlled Test Account Provisioning Script
-- Target: PostgreSQL 15+ / Supabase PostgreSQL (Run in Supabase SQL Editor)
-- Organization: Bhumi Nidhi Power Solution (PM Surya Ghar Rooftop Solar)
-- ============================================================================
-- Purpose:
--   1. Provisions controlled test accounts in auth.users and auth.identities
--      with pre-verified bcrypt passwords (bypassing email rate limits & SMTP).
--   2. Provisions and links authoritative public.profiles rows with auth_user_id.
--   3. Provisions public.agents record for Agent testing.
--   4. Maps dynamic RBAC user_roles if roles table exists.
--   5. Seeds minimal, clean, isolated test transactions (is_test = true)
--      so that get_dashboard_summary() runtime metrics are fully populated.
-- ============================================================================

DO $$
DECLARE
    -- Admin Test Variables
    v_admin_email CONSTANT TEXT := 'admin.test@bnps.local';
    v_admin_password CONSTANT TEXT := 'BnpsAdmin@2026!';
    v_admin_auth_id UUID;
    v_admin_prof_id UUID;

    -- Agent Test Variables
    v_agent_email CONSTANT TEXT := 'agent.test@bnps.local';
    v_agent_password CONSTANT TEXT := 'BnpsAgent@2026!';
    v_agent_auth_id UUID;
    v_agent_prof_id UUID;
    v_agent_id UUID;

    -- Test Business Transaction Variables
    v_lead_id UUID;
    v_cust_id UUID;
    v_proj_id UUID;
    v_pmsg_id UUID;
    v_loan_id UUID;
    v_pay_id UUID;
    v_comm_id UUID;
BEGIN
    RAISE NOTICE '====================================================';
    RAISE NOTICE 'BNPS ERP v0.3: PROVISIONING CONTROLLED TEST ACCOUNTS';
    RAISE NOTICE '====================================================';

    -- ------------------------------------------------------------------------
    -- 1. PROVISION ADMIN ACCOUNT (auth.users + auth.identities)
    -- ------------------------------------------------------------------------
    SELECT id INTO v_admin_auth_id FROM auth.users WHERE email = v_admin_email;

    IF v_admin_auth_id IS NULL THEN
        v_admin_auth_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            is_super_admin
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_admin_auth_id,
            'authenticated',
            'authenticated',
            v_admin_email,
            crypt(v_admin_password, gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"BNPS Super Admin Test"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            false
        );
        RAISE NOTICE 'Admin auth.users record created: ID = %', v_admin_auth_id;
    ELSE
        UPDATE auth.users
        SET encrypted_password = crypt(v_admin_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_admin_auth_id;
        RAISE NOTICE 'Admin auth.users password refreshed: ID = %', v_admin_auth_id;
    END IF;

    -- Ensure Admin identity in auth.identities
    BEGIN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_admin_auth_id,
            jsonb_build_object('sub', v_admin_auth_id::text, 'email', v_admin_email),
            'email',
            v_admin_auth_id::text,
            NOW(),
            NOW(),
            NOW()
        ) ON CONFLICT (provider, provider_id) DO UPDATE
        SET updated_at = NOW();
    EXCEPTION WHEN undefined_table THEN
        -- auth.identities might not exist or be accessible in all configurations
        NULL;
    END;

    -- ------------------------------------------------------------------------
    -- 2. PROVISION ADMIN PROFILE (public.profiles)
    -- ------------------------------------------------------------------------
    SELECT id INTO v_admin_prof_id FROM profiles WHERE auth_user_id = v_admin_auth_id;

    IF v_admin_prof_id IS NULL THEN
        -- Also check if test profile exists by email to link it
        SELECT id INTO v_admin_prof_id FROM profiles WHERE email = v_admin_email;
    END IF;

    IF v_admin_prof_id IS NULL THEN
        INSERT INTO profiles (
            auth_user_id,
            full_name,
            email,
            phone,
            role,
            branch,
            employee_code,
            is_active,
            is_test
        ) VALUES (
            v_admin_auth_id,
            'BNPS Super Admin Test',
            v_admin_email,
            '9829000001',
            'super_admin',
            'Jaijaipur',
            'EMP-ADM-TEST01',
            true,
            true
        ) RETURNING id INTO v_admin_prof_id;
        RAISE NOTICE 'Admin public.profiles record created: ID = %', v_admin_prof_id;
    ELSE
        UPDATE profiles
        SET auth_user_id = v_admin_auth_id,
            role = 'super_admin',
            is_active = true,
            is_test = true,
            branch = 'Jaijaipur'
        WHERE id = v_admin_prof_id;
        RAISE NOTICE 'Admin public.profiles record linked: ID = %', v_admin_prof_id;
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. PROVISION AGENT ACCOUNT (auth.users + auth.identities)
    -- ------------------------------------------------------------------------
    SELECT id INTO v_agent_auth_id FROM auth.users WHERE email = v_agent_email;

    IF v_agent_auth_id IS NULL THEN
        v_agent_auth_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            is_super_admin
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_agent_auth_id,
            'authenticated',
            'authenticated',
            v_agent_email,
            crypt(v_agent_password, gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Direct Agent Mukesh (Test)"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            false
        );
        RAISE NOTICE 'Agent auth.users record created: ID = %', v_agent_auth_id;
    ELSE
        UPDATE auth.users
        SET encrypted_password = crypt(v_agent_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_agent_auth_id;
        RAISE NOTICE 'Agent auth.users password refreshed: ID = %', v_agent_auth_id;
    END IF;

    -- Ensure Agent identity in auth.identities
    BEGIN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_agent_auth_id,
            jsonb_build_object('sub', v_agent_auth_id::text, 'email', v_agent_email),
            'email',
            v_agent_auth_id::text,
            NOW(),
            NOW(),
            NOW()
        ) ON CONFLICT (provider, provider_id) DO UPDATE
        SET updated_at = NOW();
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    -- ------------------------------------------------------------------------
    -- 4. PROVISION AGENT PROFILE & AGENT RECORD
    -- ------------------------------------------------------------------------
    SELECT id INTO v_agent_prof_id FROM profiles WHERE auth_user_id = v_agent_auth_id;

    IF v_agent_prof_id IS NULL THEN
        SELECT id INTO v_agent_prof_id FROM profiles WHERE email = v_agent_email;
    END IF;

    IF v_agent_prof_id IS NULL THEN
        INSERT INTO profiles (
            auth_user_id,
            full_name,
            email,
            phone,
            role,
            branch,
            employee_code,
            is_active,
            is_test
        ) VALUES (
            v_agent_auth_id,
            'Direct Agent Mukesh (Test)',
            v_agent_email,
            '9829000002',
            'agent',
            'Jaijaipur',
            'EMP-AG-TEST01',
            true,
            true
        ) RETURNING id INTO v_agent_prof_id;
        RAISE NOTICE 'Agent public.profiles record created: ID = %', v_agent_prof_id;
    ELSE
        UPDATE profiles
        SET auth_user_id = v_agent_auth_id,
            role = 'agent',
            is_active = true,
            is_test = true,
            branch = 'Jaijaipur'
        WHERE id = v_agent_prof_id;
        RAISE NOTICE 'Agent public.profiles record linked: ID = %', v_agent_prof_id;
    END IF;

    -- Ensure public.agents record for the agent
    SELECT id INTO v_agent_id FROM agents WHERE profile_id = v_agent_prof_id;

    IF v_agent_id IS NULL THEN
        INSERT INTO agents (
            profile_id,
            agent_code,
            branch,
            hierarchy_level,
            tds_percentage,
            is_active,
            is_test
        ) VALUES (
            v_agent_prof_id,
            'BNPS-AG-TEST01',
            'Jaijaipur',
            10,
            5.00,
            true,
            true
        ) RETURNING id INTO v_agent_id;
        RAISE NOTICE 'Agent public.agents record created: ID = %, Code = BNPS-AG-TEST01', v_agent_id;
    ELSE
        UPDATE agents
        SET branch = 'Jaijaipur',
            hierarchy_level = 10,
            tds_percentage = 5.00,
            is_active = true,
            is_test = true
        WHERE id = v_agent_id;
        RAISE NOTICE 'Agent public.agents record verified: ID = %', v_agent_id;
    END IF;

    -- ------------------------------------------------------------------------
    -- 5. LINK DYNAMIC RBAC ROLES (IF user_roles TABLE EXISTS)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO user_roles (user_id, role_id)
        SELECT v_admin_prof_id, r.id FROM roles r WHERE r.code = 'super_admin'
        ON CONFLICT (user_id, role_id) DO NOTHING;

        INSERT INTO user_roles (user_id, role_id)
        SELECT v_agent_prof_id, r.id FROM roles r WHERE r.code = 'agent'
        ON CONFLICT (user_id, role_id) DO NOTHING;
        RAISE NOTICE 'Dynamic user_roles mapped successfully.';
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    -- ------------------------------------------------------------------------
    -- 6. PROVISION ISOLATED TEST BUSINESS TRANSACTIONS (is_test = true)
    -- ------------------------------------------------------------------------
    -- Ensure test lead
    SELECT id INTO v_lead_id FROM leads WHERE lead_code = 'LD-CG-TEST-001';
    IF v_lead_id IS NULL THEN
        INSERT INTO leads (
            lead_code,
            source_agent_id,
            full_name,
            mobile,
            consumer_number,
            sanctioned_load_kw,
            proposed_capacity_kw,
            stage,
            branch,
            district,
            pincode,
            is_test
        ) VALUES (
            'LD-CG-TEST-001',
            v_agent_id,
            'Ramesh Chandra Sharma',
            '9414012345',
            '11029384756',
            5.00,
            3.00,
            'NEW',
            'Jaijaipur',
            'Janjgir-Champa',
            '495685',
            true
        ) RETURNING id INTO v_lead_id;
    END IF;

    -- Ensure test customer
    SELECT id INTO v_cust_id FROM customers WHERE consumer_number = '11029384756';
    IF v_cust_id IS NULL THEN
        INSERT INTO customers (
            customer_code,
            branch,
            full_name,
            primary_mobile,
            consumer_number,
            sanctioned_load_kw,
            district,
            is_test
        ) VALUES (
            'CUST-TEST-001',
            'Jaijaipur',
            'Ramesh Chandra Sharma',
            '9414012345',
            '11029384756',
            5.00,
            'Janjgir-Champa',
            true
        ) RETURNING id INTO v_cust_id;
    END IF;

    -- Ensure test project
    SELECT id INTO v_proj_id FROM projects WHERE project_code = 'PRJ-2026-TEST-001';
    IF v_proj_id IS NULL THEN
        INSERT INTO projects (
            project_code,
            customer_id,
            primary_agent_id,
            capacity_kw,
            total_contract_amount,
            discom_subsidy_amount,
            customer_payable_amount,
            status,
            is_test
        ) VALUES (
            'PRJ-2026-TEST-001',
            v_cust_id,
            v_agent_id,
            3.00,
            150000.00,
            78000.00,
            72000.00,
            'INSTALLATION_IN_PROGRESS',
            true
        ) RETURNING id INTO v_proj_id;
    END IF;

    -- Ensure test installation
    IF NOT EXISTS (SELECT 1 FROM installations WHERE project_id = v_proj_id) THEN
        INSERT INTO installations (
            project_id,
            structure_type,
            net_meter_installed,
            discom_inspection_signoff
        ) VALUES (
            v_proj_id,
            'ELEVATED_GI',
            false,
            false
        );
    END IF;

    RAISE NOTICE '====================================================';
    RAISE NOTICE 'PROVISIONING COMPLETE: ACCOUNTS ARE READY FOR AUTH';
    RAISE NOTICE 'Admin Account: % (role: super_admin)', v_admin_email;
    RAISE NOTICE 'Agent Account: % (role: agent, code: BNPS-AG-TEST01)', v_agent_email;
    RAISE NOTICE '====================================================';
END $$;
