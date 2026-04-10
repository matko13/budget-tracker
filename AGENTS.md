# AGENTS.md

## Cursor Cloud specific instructions

### Overview

BudgetTracker is a single Next.js 16 app (App Router) with Supabase (PostgreSQL + Auth) as the backend. The UI is in Polish. There is no test framework configured (no jest/vitest/cypress). The only automated check available is `npm run lint` (ESLint).

### Services

| Service | How to run | Port |
|---------|-----------|------|
| Next.js dev server | `npm run dev` | 3000 |
| Local Supabase | `sudo supabase start` (from repo root, requires Docker) | 54321 (API), 54322 (DB), 54323 (Studio), 54324 (Mailpit) |

### Commands reference

- **Lint:** `npm run lint`
- **Build:** `npm run build`
- **Dev server:** `npm run dev`

### Local Supabase setup

The app requires Supabase. For local development:

1. Docker must be running (`sudo dockerd` if not started).
2. Run `sudo supabase start` from the repo root (requires `supabase/config.toml` from `supabase init`).
3. Get credentials with `sudo supabase status -o json` — use `API_URL` and `ANON_KEY`.
4. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Apply the schema: `sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < supabase/schema.sql`
6. Apply migrations from `supabase/migrations/` in order.

**Gotcha:** The base `schema.sql` has a `CROSS JOIN ... ON` syntax for the categorization rules INSERT that fails on local Postgres. Change `CROSS JOIN` to `JOIN` if running manually, or skip it — the categories themselves are inserted fine and the app works without pre-seeded rules.

### Docker in Cloud Agent VM

Docker requires special configuration in Cloud Agent VMs (fuse-overlayfs storage driver, iptables-legacy). The VM snapshot should already have Docker installed and configured. If not, follow the standard Cloud Agent Docker installation steps.

### Pre-existing lint issues

`npm run lint` exits with code 1 due to a pre-existing error in `src/contexts/MonthContext.tsx` (setState in effect). This is not a regression — it exists in the base code.

### No automated tests

There is no test framework configured. Manual testing via the browser is the only way to verify functionality. The app runs at http://localhost:3000 after `npm run dev`.
