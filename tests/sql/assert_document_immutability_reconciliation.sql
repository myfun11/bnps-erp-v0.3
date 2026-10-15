-- Disposable-only regression tests for the narrowly permitted lead->customer document reassignment.
BEGIN;

-- Replace the fixture-only access helper with an allow result so this test isolates
-- the immutability guard's transition contract, not RBAC policy behavior.
CREATE OR REPLACE FUNCTION public.document_entity_access_allowed(text, uuid, text, text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT true $$;

INSERT INTO public.profiles(id, auth_user_id, role, branch, is_active)
VALUES ('22000000-0000-0000-0000-000000000010',
        '22000000-0000-0000-0000-000000000011',
        'field_officer', 'Jaijaipur', true);

INSERT INTO public.customers(id, customer_code, branch, full_name, primary_mobile, lifecycle_status)
VALUES ('22000000-0000-0000-0000-000000000020',
        'STORAGE-GATE-CUSTOMER', 'Jaijaipur', 'Fixture Customer', '9000000001', 'UNREGISTERED');

INSERT INTO public.leads(id, lead_code, branch, full_name, mobile, stage, converted_customer_id)
VALUES ('22000000-0000-0000-0000-000000000030',
        'IMMUTABILITY-TEST-LEAD', 'Jaijaipur', 'Fixture Lead', '9000000002',
        'CONVERTED', '22000000-0000-0000-0000-000000000020');

INSERT INTO storage.objects(bucket_id, name)
VALUES ('documents', 'lead/22000000-0000-0000-0000-000000000030/aadhaar.pdf');

-- Trusted fixture setup inserts the original lead-owned document.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.documents(entity_type, entity_id, doc_category, status, file_path)
VALUES ('lead', '22000000-0000-0000-0000-000000000030', 'aadhaar', 'UPLOADED',
        'lead/22000000-0000-0000-0000-000000000030/aadhaar.pdf');

-- The one allowed transition is to the exact customer named on the converted lead,
-- preserving both the original lead path and document category.
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"22000000-0000-0000-0000-000000000011"}', true);
SELECT set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000011', true);

UPDATE public.documents
   SET entity_type = 'customer',
       entity_id = '22000000-0000-0000-0000-000000000020'
 WHERE entity_type = 'lead'
   AND entity_id = '22000000-0000-0000-0000-000000000030';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE entity_type = 'customer'
      AND entity_id = '22000000-0000-0000-0000-000000000020'
      AND file_path = 'lead/22000000-0000-0000-0000-000000000030/aadhaar.pdf'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: controlled lead-to-customer reassignment was not retained';
  END IF;
END;
$$;

-- Any unrelated reassignment remains forbidden.
DO $$
BEGIN
  BEGIN
    UPDATE public.documents
       SET entity_id = '22000000-0000-0000-0000-000000000099'
     WHERE entity_type = 'customer'
       AND entity_id = '22000000-0000-0000-0000-000000000020';
    RAISE EXCEPTION 'TEST_FAIL: unrelated customer reassignment was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'DOCUMENT_IDENTITY_FIELDS_ARE_IMMUTABLE' THEN
      RAISE;
    END IF;
  END;
END;
$$;


-- Guard the server-side conversion contract against accidental regression.
DO $$
DECLARE
  v_conversion_definition text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'lead.convert') THEN
    RAISE EXCEPTION 'TEST_FAIL: lead.convert permission seed is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['super_admin','office_admin','branch_manager','field_officer','backoffice']::user_role_type[]) AS expected(role)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE rp.role = expected.role AND p.code = 'lead.convert'
    )
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: conversion permission role grants are incomplete';
  END IF;
  SELECT pg_get_functiondef('public.convert_lead_atomic(uuid,character varying,uuid)'::regprocedure)
    INTO v_conversion_definition;
  IF position('has_erp_permission' IN v_conversion_definition) = 0
     OR position('lead.convert' IN v_conversion_definition) = 0 THEN
    RAISE EXCEPTION 'TEST_FAIL: conversion permission gate is missing';
  END IF;
  IF position('ADDRESS_INCOMPLETE' IN v_conversion_definition) = 0
     OR position('panchayat_village' IN v_conversion_definition) = 0 THEN
    RAISE EXCEPTION 'TEST_FAIL: required address completeness gate is missing';
  END IF;
  IF position('BRANCH_MISMATCH' IN v_conversion_definition) = 0
     OR position('DUPLICATE_CUSTOMER_CONFLICT' IN v_conversion_definition) = 0 THEN
    RAISE EXCEPTION 'TEST_FAIL: duplicate customer branch/conflict checks are missing';
  END IF;
END;
$$;

ROLLBACK;
