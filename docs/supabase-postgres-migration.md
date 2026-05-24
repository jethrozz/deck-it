# Supabase Postgres Migration Runbook

This runbook moves `deck-it` from a self-managed/local Postgres database to Supabase-hosted Postgres while **keeping Prisma as the only application data layer**.

## 1. Create the Supabase project

1. Create a new project in Supabase.
2. Wait for the Postgres database to finish provisioning.
3. In the Supabase dashboard, open `Connect` and copy the Postgres connection string.

Recommended connection choices:

- Use the **Supavisor Session** pooler string on port `5432` for long-lived Prisma app servers.
- If your runtime requires a transaction pooler string on port `6543`, append `?pgbouncer=true` so Prisma disables prepared statements for that connection mode.
- If your environment supports direct IPv6 connections, you can use the direct Postgres string instead of the session pooler.

## 2. Configure local environment variables

Update your local `.env` so `DATABASE_URL` points to the Supabase database:

```env
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[YOUR-REGION].pooler.supabase.com:5432/postgres"
```

Important notes:

- This phase does **not** require `NEXT_PUBLIC_SUPABASE_URL`.
- This phase does **not** require Supabase publishable keys.
- This phase does **not** require Supabase secret keys.
- If a secret key was pasted into chat or committed anywhere, rotate it in Supabase before continuing.

## 3. Verify Prisma connectivity

Run the readiness check before any schema or data changes:

```bash
npm run db:check
```

Expected result:

- The command prints the masked database target.
- The command exits successfully after `SELECT 1`.

If it fails:

- Re-check the copied connection string.
- Confirm the database password is correct.
- If you are using a transaction pooler connection string, make sure `pgbouncer=true` is present.

## 4. Apply the Prisma schema to Supabase

This repository currently treats `prisma/schema.prisma` as the canonical schema definition, so the default setup path is:

```bash
npm run prisma:generate
npm run prisma:push
```

Use `prisma:push` for initial Supabase provisioning in this repo. Continue evolving the schema from `prisma/schema.prisma`.

## 5. Capture migration inventory from the source database

Before exporting data, point `DATABASE_URL` at the current source database and capture a table inventory:

```bash
npm run db:inventory
```

The command prints row counts for:

- `Project`
- `Order`
- `Coupon`
- `CouponRedemption`
- `FloorPlanAnalysis`
- `PreferenceProfile`
- `AgentConversation`
- `DesignPlan`
- `RenderingAsset`
- `BriefExport`

Save this output with the migration record so you can compare source and target counts after import.

## 6. Export and import data

Use standard Postgres tooling for the actual copy.

Suggested approach:

1. Export the source database with `pg_dump`.
2. Restore into Supabase with `pg_restore` or `psql`, depending on the dump format you choose.
3. If you need a table-by-table restore, import in dependency-safe order:
   - `Project`
   - `Coupon`
   - `Order`
   - `CouponRedemption`
   - `FloorPlanAnalysis`
   - `PreferenceProfile`
   - `AgentConversation`
   - `DesignPlan`
   - `RenderingAsset`
   - `BriefExport`

If you use table-specific SQL exports, keep foreign-key dependencies in mind and re-run the inventory after import.

## 7. Validate the migrated Supabase database

Point `DATABASE_URL` at Supabase and re-run:

```bash
npm run db:check
npm run db:inventory
```

Validate:

- Row counts match the source inventory or any deliberate migration notes.
- At least one real project still loads correctly.
- At least one order and coupon record still link correctly.
- JSON-backed records such as floor-plan analysis, preference profile, and design plan are intact.

## 8. Run application verification

With `DATABASE_URL` still pointed at Supabase, verify the app behavior:

```bash
npm run test
npm run test:e2e
```

Prioritize these flows:

- create project
- upload / analysis persistence
- preferences save
- interview conversation persistence
- order creation / payment callback path
- generation state transitions
- brief / rendering record creation

There is also a repository-level integration test scaffold in `tests/unit/project-repository.supabase.test.ts`. Run it only when you intentionally want a real database round trip.

## 9. Rollback plan

Keep the old database and its `DATABASE_URL` available until Supabase validation is complete.

If validation fails:

1. Restore the previous `DATABASE_URL`.
2. Re-run `npm run db:check` against the old database.
3. Restart the app against the known-good source database.

Only retire the old database after Supabase has passed schema, inventory, and application-level validation.
