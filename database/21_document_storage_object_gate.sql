-- BNPS ERP v0.3 — Migration 17: Require real private Storage objects for document metadata and lead conversion.
-- Additive only: does not delete records, drop policies, or modify live Supabase by itself.
-- Apply only after source review and a separately approved deployment decision.

CREATE OR REPLACE FUNCTION public.enforce_document_storage_object_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
  -- The application uploads to the private Storage bucket before creating metadata.
  -- On ordinary metadata updates, only re-check if the stored path is changed.
  IF TG_OP = 'INSERT' OR NEW.file_path IS DISTINCT FROM OLD.file_path THEN
    IF NULLIF(btrim(NEW.file_path), '') IS NULL OR NOT EXISTS (
      SELECT 1
      FROM storage.objects so
      WHERE so.bucket_id = 'documents'
        AND so.name = NEW.file_path
    ) THEN
      RAISE EXCEPTION 'STORAGE_OBJECT_REQUIRED: Upload the file to the private documents bucket before creating document metadata'
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_document_storage_object_exists() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_storage_object_exists_guard
BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_document_storage_object_exists();


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
    /*
     * convert_lead_atomic currently moves document metadata to the new customer
     * before changing the lead stage. Accept either the original lead ownership
     * or that same lead's documents moved to NEW.converted_customer_id, but only
     * when the immutable file path still proves the original lead prefix.
     */
    WITH scoped_documents AS (
      SELECT
        d.id,
        d.doc_category,
        d.created_at,
        d.file_path,
        CASE
          WHEN d.doc_category IN ('aadhaar', 'aadhaar_front') THEN 'aadhaar'
          ELSE d.doc_category
        END AS required_group
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
      SELECT DISTINCT ON (sd.required_group)
        sd.required_group,
        sd.file_path
      FROM scoped_documents sd
      WHERE sd.required_group IN ('aadhaar', 'bank_proof', 'electricity_bill', 'noc_b1', 'site_photo')
      ORDER BY sd.required_group, sd.created_at DESC, sd.id DESC
    ),
    required_groups(required_group) AS (
      VALUES ('aadhaar'), ('bank_proof'), ('electricity_bill'), ('noc_b1'), ('site_photo')
    )
    SELECT string_agg(rg.required_group, ', ' ORDER BY rg.required_group)
      INTO v_missing
    FROM required_groups rg
    LEFT JOIN latest_required lr ON lr.required_group = rg.required_group
    WHERE lr.file_path IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM storage.objects so
         WHERE so.bucket_id = 'documents'
           AND so.name = lr.file_path
       );

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'STORAGE_OBJECT_REQUIRED: Required lead documents are missing actual Storage objects: %', v_missing
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_lead_conversion_storage_objects() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER leads_conversion_storage_object_guard
BEFORE UPDATE OF stage ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_lead_conversion_storage_objects();
