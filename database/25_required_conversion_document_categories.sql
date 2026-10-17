-- BNPS ERP v0.3 — Migration 25
-- Require every mandatory conversion document category to have metadata AND a real
-- object in the private documents bucket. Aadhaar Front and Back are separate requirements.
-- Additive/idempotent function replacement only: no data deletion and no policy drops.
-- Apply to live Supabase only after disposable PostgreSQL and runtime security tests pass.

CREATE OR REPLACE FUNCTION public.enforce_lead_conversion_storage_objects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_missing text;
  v_lead_prefix text := 'lead/' || OLD.id::text || '/';
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage = 'CONVERTED' THEN
    WITH scoped_documents AS (
      SELECT d.id, lower(btrim(d.doc_category)) AS doc_category, d.created_at, d.file_path
      FROM public.documents d
      WHERE (
        (d.entity_type = 'lead' AND d.entity_id = OLD.id)
        OR (
          NEW.converted_customer_id IS NOT NULL
          AND d.entity_type = 'customer'
          AND d.entity_id = NEW.converted_customer_id
          AND left(d.file_path, length(v_lead_prefix)) = v_lead_prefix
        )
      )
    ),
    latest_required AS (
      SELECT DISTINCT ON (sd.doc_category)
        sd.doc_category, sd.file_path
      FROM scoped_documents sd
      WHERE sd.doc_category IN (
        'aadhaar_front', 'aadhaar_back', 'bank_proof',
        'electricity_bill', 'noc_b1', 'site_photo'
      )
      ORDER BY sd.doc_category, sd.created_at DESC, sd.id DESC
    ),
    required_categories(category) AS (
      VALUES
        ('aadhaar_front'),
        ('aadhaar_back'),
        ('bank_proof'),
        ('electricity_bill'),
        ('noc_b1'),
        ('site_photo')
    )
    SELECT string_agg(rc.category, ', ' ORDER BY rc.category)
      INTO v_missing
    FROM required_categories rc
    LEFT JOIN latest_required lr ON lr.doc_category = rc.category
    WHERE lr.file_path IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM storage.objects so
         WHERE so.bucket_id = 'documents'
           AND so.name = lr.file_path
       );

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION
        'STORAGE_OBJECT_REQUIRED: Required document categories lack metadata or actual private Storage objects: %',
        v_missing
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_lead_conversion_storage_objects()
  FROM PUBLIC, anon, authenticated;

-- Verify that the existing guard trigger remains installed; do not silently create
-- a second trigger if the schema has a differently named equivalent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.leads'::regclass
      AND t.tgname = 'leads_conversion_storage_object_guard'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'EXPECTED_TRIGGER_MISSING: leads_conversion_storage_object_guard; reconcile schema before applying migration 25';
  END IF;
END;
$$;
