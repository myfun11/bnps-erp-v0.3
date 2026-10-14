-- BNPS ERP v0.3 — harden customer/agent views against anonymous access and RLS bypass.
-- This migration is additive and changes only view options and view grants.
-- SECURITY INVOKER makes underlying-table privileges and RLS apply to the querying role.

ALTER VIEW public.agents_public_profile SET (security_invoker = true);
ALTER VIEW public.view_pmsg_registered_customers SET (security_invoker = true);

REVOKE ALL PRIVILEGES ON TABLE public.agents_public_profile FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.view_pmsg_registered_customers FROM PUBLIC, anon, authenticated;

-- Signed-in users may query the views, but SECURITY INVOKER makes underlying RLS authoritative.
GRANT SELECT ON TABLE public.agents_public_profile TO authenticated, service_role;
GRANT SELECT ON TABLE public.view_pmsg_registered_customers TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
