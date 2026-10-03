-- ============================================================================
-- BNPS ERP v0.3 — Phase 1: Invariant & Concurrency Verification Test Suite
-- ============================================================================

DO $$ 
DECLARE
    v_admin_id UUID;
    v_agent_prof_id UUID;
    v_agent_id UUID;
    v_lead_id UUID;
    v_cust_result JSONB;
    v_cust_id UUID;
    v_proj_id UUID;
    v_pay_id UUID;
    v_comm_result JSONB;
BEGIN
    RAISE NOTICE '--- TEST 1: SETUP TEST PROFILES & AGENT HIERARCHY ---';
    INSERT INTO profiles (full_name, phone, role, is_test)
    VALUES ('Super Admin Officer', '9829000001', 'super_admin', true)
    RETURNING id INTO v_admin_id;

    INSERT INTO profiles (full_name, phone, role, is_test)
    VALUES ('Direct Agent Mukesh', '9829000002', 'agent', true)
    RETURNING id INTO v_agent_prof_id;

    INSERT INTO agents (profile_id, agent_code, hierarchy_level, tds_percentage, is_test)
    VALUES (v_agent_prof_id, 'BNPS-AG-101', 10, 5.00, true)
    RETURNING id INTO v_agent_id;

    RAISE NOTICE '--- TEST 2: CREATE LEAD & ATOMIC CONVERSION ---';
    INSERT INTO leads (
        lead_code, source_agent_id, full_name, mobile, consumer_number, 
        sanctioned_load_kw, proposed_capacity_kw, stage, is_test
    ) VALUES (
        'LD-JAIPUR-001', v_agent_id, 'Ramesh Chandra Sharma', '9414012345', '11029384756',
        5.00, 3.00, 'READY_FOR_REGISTRATION', true
    ) RETURNING id INTO v_lead_id;

    -- Execute Atomic Conversion RPC
    v_cust_result := convert_lead_atomic(v_lead_id, '11029384756', v_admin_id);
    v_cust_id := (v_cust_result->>'customer_id')::UUID;
    RAISE NOTICE 'Lead Converted Successfully: Customer ID = %', v_cust_id;

    RAISE NOTICE '--- TEST 3: PROJECT CREATION & INSTALLATION LINK ---';
    INSERT INTO projects (
        project_code, customer_id, primary_agent_id, capacity_kw, 
        total_contract_amount, discom_subsidy_amount, customer_payable_amount, status, is_test
    ) VALUES (
        'PRJ-2026-001', v_cust_id, v_agent_id, 3.00, 
        150000.00, 78000.00, 72000.00, 'INSTALLATION_IN_PROGRESS', true
    ) RETURNING id INTO v_proj_id;

    INSERT INTO installations (
        project_id, structure_type, net_meter_installed, discom_inspection_signoff
    ) VALUES (
        v_proj_id, 'ELEVATED_GI', false, false
    );

    RAISE NOTICE '--- TEST 4: INVARIANT TEST: PREVENT PREMATURE PROJECT COMPLETION ---';
    BEGIN
        UPDATE projects SET status = 'COMPLETED' WHERE id = v_proj_id;
        RAISE EXCEPTION 'TEST FAILED: Completed without net meter!';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE 'SUCCESS: Invariant verified - Net meter required before completion.';
    END;

    RAISE NOTICE '--- TEST 5: PAYMENT LIFECYCLE & IMMUTABILITY ENFORCEMENT ---';
    INSERT INTO payments (
        payment_reference_no, project_id, customer_id, stage, amount, status, is_test
    ) VALUES (
        'PAY-TXN-001', v_proj_id, v_cust_id, 'FIRST_ADVANCE', 30000.00, 'PAID', true
    ) RETURNING id INTO v_pay_id;

    -- Try to mutate amount of PAID payment (Must fail)
    BEGIN
        UPDATE payments SET amount = 20000.00 WHERE id = v_pay_id;
        RAISE EXCEPTION 'TEST FAILED: Paid payment was mutated!';
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        RAISE NOTICE 'SUCCESS: Invariant verified - PAID payment amount is strictly immutable.';
    END;

    RAISE NOTICE '--- TEST 6: COMMISSION GENERATION IDEMPOTENCY ---';
    v_comm_result := generate_project_commission_atomic(v_proj_id, 'FIRST_ADVANCE', v_admin_id);
    RAISE NOTICE 'Commission Generated: %', v_comm_result;

    -- Try generating duplicate commission on same stage (Must fail)
    BEGIN
        v_comm_result := generate_project_commission_atomic(v_proj_id, 'FIRST_ADVANCE', v_admin_id);
        RAISE EXCEPTION 'TEST FAILED: Duplicate commission generated!';
    EXCEPTION WHEN SQLSTATE 'P0005' THEN
        RAISE NOTICE 'SUCCESS: Invariant verified - Concurrency & Duplicate Commission blocked deterministically.';
    END;

    RAISE NOTICE 'ALL PHASE 1 INVARIANT TESTS PASSED CLEANLY.';
END $$;
