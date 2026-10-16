-- BNPS ERP v0.3 — Migration 24: Align Document Entity Access for Agent KYC
-- Preserves metadata-backed storage authorization via can_access_document_path(name).
-- Does NOT bypass public.documents or loosen into unmanaged storage folder-prefix matching.

-- 1. Ensure document_entity_access_allowed grants agents access to their own Agent KYC documents
-- while strictly isolating them from other agents documents and unauthorized files.
CREATE OR REPLACE FUNCTION public.document_entity_access_allowed(
    p_entity_type text,
    p_entity_id uuid,
    p_doc_category text,
    p_permission text DEFAULT 'document.view'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_profile_id uuid;
    v_actor_role text;
BEGIN
    -- Require active authenticated session
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Admins or users with explicit ERP permission always have access
    IF public.has_erp_permission(p_permission) THEN
        RETURN true;
    END IF;

    v_actor_profile_id := public.current_auth_profile_id();
    IF v_actor_profile_id IS NULL THEN
        RETURN false;
    END IF;

    v_actor_role := public.current_user_role();

    -- Agent KYC Documents: An agent may view/upload documents belonging to their own agent record
    IF lower(p_entity_type) = 'agent' THEN
        IF v_actor_role = 'agent' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.agents a
                WHERE a.id = p_entity_id
                  AND a.profile_id = v_actor_profile_id
            );
        END IF;
    END IF;

    -- Lead Documents: Assigned agent access
    IF lower(p_entity_type) = 'lead' THEN
        IF v_actor_role = 'agent' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.leads l
                JOIN public.agents a ON a.id = l.source_agent_id
                WHERE l.id = p_entity_id
                  AND a.profile_id = v_actor_profile_id
            );
        END IF;
    END IF;

    -- Customer Documents: Converted customer assigned agent access
    IF lower(p_entity_type) = 'customer' THEN
        IF v_actor_role = 'agent' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.leads l
                JOIN public.agents a ON a.id = l.source_agent_id
                WHERE l.converted_customer_id = p_entity_id
                  AND a.profile_id = v_actor_profile_id
            );
        END IF;
    END IF;

    RETURN false;
END;
$$;

-- 2. Ensure can_access_document_path strictly verifies that authoritative metadata exists in public.documents
CREATE OR REPLACE FUNCTION public.can_access_document_path(p_file_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entity_type varchar(64);
    v_entity_id uuid;
    v_doc_category varchar(64);
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Global admin check
    IF public.has_erp_permission('document.view') THEN
        RETURN true;
    END IF;

    -- Authoritative metadata check: a document row MUST exist matching the exact storage path.
    -- Unlinked storage objects or arbitrary files are strictly denied.
    SELECT d.entity_type, d.entity_id, d.doc_category
      INTO v_entity_type, v_entity_id, v_doc_category
      FROM public.documents d
     WHERE d.file_path = p_file_path
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Authorize against the entity-level access policy
    RETURN public.document_entity_access_allowed(
        v_entity_type, v_entity_id, v_doc_category, 'document.view'
    );
END;
$$;

-- 3. Confirm documents_storage_select policy continues to enforce can_access_document_path(name)
DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;

CREATE POLICY "documents_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND public.can_access_document_path(name)
);
