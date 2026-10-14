# Supabase migration workflow setup

The repository's legacy SQL scripts currently live under `database/`. They are **not** automatically copied into `supabase/migrations/` because the live Supabase migration history must first be reconciled to avoid re-running DDL, RLS policies, or RPC changes against production.

The live project currently contains business tables and records, while its Supabase migration history is empty. This means the current schema cannot safely be treated as a fresh database.

Before the GitHub Actions workflow can apply migrations:

1. Inspect the linked Supabase project's actual schema, functions, policies, storage configuration, and migration history.
2. Compare each legacy script under `database/` with that live state.
3. Create timestamped, versioned SQL files under `supabase/migrations/` only for changes that are genuinely pending, preserving dependencies and order.
4. Test each migration against a non-production database and review the diff.
5. Add repository GitHub Environment secrets named `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD`.
6. Configure required reviewers for the `supabase-production` GitHub Environment.

The workflow is manual-only. A run with `apply_migrations=false` is validation-only; applying changes requires explicitly setting `apply_migrations=true`. No migration is run merely because frontend code is pushed to `main`.

**Do not copy the existing `database/01_*.sql` through `database/14_*.sql` files into migrations unchanged.** Some contain initial-schema DDL or test-account provisioning and could conflict with the populated live database.

Do not put credentials or customer data in this repository.
