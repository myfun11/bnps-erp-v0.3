-- BNPS ERP v0.3 — prevent direct client calls to the legacy 11-argument Agent creator.
-- The 12-argument wrapper remains callable by authenticated users and invokes this function
-- internally as its SECURITY DEFINER owner. Server-side service_role retains explicit access.

REVOKE ALL ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_agent_atomic(
  uuid, text, citext, character varying, character varying, uuid,
  character varying, text, text, character varying, numeric
) TO service_role;

NOTIFY pgrst, 'reload schema';
