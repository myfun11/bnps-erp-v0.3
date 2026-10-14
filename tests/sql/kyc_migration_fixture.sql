-- Disposable PostgreSQL fixture for validating migration DDL only.
-- This is intentionally NOT a substitute for testing against the live BNPS schema.
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;

CREATE TYPE public.user_role_type AS ENUM (
  'super_admin','office_admin','branch_manager','operational_manager','accountant',
  'field_officer','technician','receptionist','backoffice','agent'
);
CREATE TYPE public.lead_stage_type AS ENUM (
  'NEW','CONTACTED','INTERESTED','DOCUMENT_PENDING','CONVERTED','LOST'
);
CREATE TYPE public.payment_stage_type AS ENUM ('ADVANCE','INSTALLATION','COMPLETION');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  full_name text,
  email citext,
  phone varchar,
  role public.user_role_type,
  branch varchar,
  is_active boolean DEFAULT true,
  is_test boolean DEFAULT false
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
  hierarchy_level integer,
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

CREATE OR REPLACE FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;

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
