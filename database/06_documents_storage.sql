-- ============================================================================
-- BNPS ERP v0.3
-- DOCUMENT STORAGE SECURITY
-- Private Supabase Storage bucket: documents
-- ============================================================================

-- Ensure the bucket remains private.
UPDATE storage.buckets
SET public = false
WHERE id = 'documents';



-- Create the private bucket if it does not already exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE
SET public = false;



-- ============================================================================
-- STORAGE OBJECT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_delete" ON storage.objects;


-- Users with document.upload may upload files.
CREATE POLICY "documents_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents'
    AND public.has_erp_permission('document.upload')
);


-- Users with document.view may access stored files.
CREATE POLICY "documents_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND public.has_erp_permission('document.view')
);


-- An uploader may remove an object created by that uploader.
CREATE POLICY "documents_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'documents'
    AND owner_id = auth.uid()::text
    AND public.has_erp_permission('document.upload')
);
