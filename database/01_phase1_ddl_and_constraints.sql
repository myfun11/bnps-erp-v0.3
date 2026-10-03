-- ============================================================================
-- BNPS ERP v0.3 — Phase 1: Database DDL, Constraints & Master Schema
-- Organization: Bhumi Nidhi Power Solution
-- Target Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAIN TYPES
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM (
        'super_admin',
        'office_admin',
        'accountant',
        'field_officer',
        'technician',
        'agent'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE lead_stage_type AS ENUM (
        'NEW',
        'CONTACTED',
        'INTERESTED',
        'DOCUMENT_PENDING',
        'READY_FOR_REGISTRATION',
        'CONVERTED',
        'LOST'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE customer_lifecycle_type AS ENUM (
        'UNREGISTERED',
        'REGISTERED',
        'INSTALLED',
        'COMMISSIONED',
        'INACTIVE'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE pmsg_stage_type AS ENUM (
        'INITIATED',
        'APPLICATION_SUBMITTED',
        'DOCUMENT_VERIFIED',
        'FEASIBILITY_APPROVED',
        'VENDOR_SELECTED',
        'SUBSIDY_CLAIMED',
        'SUBSIDY_DISBURSED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE project_status_type AS ENUM (
        'PLANNING',
        'SITE_SURVEY',
        'APPROVED',
        'MATERIAL_DISPATCHED',
        'INSTALLATION_IN_PROGRESS',
        'INSTALLATION_COMPLETED',
        'NET_METERING_PENDING',
        'NET_METER_INSTALLED',
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_stage_type AS ENUM (
        'FIRST_ADVANCE',
        'SECOND_INSTALLATION',
        'FINAL_NET_METER',
        'SINGLE_LUMPSUM'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM (
        'PENDING_APPROVAL',
        'APPROVED',
        'PAID',
        'REVERSED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE loan_status_type AS ENUM (
        'NOT_REQUIRED',
        'APPLIED',
        'DOCUMENTS_SUBMITTED',
        'SANCTIONED',
        'DISBURSED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE doc_status_type AS ENUM (
        'UPLOADED',
        'VERIFIED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payout_status_type AS ENUM (
        'DRAFT',
        'APPROVED',
        'PROCESSED',
        'REVERSED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 3. CORE IDENTITY & AUTH ACCESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- References auth.users(id) in Supabase
    full_name TEXT NOT NULL,
    email CITEXT UNIQUE,
    phone VARCHAR(20) NOT NULL,
    role user_role_type NOT NULL DEFAULT 'agent',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL, -- e.g., 'payment.approve', 'lead.convert', 'commission.generate'
    name VARCHAR(128) NOT NULL,
    module VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role user_role_type NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (user_id, permission_id)
);

-- ============================================================================
-- 4. AGENTS & MULTI-TIER HIERARCHY
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
    agent_code VARCHAR(32) UNIQUE NOT NULL,
    sponsor_agent_id UUID REFERENCES agents(id) ON DELETE RESTRICT, -- Upline Sponsor
    hierarchy_level INT NOT NULL DEFAULT 10 CHECK (hierarchy_level BETWEEN 1 AND 10),
    pan_number VARCHAR(10) CHECK (pan_number IS NULL OR pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    aadhaar_masked VARCHAR(12),
    bank_account_no TEXT,
    bank_name TEXT,
    bank_ifsc VARCHAR(11),
    tds_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (tds_percentage >= 0),
    total_commission_earned NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_commission_paid NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    outstanding_advance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (outstanding_advance >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_agents_sponsor ON agents(sponsor_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_code ON agents(agent_code);

-- ============================================================================
-- 5. LEADS & CUSTOMER MASTER (SINGLE AUTHORITATIVE MASTER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(32) UNIQUE NOT NULL,
    source_agent_id UUID REFERENCES agents(id) ON DELETE RESTRICT,
    assigned_officer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    alternate_phone VARCHAR(15),
    email CITEXT,
    discom_name TEXT NOT NULL DEFAULT 'JVVNL / AVVNL / JdVVNL',
    consumer_number VARCHAR(64),
    sanctioned_load_kw NUMERIC(6, 2) CHECK (sanctioned_load_kw > 0),
    proposed_capacity_kw NUMERIC(6, 2) CHECK (proposed_capacity_kw > 0),
    address_line TEXT,
    district TEXT,
    pincode VARCHAR(10),
    stage lead_stage_type NOT NULL DEFAULT 'NEW',
    lost_reason TEXT,
    notes TEXT,
    converted_customer_id UUID, -- Circular ref resolved via FK alter after customer table
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_mobile ON leads(mobile);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(source_agent_id);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(32) UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    primary_mobile VARCHAR(15) NOT NULL UNIQUE,
    alternate_mobile VARCHAR(15),
    email CITEXT,
    aadhaar_masked VARCHAR(12),
    pan_number VARCHAR(10),
    discom_name TEXT NOT NULL,
    consumer_number VARCHAR(64) NOT NULL UNIQUE,
    installation_address TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Rajasthan',
    pincode VARCHAR(10) NOT NULL,
    lifecycle_status customer_lifecycle_type NOT NULL DEFAULT 'UNREGISTERED',
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Link lead back to customer securely
ALTER TABLE leads ADD CONSTRAINT fk_leads_customer 
    FOREIGN KEY (converted_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS acquisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    lead_id UUID UNIQUE REFERENCES leads(id) ON DELETE SET NULL,
    sourcing_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    conversion_notes TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_acquisitions_customer ON acquisitions(customer_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_agent ON acquisitions(sourcing_agent_id);

-- ============================================================================
-- 6. PM SURYA GHAR PORTAL TRACKING (NOT A DUPLICATE CUSTOMER MASTER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pmsg_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE RESTRICT,
    portal_application_no VARCHAR(64) UNIQUE,
    application_submission_date DATE,
    registered_capacity_kw NUMERIC(6, 2) CHECK (registered_capacity_kw > 0),
    stage pmsg_stage_type NOT NULL DEFAULT 'INITIATED',
    feasibility_status VARCHAR(64) DEFAULT 'PENDING',
    discom_subdivision TEXT,
    subsidy_amount_eligible NUMERIC(10, 2) DEFAULT 0.00,
    subsidy_disbursed_amount NUMERIC(10, 2) DEFAULT 0.00,
    subsidy_disbursed_date DATE,
    portal_remarks TEXT,
    last_sync_at TIMESTAMPTZ,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_pmsg_portal_no ON pmsg_tracking(portal_application_no);
CREATE INDEX IF NOT EXISTS idx_pmsg_stage ON pmsg_tracking(stage);

-- Operational View for PMSG Registered Customers (Filtered View, NOT a duplicate master)
CREATE OR REPLACE VIEW view_pmsg_registered_customers AS
SELECT 
    c.id AS customer_id,
    c.customer_code,
    c.full_name AS customer_name,
    c.primary_mobile,
    c.consumer_number,
    c.discom_name,
    c.district,
    p.portal_application_no,
    p.application_submission_date,
    p.registered_capacity_kw,
    p.stage AS pmsg_stage,
    p.feasibility_status,
    p.subsidy_amount_eligible,
    a.sourcing_agent_id,
    ag.agent_code,
    ag_prof.full_name AS agent_name,
    c.lifecycle_status,
    c.created_at AS customer_since
FROM customers c
INNER JOIN pmsg_tracking p ON p.customer_id = c.id
LEFT JOIN acquisitions a ON a.customer_id = c.id
LEFT JOIN agents ag ON a.sourcing_agent_id = ag.id
LEFT JOIN profiles ag_prof ON ag.profile_id = ag_prof.id
WHERE (p.portal_application_no IS NOT NULL OR p.stage <> 'INITIATED')
  AND c.is_test = false;

-- ============================================================================
-- 7. VENDORS, PROJECTS & TECHNICAL INSTALLATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code VARCHAR(32) UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone VARCHAR(15) NOT NULL,
    email CITEXT,
    gstin VARCHAR(15),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code VARCHAR(32) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    primary_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    capacity_kw NUMERIC(6, 2) NOT NULL CHECK (capacity_kw > 0),
    total_contract_amount NUMERIC(12, 2) NOT NULL CHECK (total_contract_amount > 0),
    discom_subsidy_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    customer_payable_amount NUMERIC(12, 2) NOT NULL CHECK (customer_payable_amount >= 0),
    status project_status_type NOT NULL DEFAULT 'PLANNING',
    commission_distributed BOOLEAN NOT NULL DEFAULT false,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    technician_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    structure_type VARCHAR(64) DEFAULT 'ELEVATED_GI',
    solar_module_make TEXT,
    solar_module_capacity_wp NUMERIC(6, 2),
    solar_module_quantity INT CHECK (solar_module_quantity > 0),
    inverter_make TEXT,
    inverter_capacity_kw NUMERIC(6, 2),
    inverter_serial_no VARCHAR(128),
    dispatch_date DATE,
    installation_start_date DATE,
    installation_completed_date DATE,
    net_meter_installed BOOLEAN NOT NULL DEFAULT false,
    net_meter_installed_date DATE,
    net_meter_serial_no VARCHAR(128),
    discom_inspection_signoff BOOLEAN NOT NULL DEFAULT false,
    discom_inspection_date DATE,
    inspector_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- INVARIANT TRIGGER: Project cannot transition to 'COMPLETED' without net meter verified
CREATE OR REPLACE FUNCTION check_project_completion_net_meter()
RETURNS TRIGGER AS $$
DECLARE
    v_net_meter_installed BOOLEAN;
    v_inspection_signoff BOOLEAN;
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN
        SELECT net_meter_installed, discom_inspection_signoff
        INTO v_net_meter_installed, v_inspection_signoff
        FROM installations
        WHERE project_id = NEW.id;

        IF v_net_meter_installed IS NOT TRUE OR v_inspection_signoff IS NOT TRUE THEN
            RAISE EXCEPTION 'BUSINESS_RULE_VIOLATION: Cannot mark Project as COMPLETED without Net Meter Installation and DISCOM signoff verified.'
            USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_completion ON projects;
CREATE TRIGGER trg_check_project_completion
    BEFORE UPDATE OF status ON projects
    FOR EACH ROW
    EXECUTE FUNCTION check_project_completion_net_meter();

-- ============================================================================
-- 8. LOANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    loan_application_no VARCHAR(64),
    applied_amount NUMERIC(12, 2) NOT NULL CHECK (applied_amount > 0),
    sanctioned_amount NUMERIC(12, 2) CHECK (sanctioned_amount >= 0),
    disbursed_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (disbursed_amount >= 0),
    tenure_months INT CHECK (tenure_months > 0),
    interest_rate_pa NUMERIC(5, 2) CHECK (interest_rate_pa >= 0),
    status loan_status_type NOT NULL DEFAULT 'APPLIED',
    rejection_reason TEXT,
    disbursement_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_loans_project ON loans(project_id);

-- ============================================================================
-- 9. PAYMENTS & IMMUTABILITY ENFORCEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_reference_no VARCHAR(64) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    stage payment_stage_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(32) NOT NULL DEFAULT 'BANK_TRANSFER', -- UPI, NEFT, CHEQUE, ONLINE
    transaction_identifier VARCHAR(128),
    status payment_status_type NOT NULL DEFAULT 'PENDING_APPROVAL',
    approved_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    reversal_parent_payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    reversal_reason TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- IMMUTABILITY TRIGGER: Paid payment cannot be directly mutated or deleted
CREATE OR REPLACE FUNCTION check_payment_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'PAID' THEN
            RAISE EXCEPTION 'PAYMENT_ALREADY_PAID: Cannot delete a finalized payment record. Use business reversal mechanism.'
            USING ERRCODE = 'P0002';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'PAID' AND NEW.status <> 'REVERSED' THEN
            -- Only allow transition to REVERSED through authorized command
            IF (OLD.amount <> NEW.amount OR OLD.project_id <> NEW.project_id OR OLD.customer_id <> NEW.customer_id) THEN
                RAISE EXCEPTION 'PAYMENT_ALREADY_PAID: Finalized payment financial fields are immutable.'
                USING ERRCODE = 'P0002';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_immutability ON payments;
CREATE TRIGGER trg_payment_immutability
    BEFORE UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION check_payment_immutability();

-- ============================================================================
-- 10. MULTI-TIER COMMISSIONS & IDEMPOTENT LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position INT NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 10),
    position_title VARCHAR(64) NOT NULL,
    default_rate_percent NUMERIC(5, 2) NOT NULL CHECK (default_rate_percent >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Preload standard 10-tier rule: Position 10 = 7%, Position 9 = 1%, Position 8 = 1%, Positions 7-1 = 0.5%
INSERT INTO commission_rates (position, position_title, default_rate_percent)
VALUES 
    (10, 'Direct Sourcing Agent (Level 10)', 7.00),
    (9,  'Immediate Sponsor (Level 9)', 1.00),
    (8,  'Second Upline Sponsor (Level 8)', 1.00),
    (7,  'Third Upline Sponsor (Level 7)', 0.50),
    (6,  'Fourth Upline Sponsor (Level 6)', 0.50),
    (5,  'Fifth Upline Sponsor (Level 5)', 0.50),
    (4,  'Sixth Upline Sponsor (Level 4)', 0.50),
    (3,  'Seventh Upline Sponsor (Level 3)', 0.50),
    (2,  'Eighth Upline Sponsor (Level 2)', 0.50),
    (1,  'Ninth Upline Super (Level 1)', 0.50)
ON CONFLICT (position) DO NOTHING;

CREATE TABLE IF NOT EXISTS commission_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    payment_stage payment_stage_type NOT NULL,
    position INT NOT NULL CHECK (position BETWEEN 1 AND 10),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    base_amount NUMERIC(12, 2) NOT NULL CHECK (base_amount > 0),
    rate_percent NUMERIC(5, 2) NOT NULL CHECK (rate_percent >= 0),
    gross_commission NUMERIC(12, 2) NOT NULL CHECK (gross_commission >= 0),
    tds_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    tds_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_commission NUMERIC(12, 2) NOT NULL CHECK (net_commission >= 0),
    hierarchy_snapshot JSONB NOT NULL, -- Frozen tree snapshot
    is_paid_out BOOLEAN NOT NULL DEFAULT false,
    payout_id UUID,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_commission_idempotency UNIQUE (project_id, payment_stage, position, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_agent ON commission_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_project ON commission_transactions(project_id);

-- ============================================================================
-- 11. AGENT ADVANCES, RECOVERIES & FINAL PAYOUTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    advance_amount NUMERIC(12, 2) NOT NULL CHECK (advance_amount > 0),
    recovered_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (recovered_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount >= 0),
    disbursed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    authorized_by UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RECOVERED_FULL', 'WRITTEN_OFF')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS agent_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_batch_no VARCHAR(64) UNIQUE NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    gross_commission_total NUMERIC(12, 2) NOT NULL CHECK (gross_commission_total >= 0),
    tds_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tds_total >= 0),
    advance_recovery_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_recovery_total >= 0),
    net_payable_amount NUMERIC(12, 2) NOT NULL CHECK (net_payable_amount >= 0),
    status payout_status_type NOT NULL DEFAULT 'DRAFT',
    bank_reference_no VARCHAR(128),
    processed_by UUID REFERENCES profiles(id),
    processed_at TIMESTAMPTZ,
    payout_snapshot JSONB NOT NULL,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS advance_recoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES agent_payouts(id) ON DELETE RESTRICT,
    advance_id UUID NOT NULL REFERENCES agent_advances(id) ON DELETE RESTRICT,
    recovery_amount NUMERIC(12, 2) NOT NULL CHECK (recovery_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 12. DOCUMENTS REPOSITORY (POLYMORPHIC & SECURE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(64) NOT NULL, -- 'lead', 'customer', 'project', 'agent', 'installation', 'loan'
    entity_id UUID NOT NULL,
    doc_category VARCHAR(64) NOT NULL, -- 'aadhaar', 'pan', 'electricity_bill', 'net_meter_cert', 'site_photo', 'bank_proof'
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Private Supabase Storage path
    mime_type VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT,
    status doc_status_type NOT NULL DEFAULT 'UPLOADED',
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

-- ============================================================================
-- 13. AUDIT TRAIL & SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id),
    action VARCHAR(64) NOT NULL, -- 'LEAD_CONVERTED', 'PAYMENT_APPROVED', 'PAYMENT_PAID', 'COMMISSION_GENERATED', 'PAYOUT_PROCESSED'
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

CREATE TABLE IF NOT EXISTS company_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO company_settings (key, value, description)
VALUES 
    ('app_info', '{"company_name": "Bhumi Nidhi Power Solution", "brand": "BNPS ERP", "version": "v0.3"}', 'Primary company branding'),
    ('commission_config', '{"base_calculation": "contract_value", "max_positions": 10, "default_tds_percent": 5.0}', 'Commission calculation engine params'),
    ('pmsg_config', '{"portal_url": "https://pmsuryaghar.gov.in", "auto_track": true}', 'PM Surya Ghar national portal integration params')
ON CONFLICT (key) DO NOTHING;
