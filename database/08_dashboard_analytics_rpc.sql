-- ============================================================================
-- BNPS ERP v0.3 — Phase 1 / Module 1: Dashboard Analytics RPC
-- Organization: Bhumi Nidhi Power Solution (PM Surya Ghar Rooftop Solar)
-- Target Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- ============================================================================
-- Function: get_dashboard_summary()
-- Security: SECURITY DEFINER with hardened search_path
-- Caller Identity: Authoritative auth.uid() -> profiles resolution only
-- Client-Supplied Scope: NONE (role, profile_id, branch are NEVER trusted from client)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    -- Identity & Authorization Variables
    v_auth_uid UUID;
    v_profile_id UUID;
    v_full_name TEXT;
    v_role user_role_type;
    v_branch VARCHAR(64);
    v_is_active BOOLEAN;
    v_is_global BOOLEAN := false;
    v_agent_id UUID;
    v_agent_code VARCHAR(32);

    -- KPI Metrics Variables
    v_total_leads INT := 0;
    v_new_leads_waiting INT := 0;
    v_converted_customers INT := 0;
    v_registered_on_portal INT := 0;
    v_pending_registrations INT := 0;
    v_installations_total INT := 0;
    v_installations_completed INT := 0;
    v_installations_pending INT := 0;
    v_loans_disbursed_amount NUMERIC(14, 2) := 0.00;
    v_loans_pending_approval_count INT := 0;
    v_vendor_payments_pending_count INT := 0;
    v_vendor_payments_paid_amount NUMERIC(14, 2) := 0.00;
    v_commission_generated_amount NUMERIC(14, 2) := 0.00;
    v_commission_paid_amount NUMERIC(14, 2) := 0.00;
    v_active_agents_count INT := 0;
    v_total_agents_count INT := 0;

    -- Trend & Leaderboard Variables
    v_monthly_installations JSONB := '[]'::jsonb;
    v_top_agents JSONB := '[]'::jsonb;
BEGIN
    -- 1. AUTHENTICATION & IDENTITY RESOLUTION
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Unauthenticated session'
            USING ERRCODE = '42501';
    END IF;

    SELECT id, full_name, role, branch, is_active
    INTO v_profile_id, v_full_name, v_role, v_branch, v_is_active
    FROM profiles
    WHERE auth_user_id = v_auth_uid
    LIMIT 1;

    IF v_profile_id IS NULL OR v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Profile is inactive or not found for authenticated user'
            USING ERRCODE = '42501';
    END IF;

    -- 2. DETERMINE OPERATIONAL SCOPE (AUTHORIZATION LOGIC)
    -- Global Scope: Directors & Head Office leadership
    v_is_global := (v_role IN ('super_admin', 'office_admin', 'accountant'));

    -- Resolve Agent Identity if caller is an agent
    IF v_role = 'agent' THEN
        SELECT id, agent_code
        INTO v_agent_id, v_agent_code
        FROM agents
        WHERE profile_id = v_profile_id
        LIMIT 1;
    END IF;

    -- 3. KPI 1: LEADS METRICS
    SELECT 
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE stage = 'NEW')::INT
    INTO v_total_leads, v_new_leads_waiting
    FROM leads l
    WHERE l.is_test = false
      AND l.stage <> 'LOST'
      AND (
          v_is_global
          OR (v_role = 'branch_manager' AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(l.branch, ''))) = LOWER(TRIM(v_branch)))
          OR (v_role = 'agent' AND l.source_agent_id = v_agent_id)
          OR (v_role IN ('field_officer', 'operational_manager') AND (l.assigned_officer_id = v_profile_id OR (v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(l.branch, ''))) = LOWER(TRIM(v_branch)))))
          OR (v_role IN ('receptionist', 'backoffice', 'technician') AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(l.branch, ''))) = LOWER(TRIM(v_branch)))
      );

    -- 4. KPI 2: CONVERTED CUSTOMERS
    SELECT 
        COUNT(DISTINCT c.id)::INT
    INTO v_converted_customers
    FROM customers c
    LEFT JOIN acquisitions a ON a.customer_id = c.id AND a.is_test = false
    WHERE c.is_test = false
      AND (
          v_is_global
          OR (v_role = 'branch_manager' AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
          OR (v_role = 'agent' AND a.sourcing_agent_id = v_agent_id)
          OR (v_role IN ('field_officer', 'operational_manager', 'technician', 'backoffice', 'receptionist') 
              AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
      );

    -- 5. KPI 3: PM SURYA GHAR PORTAL REGISTRATIONS (MUTUALLY EXCLUSIVE & DISTINCT)
    SELECT 
        COUNT(DISTINCT pt.id) FILTER (
            WHERE pt.stage <> 'REJECTED' 
              AND (pt.portal_application_no IS NOT NULL OR pt.stage <> 'INITIATED')
        )::INT,
        COUNT(DISTINCT pt.id) FILTER (
            WHERE pt.stage = 'INITIATED' 
              AND pt.portal_application_no IS NULL 
              AND pt.stage <> 'REJECTED'
        )::INT
    INTO v_registered_on_portal, v_pending_registrations
    FROM pmsg_tracking pt
    JOIN customers c ON pt.customer_id = c.id
    LEFT JOIN acquisitions a ON a.customer_id = c.id AND a.is_test = false
    WHERE pt.is_test = false
      AND c.is_test = false
      AND (
          v_is_global
          OR (v_role = 'branch_manager' AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
          OR (v_role = 'agent' AND a.sourcing_agent_id = v_agent_id)
          OR (v_role IN ('field_officer', 'operational_manager', 'technician', 'backoffice', 'receptionist') 
              AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
      );

    -- 6. KPI 4: SOLAR INSTALLATIONS (COMPLETED / TOTAL RATIO)
    SELECT 
        COUNT(p.id)::INT,
        COUNT(p.id) FILTER (WHERE i.net_meter_installed = true OR p.status = 'COMPLETED')::INT,
        COUNT(p.id) FILTER (WHERE (i.net_meter_installed IS NOT TRUE AND p.status <> 'COMPLETED') AND p.status <> 'CANCELLED')::INT
    INTO v_installations_total, v_installations_completed, v_installations_pending
    FROM projects p
    JOIN customers c ON p.customer_id = c.id
    LEFT JOIN installations i ON i.project_id = p.id
    WHERE p.is_test = false
      AND c.is_test = false
      AND p.status <> 'CANCELLED'
      AND (
          v_is_global
          OR (v_role = 'branch_manager' AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
          OR (v_role = 'agent' AND p.primary_agent_id = v_agent_id)
          OR (v_role = 'technician' AND (i.technician_profile_id = v_profile_id OR (v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))))
          OR (v_role IN ('field_officer', 'operational_manager', 'backoffice') 
              AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
      );

    -- 7. KPI 5: BANK LOANS DISBURSED
    SELECT 
        COALESCE(SUM(l.disbursed_amount) FILTER (WHERE l.status = 'DISBURSED'), 0.00)::NUMERIC(14, 2),
        COUNT(*) FILTER (WHERE l.status IN ('APPLIED', 'DOCUMENTS_SUBMITTED'))::INT
    INTO v_loans_disbursed_amount, v_loans_pending_approval_count
    FROM loans l
    JOIN projects p ON l.project_id = p.id
    JOIN customers c ON l.customer_id = c.id
    WHERE p.is_test = false
      AND c.is_test = false
      AND (
          v_is_global
          OR (v_role = 'branch_manager' AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
          OR (v_role = 'agent' AND p.primary_agent_id = v_agent_id)
          OR (v_role IN ('field_officer', 'operational_manager', 'backoffice') 
              AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
      );

    -- 8. KPI 6: VENDOR PAYMENTS
    -- NOTE: Agents MUST NOT see vendor financials; redacted to 0 for agents.
    IF v_role = 'agent' THEN
        v_vendor_payments_pending_count := 0;
        v_vendor_payments_paid_amount := 0.00;
    ELSE
        SELECT 
            COUNT(*) FILTER (WHERE pay.status = 'PENDING_APPROVAL')::INT,
            COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'PAID'), 0.00)::NUMERIC(14, 2)
        INTO v_vendor_payments_pending_count, v_vendor_payments_paid_amount
        FROM payments pay
        JOIN projects p ON pay.project_id = p.id
        JOIN customers c ON p.customer_id = c.id
        WHERE pay.is_test = false
          AND p.is_test = false
          AND c.is_test = false
          AND (
              v_is_global
              OR (v_role IN ('branch_manager', 'operational_manager', 'backoffice') AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
          );
    END IF;

    -- 9. KPI 7: COMMISSION GENERATED & PAID
    IF v_role = 'agent' THEN
        -- Sourced Agent sees ONLY their own earned and paid commissions
        SELECT 
            COALESCE(SUM(ct.net_commission), 0.00)::NUMERIC(14, 2),
            COALESCE(SUM(ct.net_commission) FILTER (WHERE ct.is_paid_out = true), 0.00)::NUMERIC(14, 2)
        INTO v_commission_generated_amount, v_commission_paid_amount
        FROM commission_transactions ct
        WHERE ct.agent_id = v_agent_id
          AND ct.is_test = false;
    ELSE
        -- Management & Accountants see scoped commission totals
        SELECT 
            COALESCE(SUM(ct.net_commission), 0.00)::NUMERIC(14, 2),
            COALESCE(SUM(ct.net_commission) FILTER (WHERE ct.is_paid_out = true), 0.00)::NUMERIC(14, 2)
        INTO v_commission_generated_amount, v_commission_paid_amount
        FROM commission_transactions ct
        JOIN agents ag ON ct.agent_id = ag.id
        WHERE ct.is_test = false
          AND ag.is_test = false
          AND (
              v_is_global
              OR (v_role IN ('branch_manager', 'operational_manager', 'backoffice') AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(ag.branch, ''))) = LOWER(TRIM(v_branch)))
          );
    END IF;

    -- 10. KPI 8: ACTIVE AGENTS
    IF v_role = 'agent' THEN
        -- Agent sees downline network count (sponsoring Level 10 downlines) + self
        SELECT 
            COUNT(*) FILTER (WHERE a.is_active = true)::INT,
            COUNT(*)::INT
        INTO v_active_agents_count, v_total_agents_count
        FROM agents a
        WHERE a.is_test = false
          AND (a.sponsor_agent_id = v_agent_id OR a.id = v_agent_id);
    ELSE
        SELECT 
            COUNT(*) FILTER (WHERE a.is_active = true)::INT,
            COUNT(*)::INT
        INTO v_active_agents_count, v_total_agents_count
        FROM agents a
        WHERE a.is_test = false
          AND (
              v_is_global
              OR (v_role IN ('branch_manager', 'field_officer', 'operational_manager', 'backoffice', 'receptionist') AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(a.branch, ''))) = LOWER(TRIM(v_branch)))
          );
    END IF;

    -- 11. MONTHLY SOLAR INSTALLATIONS (LAST 6 CALENDAR MONTHS)
    -- Computes exact factual capacity_kw and projects_count per month.
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'month', to_char(m.m_date, 'Mon'),
                'capacity_kw', COALESCE(agg.cap_kw, 0.00)::NUMERIC(10, 2),
                'projects_count', COALESCE(agg.proj_cnt, 0)::INT
            )
            ORDER BY m.m_date ASC
        ),
        '[]'::jsonb
    )
    INTO v_monthly_installations
    FROM (
        SELECT (date_trunc('month', CURRENT_DATE) - (s.n || ' month')::INTERVAL)::DATE AS m_date
        FROM generate_series(5, 0, -1) AS s(n)
    ) m
    LEFT JOIN (
        SELECT 
            date_trunc('month', COALESCE(i.net_meter_installed_date, i.installation_completed_date, p.updated_at::date, p.created_at::date))::DATE AS inst_month,
            SUM(p.capacity_kw)::NUMERIC(10, 2) AS cap_kw,
            COUNT(p.id)::INT AS proj_cnt
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        LEFT JOIN installations i ON i.project_id = p.id
        WHERE p.is_test = false
          AND c.is_test = false
          AND (i.net_meter_installed = true OR p.status IN ('COMPLETED', 'NET_METER_INSTALLED', 'INSTALLATION_COMPLETED'))
          AND (
              v_is_global
              OR (v_role = 'branch_manager' AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
              OR (v_role = 'agent' AND p.primary_agent_id = v_agent_id)
              OR (v_role = 'technician' AND (i.technician_profile_id = v_profile_id OR (v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))))
              OR (v_role IN ('field_officer', 'operational_manager', 'backoffice', 'receptionist') AND v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(c.branch, ''))) = LOWER(TRIM(v_branch)))
          )
        GROUP BY 1
    ) agg ON m.m_date = agg.inst_month;

    -- 12. TOP PERFORMING AGENTS LEADERBOARD
    -- Returned ONLY to authorized leadership roles.
    -- Redacted to empty array for agents and unauthorized roles to protect peer privacy.
    -- MATHEMATICALLY SAFE: Projects and Commissions are independently aggregated before joining,
    -- eliminating cross-table Cartesian multiplication.
    IF v_role IN ('super_admin', 'office_admin', 'branch_manager', 'accountant', 'operational_manager') THEN
        WITH eligible_agents AS (
            SELECT a.id AS agent_id, a.agent_code, pr.full_name, a.created_at
            FROM agents a
            JOIN profiles pr ON a.profile_id = pr.id
            WHERE a.is_test = false
              AND a.is_active = true
              AND pr.is_active = true
              AND (
                  v_is_global
                  OR (v_branch IS NOT NULL AND LOWER(TRIM(COALESCE(a.branch, ''))) = LOWER(TRIM(v_branch)))
              )
        ),
        agent_project_counts AS (
            SELECT p.primary_agent_id AS agent_id, COUNT(DISTINCT p.id)::INT AS inst_cnt
            FROM projects p
            WHERE p.is_test = false
              AND (
                  p.status IN ('COMPLETED', 'NET_METER_INSTALLED', 'INSTALLATION_COMPLETED') 
                  OR EXISTS (
                      SELECT 1 FROM installations inst 
                      WHERE inst.project_id = p.id AND inst.net_meter_installed = true
                  )
              )
              AND p.primary_agent_id IN (SELECT agent_id FROM eligible_agents)
            GROUP BY p.primary_agent_id
        ),
        agent_comm_totals AS (
            SELECT ct.agent_id, COALESCE(SUM(ct.net_commission), 0.00)::NUMERIC(14, 2) AS comm_amt
            FROM commission_transactions ct
            WHERE ct.is_test = false
              AND ct.agent_id IN (SELECT agent_id FROM eligible_agents)
            GROUP BY ct.agent_id
        )
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'rank', ta.rk,
                    'agent_name', ta.full_name,
                    'agent_code', ta.agent_code,
                    'verified_installs', ta.inst_cnt,
                    'commission_earned_amount', ta.comm_amt
                )
                ORDER BY ta.rk ASC
            ),
            '[]'::jsonb
        )
        INTO v_top_agents
        FROM (
            SELECT 
                ROW_NUMBER() OVER (
                    ORDER BY 
                        COALESCE(apc.inst_cnt, 0) DESC, 
                        COALESCE(act.comm_amt, 0.00) DESC,
                        ea.created_at ASC
                )::INT AS rk,
                ea.full_name,
                ea.agent_code,
                COALESCE(apc.inst_cnt, 0)::INT AS inst_cnt,
                COALESCE(act.comm_amt, 0.00)::NUMERIC(14, 2) AS comm_amt
            FROM eligible_agents ea
            LEFT JOIN agent_project_counts apc ON ea.agent_id = apc.agent_id
            LEFT JOIN agent_comm_totals act ON ea.agent_id = act.agent_id
            ORDER BY inst_cnt DESC, comm_amt DESC
            LIMIT 3
        ) ta;
    ELSE
        v_top_agents := '[]'::jsonb;
    END IF;

    -- 13. CONSTRUCT CANONICAL RESPONSE ENVELOPE
    RETURN jsonb_build_object(
        'profile', jsonb_build_object(
            'role', v_role::TEXT,
            'branch', v_branch,
            'is_global_scope', v_is_global
        ),
        'kpis', jsonb_build_object(
            'total_leads', v_total_leads,
            'new_leads_waiting', v_new_leads_waiting,
            'converted_customers', v_converted_customers,
            'registered_on_portal', v_registered_on_portal,
            'pending_registrations', v_pending_registrations,
            'solar_installations_completed', v_installations_completed,
            'solar_installations_total', v_installations_total,
            'solar_installations_pending', v_installations_pending,
            'bank_loans_disbursed_amount', v_loans_disbursed_amount,
            'loans_pending_approval_count', v_loans_pending_approval_count,
            'vendor_payments_pending_count', v_vendor_payments_pending_count,
            'vendor_payments_paid_amount', v_vendor_payments_paid_amount,
            'commission_generated_amount', v_commission_generated_amount,
            'commission_paid_to_agents_amount', v_commission_paid_amount,
            'active_agents_count', v_active_agents_count,
            'total_agents_count', v_total_agents_count
        ),
        'monthly_installations', COALESCE(v_monthly_installations, '[]'::jsonb),
        'top_agents', COALESCE(v_top_agents, '[]'::jsonb)
    );
END;
$$;

-- Security Hardening: Revoke default public execution
REVOKE EXECUTE ON FUNCTION get_dashboard_summary() FROM PUBLIC;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_summary() TO authenticated;

