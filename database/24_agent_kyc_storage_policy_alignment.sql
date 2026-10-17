-- BNPS ERP v0.3 — Migration 24: Align Document Entity Access for Agent KYC & Private Storage
-- 
-- Corrected per security & schema audit:
-- 1. Never treat has_erp_permission('document.view') as blanket access to every document.
--    Preserves management/branch scoping while ensuring Agents can only access their own KYC documents.
-- 2. Enforces document.upload independently for uploads; ownership alone never bypasses it.
-- 3. Requires exact matching public.documents.file_path metadata for Storage-object reads,
--    including admin reads. Missing/unlinked metadata is strictly denied.
-- 4. Preserves exact PostgreSQL input parameter names (p_required_permission, p_path).
-- 5. Preserves existing branch-manager, office-admin, super-admin, lead, customer, project,
--    installation, and loan access behavior.

-- ============================================================================
-- 1. document_entity_access_allowed
-- ============================================================================
CREATE OR REPLACE FUNCTION public.document_entity_access_allowed(
    p_entity_type text,
    p_entity_id uuid,
    p_doc_category text,
    p_required_permission text DEFAULT 'document.view'
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
    v_actor_branch varchar(64);
    v_entity_branch varchar(64);
    v_entity_type text;
BEGIN
    -- 1. Require active authenticated session
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 2. Require valid active profile
    v_actor_profile_id := public.current_auth_profile_id();
    IF v_actor_profile_id IS NULL THEN
        RETURN false;
    END IF;

    v_actor_role := public.current_user_role();
    SELECT branch INTO v_actor_branch FROM public.profiles WHERE id = v_actor_profile_id;

    v_entity_type := lower(btrim(coalesce(p_entity_type, '')));

    -- 3. Enforce upload / verify / reject permission independently (Requirement 2)
    -- Ownership alone MUST NOT bypass the required permission.
    IF p_required_permission = 'document.upload' THEN
        IF NOT public.has_erp_permission('document.upload') THEN
            RETURN false;
        END IF;
    ELSIF p_required_permission = 'document.verify' THEN
        IF NOT public.has_erp_permission('document.verify') THEN
            RETURN false;
        END IF;
    ELSIF p_required_permission = 'document.reject' THEN
        IF NOT public.has_erp_permission('document.reject') THEN
            RETURN false;
        END IF;
    END IF;

    -- 4. Admin universal access (Requirement 1 & 5)
    -- Super Admin and Office Admin have global scope if they hold the required permission
    IF v_actor_role IN ('super_admin', 'office_admin') THEN
        IF public.has_erp_permission(p_required_permission) THEN
            RETURN true;
        END IF;
    END IF;

    -- 5. Branch Manager access (Requirement 5)
    -- Branch Manager has branch-scoped access when holding the required permission
    IF v_actor_role = 'branch_manager' THEN
        IF public.has_erp_permission(p_required_permission) THEN
            IF v_actor_branch IS NULL OR btrim(v_actor_branch) = '' THEN
                RETURN true;
            END IF;

            -- Resolve entity branch for scoping
            IF v_entity_type = 'agent' THEN
                SELECT branch INTO v_entity_branch FROM public.agents WHERE id = p_entity_id;
            ELSIF v_entity_type = 'lead' THEN
                SELECT branch INTO v_entity_branch FROM public.leads WHERE id = p_entity_id;
            ELSIF v_entity_type = 'customer' THEN
                SELECT branch INTO v_entity_branch FROM public.customers WHERE id = p_entity_id;
            ELSIF v_entity_type = 'project' THEN
                SELECT c.branch INTO v_entity_branch
                  FROM public.projects pr
                  JOIN public.customers c ON c.id = pr.customer_id
                 WHERE pr.id = p_entity_id;
            ELSIF v_entity_type = 'installation' THEN
                SELECT c.branch INTO v_entity_branch
                  FROM public.installations inst
                  JOIN public.projects pr ON pr.id = inst.project_id
                  JOIN public.customers c ON c.id = pr.customer_id
                 WHERE inst.id = p_entity_id;
            ELSIF v_entity_type = 'loan' THEN
                SELECT coalesce(l.branch_name, c.branch) INTO v_entity_branch
                  FROM public.loans l
                  JOIN public.customers c ON c.id = l.customer_id
                 WHERE l.id = p_entity_id;
            END IF;

            IF v_entity_branch IS NULL OR lower(btrim(v_entity_branch)) = lower(btrim(v_actor_branch)) THEN
                RETURN true;
            END IF;
            RETURN false;
        END IF;
    END IF;

    -- 6. Operational & Specialized Staff Roles (Requirement 5)
    IF v_actor_role IN ('operational_manager', 'accountant', 'field_officer', 'technician', 'backoffice', 'receptionist') THEN
        IF public.has_erp_permission(p_required_permission) THEN
            IF v_entity_type = 'agent' AND v_actor_role = 'accountant' THEN
                RETURN true;
            ELSIF v_entity_type IN ('lead', 'customer', 'project', 'installation', 'loan') THEN
                IF v_entity_type = 'installation' AND v_actor_role = 'technician' THEN
                    IF EXISTS (SELECT 1 FROM public.installations WHERE id = p_entity_id AND technician_profile_id = v_actor_profile_id) THEN
                        RETURN true;
                    END IF;
                END IF;
                IF v_actor_role IN ('operational_manager', 'backoffice', 'receptionist') THEN
                    RETURN true;
                ELSIF v_actor_role = 'field_officer' AND v_entity_type IN ('lead', 'customer', 'project') THEN
                    RETURN true;
                ELSIF v_actor_role = 'accountant' AND v_entity_type IN ('customer', 'project', 'loan') THEN
                    RETURN true;
                END IF;
            END IF;
        END IF;
    END IF;

    -- 7. Agent Role & Ownership Scoping (Requirement 1 & 5)
    -- CRITICAL (Requirement 1): Never treat has_erp_permission('document.view') as blanket access.
    -- An Agent must NOT read another Agent's KYC document even if they have a permission override.
    IF v_entity_type = 'agent' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.agents a
            WHERE a.id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        );
    END IF;

    -- Lead Documents: Assigned officer or source agent access
    IF v_entity_type = 'lead' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.leads l
            WHERE l.id = p_entity_id
              AND (
                  l.assigned_officer_id = v_actor_profile_id
                  OR (
                      v_actor_role = 'agent'
                      AND l.source_agent_id IN (
                          SELECT a.id FROM public.agents a WHERE a.profile_id = v_actor_profile_id
                      )
                  )
              )
        );
    END IF;

    -- Customer Documents: Converted customer or acquisition sourcing agent access
    IF v_entity_type = 'customer' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.acquisitions ac
            JOIN public.agents a ON a.id = ac.sourcing_agent_id
            WHERE ac.customer_id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        ) OR EXISTS (
            SELECT 1
            FROM public.leads l
            JOIN public.agents a ON a.id = l.source_agent_id
            WHERE l.converted_customer_id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        );
    END IF;

    -- Project Documents: Project primary agent access
    IF v_entity_type = 'project' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.projects pr
            JOIN public.agents a ON a.id = pr.primary_agent_id
            WHERE pr.id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        );
    END IF;

    -- Installation Documents: Project primary agent or assigned technician
    IF v_entity_type = 'installation' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.installations inst
            JOIN public.projects pr ON pr.id = inst.project_id
            JOIN public.agents a ON a.id = pr.primary_agent_id
            WHERE inst.id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        ) OR EXISTS (
            SELECT 1
            FROM public.installations inst
            WHERE inst.id = p_entity_id
              AND inst.technician_profile_id = v_actor_profile_id
        );
    END IF;

    -- Loan Documents: Project primary agent or customer acquisition agent
    IF v_entity_type = 'loan' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.loans ln
            JOIN public.projects pr ON pr.id = ln.project_id
            JOIN public.agents a ON a.id = pr.primary_agent_id
            WHERE ln.id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        ) OR EXISTS (
            SELECT 1
            FROM public.loans ln
            JOIN public.acquisitions ac ON ac.customer_id = ln.customer_id
            JOIN public.agents a ON a.id = ac.sourcing_agent_id
            WHERE ln.id = p_entity_id
              AND a.profile_id = v_actor_profile_id
        );
    END IF;

    RETURN false;
END;
$$;

-- ============================================================================
-- 2. can_access_document_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_access_document_path(p_path text)
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

    IF NULLIF(btrim(p_path), '') IS NULL OR p_path ~ '(^|/)\\.\\.(/|$)' THEN
        RETURN false;
    END IF;

    -- Authoritative metadata check (Requirement 3):
    -- A document row MUST exist matching the exact storage path.
    -- Storage objects without matching metadata in public.documents are strictly denied
    -- for ALL callers, including administrators.
    SELECT d.entity_type, d.entity_id, d.doc_category
      INTO v_entity_type, v_entity_id, v_doc_category
      FROM public.documents d
     WHERE d.file_path = p_path
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Authorize against entity-level access policy
    RETURN public.document_entity_access_allowed(
        v_entity_type, v_entity_id, v_doc_category, 'document.view'
    );
END;
$$;

-- ============================================================================
-- 3. can_upload_document_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_upload_document_path(p_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parts text[];
    v_entity_type text;
    v_entity_id_text text;
    v_entity_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 1. Enforce document.upload independently for uploads (Requirement 2)
    IF NOT public.has_erp_permission('document.upload') THEN
        RETURN false;
    END IF;

    IF NULLIF(btrim(p_path), '') IS NULL THEN
        RETURN false;
    END IF;

    -- 2. Validate storage path hierarchy: <entity_type>/<entity_id>/<filename>
    -- Reject path traversal or malformed directory structure
    IF p_path ~ '(^|/)\\.\\.(/|$)' THEN
        RETURN false;
    END IF;

    v_parts := string_to_array(p_path, '/');
    IF array_length(v_parts, 1) <> 3 THEN
        RETURN false;
    END IF;

    v_entity_type := lower(btrim(v_parts[1]));
    IF v_entity_type = 'agents' THEN
        v_entity_type := 'agent';
    END IF;

    IF v_entity_type NOT IN ('agent', 'lead', 'customer', 'project', 'installation', 'loan') THEN
        RETURN false;
    END IF;

    v_entity_id_text := btrim(v_parts[2]);
    IF v_entity_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN false;
    END IF;

    v_entity_id := v_entity_id_text::uuid;

    -- 3. Delegate to entity-level access allowed with 'document.upload'
    RETURN public.document_entity_access_allowed(
        v_entity_type,
        v_entity_id,
        NULL,
        'document.upload'
    );
END;
$$;

-- ============================================================================
-- 4. Storage Policies Alignment on storage.objects
-- ============================================================================
DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
CREATE POLICY "documents_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND public.can_access_document_path(name)
);

DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;
CREATE POLICY "documents_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents'
    AND public.can_upload_document_path(name)
);

-- ============================================================================
-- 5. Privileges
-- ============================================================================
REVOKE ALL ON FUNCTION public.document_entity_access_allowed(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_entity_access_allowed(text, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.can_access_document_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_document_path(text) TO authenticated;

REVOKE ALL ON FUNCTION public.can_upload_document_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_document_path(text) TO authenticated;
