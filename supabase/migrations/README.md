# Supabase migration workflow setup

The repository's legacy SQL scripts currently live under `database/`. They are **not** automatically copied into `supabase/migrations/` because the live Supabase migration history must first be reconciled to avoid re-running DDL, RLS policies, or RPC changes against production.

Before the GitHub Actions workflow can apply migrations:

1. Inspect the linked Supabase project's actual migration history and current schema.
2. Compare each legacy script under `database/` with that live state.
3. Create timestamped, versioned SQL files under `supabase/migrations/` only for changes that are genuinely pending, preserving dependencies and order.
4. Review the generated diff and test it against a non-production database.
5. Add repository GitHub Environment secrets named `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD`.
6. Configure required reviewers for the `supabase-production` GitHub Environment.

The workflow is manual-only. A run with `apply_migrations=false` is validation-only; applying changes requires explicitly setting `apply_migrations=true`. No migration is run merely because code is pushed to `main`.

Do not put credentials or customer data in this repository.
