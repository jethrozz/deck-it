# MySQL Migration Runbook

This runbook moves `deck-it` onto a MySQL database while **keeping Prisma as the only application data layer**.

## 1. Provision the MySQL database

1. Create a MySQL database instance.
2. Create a database for `deck-it`.
3. Create an application user with read/write schema privileges.
4. Copy the host, port, database name, username, and password.

## 2. Configure local environment variables

Update your local `.env` so `DATABASE_URL` points to MySQL:

```env
DATABASE_URL="mysql://deckit:[YOUR-URL-ENCODED-PASSWORD]@db.example.com:3306/deck_it"
```

Important notes:

- URL-encode special characters in the password before putting it into `DATABASE_URL`.
- This app does **not** require a separate direct connection URL.
- Keep `DATABASE_URL` out of git-tracked files.

## 3. Verify Prisma connectivity

Run the readiness check before any schema or data changes:

```bash
npm run db:check
```

Expected result:

- The command prints the masked database target.
- The command exits successfully after `SELECT 1`.

If it fails:

- Re-check the username, password, host, port, and database name.
- Confirm the password was URL-encoded correctly.
- Confirm the MySQL user has permission to connect from your client IP.

## 4. Apply the Prisma schema to MySQL

This repository treats `prisma/schema.prisma` as the canonical schema definition, so the default setup path is:

```bash
npm run prisma:generate
npm run prisma:push
```

Use `prisma:push` for initial provisioning in this repo. Continue evolving the schema from `prisma/schema.prisma`.

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

Use tooling that matches your source database.

Suggested approach:

1. Export the source database with its native dump tool.
2. Transform types as needed for MySQL compatibility.
3. Import into MySQL with `mysql` or another compatible restore tool.
4. If you need a table-by-table restore, import in dependency-safe order:
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

Keep foreign-key dependencies in mind and re-run the inventory after import.

## 7. Validate the migrated MySQL database

Point `DATABASE_URL` at MySQL and re-run:

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

With `DATABASE_URL` still pointed at MySQL, verify the app behavior:

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

There is also a repository-level integration test scaffold in `tests/unit/project-repository.mysql.test.ts`. Run it only when you intentionally want a real database round trip.

## 9. Rollback plan

Keep the old database and its `DATABASE_URL` available until MySQL validation is complete.

If validation fails:

1. Restore the previous `DATABASE_URL`.
2. Re-run `npm run db:check` against the old database.
3. Restart the app against the known-good source database.

Only retire the old database after MySQL has passed schema, inventory, and application-level validation.
