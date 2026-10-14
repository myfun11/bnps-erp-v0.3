-- BNPS ERP v0.3 — Safe test-agent mode for end-to-end validation.
-- No existing rows are changed. This migration only adds guarded server-side helpers/triggers.

CREATE OR REPLACE FUNCTION public.set_agent_test_mode(
  p_agent_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF p_agent_id IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Agent and profile IDs are required' USING ERRCODE='22023';
  END IF;

  UPDATE public.agents
     SET is_test = true, updated_at = clock_timestamp()
   WHERE id = p_agent_id AND profile_id = p_profile_id
   RETURNING profile_id INTO v_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AGENT_NOT_FOUND: Agent/profile pair was not found' USING ERRCODE='P0002';
  END IF;

  UPDATE public.profiles
     SET is_test = true, updated_at = clock_timestamp()
   WHERE id = v_profile_id AND role = 'agent' AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: Active agent profile was not found' USING ERRCODE='P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'agent_id', p_agent_id, 'profile_id', p_profile_id, 'is_test', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_agent_test_mode(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_agent_test_mode(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_test_agent_lead_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.source_agent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.agents a WHERE a.id = NEW.source_agent_id AND a.is_test = true
  ) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_test_agent_lead_scope() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS leads_inherit_test_agent_mode ON public.leads;
CREATE TRIGGER leads_inherit_test_agent_mode
BEFORE INSERT OR UPDATE OF source_agent_id, is_test ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_test_agent_lead_scope();

CREATE OR REPLACE FUNCTION public.enforce_document_test_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.entity_type = 'agent' AND EXISTS (
    SELECT 1 FROM public.agents a WHERE a.id = NEW.entity_id AND a.is_test = true
  ) THEN
    NEW.is_test := true;
  ELSIF NEW.entity_type = 'lead' AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = NEW.entity_id AND l.is_test = true
  ) THEN
    NEW.is_test := true;
  ELSIF NEW.entity_type = 'customer' AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = NEW.entity_id AND c.is_test = true
  ) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_document_test_mode() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS documents_inherit_test_mode_before_insert ON public.documents;
CREATE TRIGGER documents_inherit_test_mode_before_insert
BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_document_test_mode();
