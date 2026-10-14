-- Disposable PostgreSQL fixture for validating migration DDL only.
-- This is intentionally NOT a substitute for testing against the live BNPS schema.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(auth.jwt()->>'sub', '')::uuid
  )
$$;

CREATE TYPE public.user_role_type AS ENUM (
  'super_admin','office_admin','branch_manager','operational_manager','accountant',
  'field_officer','technician','receptionist','backoffice','agent'
);
CREATE TYPE public.lead_stage_type AS ENUM (
  'NEW','CONTACTED','INTERESTED','DOCUMENT_PENDING','CONVERTED','LOST'
);
CREATE TYPE public.payment_stage_type AS ENUM ('ADVANCE','INSTALLATION','COMPLETION');
CREATE TYPE public.pmsg_stage_type AS ENUM ('INITIATED','REGISTERED','FEASIBILITY','INSTALLED','COMPLETED');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  full_name text,
  email citext,
  phone varchar,
  role public.user_role_type,
  branch varchar,
  is_active boolean DEFAULT true,
  is_test boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  doc_category text NOT NULL,
  status text NOT NULL DEFAULT 'UPLOADED',
  file_path text,
  file_name text,
  mime_type varchar,
  file_size_bytes bigint,
  is_test boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code varchar,
  branch varchar,
  source_agent_id uuid,
  assigned_officer_id uuid,
  full_name text,
  mobile varchar,
  alternate_phone varchar,
  email citext,
  discom_name text,
  consumer_number varchar,
  sanctioned_load_kw numeric,
  proposed_capacity_kw numeric,
  address_line text,
  state text,
  district text,
  tehsil text,
  block text,
  panchayat_village text,
  pincode varchar,
  stage public.lead_stage_type DEFAULT 'NEW',
  notes text,
  is_test boolean DEFAULT false,
  converted_customer_id uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code varchar,
  branch varchar,
  full_name text,
  primary_mobile varchar,
  alternate_mobile varchar,
  email citext,
  discom_name text,
  consumer_number varchar,
  sanctioned_load_kw numeric,
  installation_address text,
  district text,
  tehsil text,
  block text,
  panchayat_village text,
  state text,
  pincode varchar,
  lifecycle_status text,
  is_test boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid,
  agent_code varchar,
  branch varchar,
  sponsor_agent_id uuid,
  hierarchy_level integer DEFAULT 10 CHECK (hierarchy_level BETWEEN 1 AND 10),
  pan_number varchar,
  aadhaar_masked varchar,
  bank_account_no text,
  bank_name text,
  bank_ifsc varchar,
  tds_percentage numeric,
  total_commission_earned numeric,
  total_commission_paid numeric,
  outstanding_advance numeric,
  is_active boolean DEFAULT true,
  is_test boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text);
CREATE TABLE public.user_permission_overrides (user_id uuid, permission_id uuid, effect varchar(10));
CREATE TABLE public.user_roles (user_id uuid, role_id uuid);
CREATE TABLE public.dynamic_role_permissions (role_id uuid, permission_id uuid);
CREATE TABLE public.role_permissions (role public.user_role_type, permission_id uuid);

CREATE OR REPLACE FUNCTION public.document_entity_access_allowed(text, uuid, text, text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT false $$;

CREATE OR REPLACE FUNCTION public.has_erp_permission(text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT false $$;

-- Test double for the legacy 11-argument RPC. This intentionally models its
-- required Auth user ID and row-creation contract, but is NOT the production
-- implementation. It lets the disposable test exercise wrapper delegation and
-- post-delegation tagging without connecting to Supabase Auth.
CREATE OR REPLACE FUNCTION public.create_agent_atomic(
  p_auth_user_id uuid,
  p_full_name text,
  p_email citext,
  p_phone character varying,
  p_branch character varying,
  p_sponsor_agent_id uuid,
  p_pan_number character varying,
  p_bank_account_no text,
  p_bank_name text,
  p_bank_ifsc character varying,
  p_tds_percentage numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $fixture$
DECLARE
  v_profile_id uuid;
  v_agent_id uuid;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Auth user ID is required' USING ERRCODE = 'P0004';
  END IF;
  IF NULLIF(TRIM(p_full_name), '') IS NULL
     OR NULLIF(TRIM(p_phone), '') IS NULL
     OR p_email IS NULL
     OR NULLIF(TRIM(p_branch), '') IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Required Agent fields are missing' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO public.profiles(auth_user_id, full_name, email, phone, role, branch, is_active, is_test)
  VALUES (p_auth_user_id, trim(p_full_name), p_email, p_phone, 'agent', p_branch, true, false)
  RETURNING id INTO v_profile_id;

  INSERT INTO public.agents(profile_id, agent_code, branch, sponsor_agent_id, hierarchy_level,
                            pan_number, bank_account_no, bank_name, bank_ifsc, tds_percentage,
                            is_active, is_test)
  VALUES (v_profile_id, 'FIXTURE-' || substr(gen_random_uuid()::text, 1, 8), p_branch,
          p_sponsor_agent_id, 10, p_pan_number, p_bank_account_no, p_bank_name, p_bank_ifsc,
          coalesce(p_tds_percentage, 5.00), true, false)
  RETURNING id INTO v_agent_id;

  RETURN jsonb_build_object('success', true, 'agent_id', v_agent_id,
                            'profile_id', v_profile_id, 'auth_user_id', p_auth_user_id);
END;
$fixture$;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION public.generate_project_commission_atomic(
  uuid, public.payment_stage_type, uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION public.create_lead_atomic(
  uuid, uuid, text, character varying, character varying, citext, text,
  character varying, numeric, numeric, text, text, text, text, text, text,
  character varying, text, boolean
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;


-- Minimal fixture for validating access controls on sensitive views.
CREATE TABLE public.acquisitions (
  customer_id uuid,
  sourcing_agent_id uuid
);
CREATE TABLE public.pmsg_tracking (
  customer_id uuid,
  portal_application_no text,
  application_submission_date date,
  registered_capacity_kw numeric,
  stage public.pmsg_stage_type,
  feasibility_status text,
  subsidy_amount_eligible numeric
);
CREATE VIEW public.agents_public_profile AS
SELECT a.id, a.agent_code, p.full_name AS agent_name, a.sponsor_agent_id,
       a.hierarchy_level, a.is_active, a.created_at
FROM public.agents a JOIN public.profiles p ON p.id=a.profile_id;
CREATE VIEW public.view_pmsg_registered_customers AS
SELECT c.id AS customer_id, c.customer_code, c.full_name AS customer_name,
       c.primary_mobile, c.consumer_number, c.discom_name, c.district,
       p.portal_application_no, p.application_submission_date, p.registered_capacity_kw,
       p.stage AS pmsg_stage, p.feasibility_status, p.subsidy_amount_eligible,
       a.sourcing_agent_id, ag.agent_code, ag_prof.full_name AS agent_name,
       c.lifecycle_status, c.created_at AS customer_since
FROM public.customers c
JOIN public.pmsg_tracking p ON p.customer_id=c.id
LEFT JOIN public.acquisitions a ON a.customer_id=c.id
LEFT JOIN public.agents ag ON a.sourcing_agent_id=ag.id
LEFT JOIN public.profiles ag_prof ON ag.profile_id=ag_prof.id
WHERE ((p.portal_application_no IS NOT NULL) OR (p.stage <> 'INITIATED'::public.pmsg_stage_type))
  AND c.is_test=false;
GRANT SELECT ON public.agents_public_profile, public.view_pmsg_registered_customers TO PUBLIC;
