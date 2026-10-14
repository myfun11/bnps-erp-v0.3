-- BNPS ERP: read-only Supabase security metadata audit.
-- This file intentionally performs SELECTs only. Do not add GRANT/REVOKE/DDL here.
BEGIN TRANSACTION READ ONLY;

WITH public_tables AS (
    SELECT
        c.oid,
        n.nspname AS schema_name,
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS force_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
),
policy_counts AS (
    SELECT tablename, COUNT(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
),
table_findings AS (
    SELECT
        CASE WHEN NOT t.rls_enabled THEN 'HIGH' ELSE 'INFO' END AS severity,
        'RLS_DISABLED' AS check_name,
        format('%I.%I', t.schema_name, t.table_name) AS object_name,
        CASE
            WHEN NOT t.rls_enabled THEN 'Public table has RLS disabled'
            ELSE 'RLS enabled'
        END AS finding
    FROM public_tables t
    WHERE NOT t.rls_enabled

    UNION ALL

    SELECT
        'REVIEW',
        'NO_RLS_POLICIES',
        format('%I.%I', t.schema_name, t.table_name),
        'RLS enabled but no policies are defined; verify intended access (default is deny)'
    FROM public_tables t
    LEFT JOIN policy_counts pc ON pc.tablename = t.table_name
    WHERE t.rls_enabled
      AND COALESCE(pc.policy_count, 0) = 0

    UNION ALL

    SELECT
        'HIGH',
        'ANON_TRUNCATE_GRANT',
        format('%I.%I', t.schema_name, t.table_name),
        'anon has TRUNCATE privilege; RLS does not protect TRUNCATE'
    FROM public_tables t
    WHERE EXISTS (
        SELECT 1
        FROM pg_roles r
        WHERE r.rolname = 'anon'
          AND has_table_privilege(r.oid, t.oid, 'TRUNCATE')
    )

    UNION ALL

    SELECT
        'HIGH',
        'AUTHENTICATED_TRUNCATE_GRANT',
        format('%I.%I', t.schema_name, t.table_name),
        'authenticated has TRUNCATE privilege; RLS does not protect TRUNCATE'
    FROM public_tables t
    WHERE EXISTS (
        SELECT 1
        FROM pg_roles r
        WHERE r.rolname = 'authenticated'
          AND has_table_privilege(r.oid, t.oid, 'TRUNCATE')
    )
),
function_findings AS (
    SELECT
        'REVIEW' AS severity,
        'SECURITY_DEFINER_EXECUTE_EXPOSURE' AS check_name,
        format('%I.%I(%s)', n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid)) AS object_name,
        'SECURITY DEFINER function is executable by anon or PUBLIC; inspect authorization in its body'
            AS finding
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND EXISTS (
          SELECT 1
          FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
          WHERE a.privilege_type = 'EXECUTE'
            AND (
                a.grantee = 0
                OR a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')
            )
      )

    UNION ALL

    SELECT
        'HIGH',
        'SECURITY_DEFINER_SEARCH_PATH',
        format('%I.%I(%s)', n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid)),
        'SECURITY DEFINER function has no function-level search_path setting; inspect for object-shadowing risk'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
          WHERE cfg LIKE 'search_path=%'
      )
)
SELECT severity, check_name, object_name, finding
FROM (
    SELECT * FROM table_findings
    UNION ALL
    SELECT * FROM function_findings
) findings
ORDER BY
    CASE severity WHEN 'HIGH' THEN 1 WHEN 'REVIEW' THEN 2 ELSE 3 END,
    check_name,
    object_name;

COMMIT;
