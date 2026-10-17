-- Disposable-only regression tests for database/24_agent_kyc_storage_policy_alignment.sql.
-- Runs against disposable PostgreSQL in CI and rolls back all test modifications.
BEGIN;

-- 1. Setup disposable fixture profiles and agents
-- Agent 1
INSERT INTO public.profiles (id, auth_user_id, role, branch, full_name, phone, is_active)
VALUES (
    '24000000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-000000000011',
    'agent',
    'Raipur',
    'Test Agent One',
    '9800000001',
    true
);

INSERT INTO public.agents (id, profile_id, agent_code, branch, is_active)
VALUES (
    '24000000-0000-0000-0000-0000000000a1',
    '24000000-0000-0000-0000-000000000001',
    'AGT-TEST-001',
    'Raipur',
    true
);

-- Agent 2
INSERT INTO public.profiles (id, auth_user_id, role, branch, full_name, phone, is_active)
VALUES (
    '24000000-0000-0000-0000-000000000002',
    '24000000-0000-0000-0000-000000000012',
    'agent',
    'Bilaspur',
    'Test Agent Two',
    '9800000002',
    true
);

INSERT INTO public.agents (id, profile_id, agent_code, branch, is_active)
VALUES (
    '24000000-0000-0000-0000-0000000000a2',
    '24000000-0000-0000-0000-000000000002',
    'AGT-TEST-002',
    'Bilaspur',
    true
);

-- Super Admin
INSERT INTO public.profiles (id, auth_user_id, role, branch, full_name, phone, is_active)
VALUES (
    '24000000-0000-0000-0000-000000000003',
    '24000000-0000-0000-0000-000000000013',
    'super_admin',
    'Raipur',
    'Test Super Admin',
    '9800000003',
    true
);

-- 2. Seed Storage objects and authoritative documents metadata for Agent 1
INSERT INTO storage.objects (bucket_id, name)
VALUES 
    ('documents', 'agent/24000000-0000-0000-0000-0000000000a1/pan.pdf'),
    ('documents', 'agent/24000000-0000-0000-0000-0000000000a1/unlinked_orphan.pdf');

-- Only pan.pdf has metadata in public.documents; unlinked_orphan.pdf does not.
INSERT INTO public.documents (entity_type, entity_id, doc_category, status, file_path)
VALUES (
    'agent',
    '24000000-0000-0000-0000-0000000000a1',
    'pan',
    'VERIFIED',
    'agent/24000000-0000-0000-0000-0000000000a1/pan.pdf'
);

-- ----------------------------------------------------------------------------
-- TEST 1: Agent reading own KYC document with matching metadata is ALLOWED
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000011"}', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000011', true);

DO $$
BEGIN
    IF NOT public.can_access_document_path('agent/24000000-0000-0000-0000-0000000000a1/pan.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Agent 1 was denied access to their own KYC document';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 2: Another Agent reading Agent 1 KYC document is strictly DENIED
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000012"}', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000012', true);

DO $$
BEGIN
    IF public.can_access_document_path('agent/24000000-0000-0000-0000-0000000000a1/pan.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Agent 2 was granted access to Agent 1 KYC document';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 3: Missing metadata denied for Agent AND Admin
-- ----------------------------------------------------------------------------
-- Agent check on unlinked object
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000011"}', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000011', true);

DO $$
BEGIN
    IF public.can_access_document_path('agent/24000000-0000-0000-0000-0000000000a1/unlinked_orphan.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Agent was granted access to storage object without metadata';
    END IF;
END;
$$;

-- Admin check on unlinked object
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000013', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000013', true);

DO $$
BEGIN
    IF public.can_access_document_path('agent/24000000-0000-0000-0000-0000000000a1/unlinked_orphan.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Super Admin was granted access to storage object without metadata';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 4: document.view alone does NOT grant cross-Agent access
-- ----------------------------------------------------------------------------
-- Grant Agent 2 an explicit user permission override for 'document.view'
INSERT INTO public.user_permission_overrides (user_id, permission_id, effect)
SELECT 
    '24000000-0000-0000-0000-000000000002',
    p.id,
    'GRANT'
FROM public.permissions p
WHERE p.code = 'document.view'
ON CONFLICT DO NOTHING;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000012"}', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000012', true);

DO $$
BEGIN
    -- Verify that Agent 2 now has document.view permission code
    IF NOT public.has_erp_permission('document.view') THEN
        RAISE EXCEPTION 'TEST_SETUP_ERROR: Agent 2 was expected to have document.view permission';
    END IF;

    -- But cross-Agent access to Agent 1 KYC document MUST STILL BE DENIED
    IF public.can_access_document_path('agent/24000000-0000-0000-0000-0000000000a1/pan.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: document.view override erroneously granted cross-Agent KYC access';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 5: Upload denied without document.upload permission
-- ----------------------------------------------------------------------------
-- Switch to Agent 1 (who does NOT have document.upload by default)
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000011"}', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000011', true);

DO $$
BEGIN
    IF public.has_erp_permission('document.upload') THEN
        RAISE EXCEPTION 'TEST_SETUP_ERROR: Agent 1 was expected NOT to have document.upload';
    END IF;

    -- Upload to own agent folder must be denied because document.upload is missing
    IF public.can_upload_document_path('agent/24000000-0000-0000-0000-0000000000a1/new_aadhaar.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Upload was allowed without document.upload permission';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 6: Valid authorized upload allowed
-- ----------------------------------------------------------------------------
-- Grant Agent 1 document.upload permission override
INSERT INTO public.user_permission_overrides (user_id, permission_id, effect)
SELECT 
    '24000000-0000-0000-0000-000000000001',
    p.id,
    'GRANT'
FROM public.permissions p
WHERE p.code = 'document.upload'
ON CONFLICT DO NOTHING;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"24000000-0000-0000-0000-000000000011"}', true);
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000011', true);

DO $$
BEGIN
    -- With document.upload granted, uploading to own agent record MUST BE ALLOWED
    IF NOT public.can_upload_document_path('agent/24000000-0000-0000-0000-0000000000a1/new_aadhaar.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Authorized upload with document.upload was denied';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 7: Unauthorized path denied
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Agent 1 (with document.upload) attempts to upload into Agent 2 folder -> MUST BE DENIED
    IF public.can_upload_document_path('agent/24000000-0000-0000-0000-0000000000a2/malicious.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Upload into another agent folder was allowed';
    END IF;

    -- Invalid / malicious path traversal -> MUST BE DENIED
    IF public.can_upload_document_path('../malicious.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Path traversal was allowed';
    END IF;

    -- Missing entity ID -> MUST BE DENIED
    IF public.can_upload_document_path('agent/malicious.pdf') THEN
        RAISE EXCEPTION 'TEST_FAIL: Malformed path was allowed';
    END IF;
END;
$$;

ROLLBACK;
