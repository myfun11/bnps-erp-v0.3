-- BNPS ERP v0.3 — Migration 24: Align private documents storage access for Agent KYC
-- Allows authenticated agents to view their own uploaded documents under both 'agent' and 'agents' folder prefixes.
DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;

CREATE POLICY "documents_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND (
        public.has_erp_permission('document.view')
        OR (
            public.current_user_role() = 'agent'
            AND (storage.foldername(name))[1] IN ('agent', 'agents')
            AND (storage.foldername(name))[2] IN (
                SELECT id::text FROM public.agents WHERE profile_id = public.current_auth_profile_id()
            )
        )
    ));
