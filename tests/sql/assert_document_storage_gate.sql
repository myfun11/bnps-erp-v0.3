-- Disposable-only regression tests for database/21_document_storage_object_gate.sql.
-- The enclosing CI workflow runs this against a throwaway PostgreSQL service and rolls back all rows.

BEGIN;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.leads (id, lead_code, stage)
VALUES ('21000000-0000-0000-0000-000000000001', 'STORAGE-GATE-TEST', 'NEW');

-- A metadata-only insert must fail when no matching private Storage object exists.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.documents (entity_type, entity_id, doc_category, file_path)
    VALUES (
      'lead',
      '21000000-0000-0000-0000-000000000001',
      'site_photo',
      'lead/21000000-0000-0000-0000-000000000001/no-object.jpg'
    );
    RAISE EXCEPTION 'TEST_FAIL: metadata-only document insert was accepted';
  EXCEPTION WHEN SQLSTATE 'P0004' THEN
    IF SQLERRM NOT LIKE 'STORAGE_OBJECT_REQUIRED:%' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- Seed five required documents with matching Storage objects.
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('documents', 'lead/21000000-0000-0000-0000-000000000001/aadhaar.pdf'),
  ('documents', 'lead/21000000-0000-0000-0000-000000000001/bank.pdf'),
  ('documents', 'lead/21000000-0000-0000-0000-000000000001/bill.pdf'),
  ('documents', 'lead/21000000-0000-0000-0000-000000000001/noc.pdf'),
  ('documents', 'lead/21000000-0000-0000-0000-000000000001/site.jpg');

INSERT INTO public.documents (entity_type, entity_id, doc_category, status, file_path) VALUES
  ('lead', '21000000-0000-0000-0000-000000000001', 'aadhaar', 'VERIFIED', 'lead/21000000-0000-0000-0000-000000000001/aadhaar.pdf'),
  ('lead', '21000000-0000-0000-0000-000000000001', 'bank_proof', 'VERIFIED', 'lead/21000000-0000-0000-0000-000000000001/bank.pdf'),
  ('lead', '21000000-0000-0000-0000-000000000001', 'electricity_bill', 'VERIFIED', 'lead/21000000-0000-0000-0000-000000000001/bill.pdf'),
  ('lead', '21000000-0000-0000-0000-000000000001', 'noc_b1', 'UPLOADED', 'lead/21000000-0000-0000-0000-000000000001/noc.pdf'),
  ('lead', '21000000-0000-0000-0000-000000000001', 'site_photo', 'UPLOADED', 'lead/21000000-0000-0000-0000-000000000001/site.jpg');

-- Simulate an object deleted after its metadata row was created. Conversion must fail closed.
DELETE FROM storage.objects
WHERE bucket_id = 'documents'
  AND name = 'lead/21000000-0000-0000-0000-000000000001/site.jpg';

DO $$
BEGIN
  BEGIN
    UPDATE public.leads
       SET stage = 'CONVERTED',
           converted_customer_id = '21000000-0000-0000-0000-000000000099'
     WHERE id = '21000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'TEST_FAIL: conversion proceeded while a required Storage object was missing';
  EXCEPTION WHEN SQLSTATE 'P0004' THEN
    IF SQLERRM NOT LIKE 'STORAGE_OBJECT_REQUIRED:%' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- Restoring the missing object permits the storage-specific gate to pass.
INSERT INTO storage.objects (bucket_id, name)
VALUES ('documents', 'lead/21000000-0000-0000-0000-000000000001/site.jpg');

UPDATE public.leads
   SET stage = 'CONVERTED',
       converted_customer_id = '21000000-0000-0000-0000-000000000099'
 WHERE id = '21000000-0000-0000-0000-000000000001';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = '21000000-0000-0000-0000-000000000001'
      AND stage = 'CONVERTED'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: conversion with all five Storage objects was not accepted';
  END IF;
END;
$$;

ROLLBACK;
