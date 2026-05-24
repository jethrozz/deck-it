# Deck It

Deck It is an AI renovation design agent MVP for consumer homeowners.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL`.

For Supabase-backed environments, use the Postgres connection string from Supabase Dashboard -> `Connect`.

- Preferred for Prisma app servers: Supavisor Session pooler (`:5432`)
- If you use a transaction pooler string (`:6543`), append `?pgbouncer=true`
- Do not add `NEXT_PUBLIC_SUPABASE_URL`, publishable keys, or secret keys for this phase; this app still talks to the database through Prisma only

You can still use a local Postgres instance for purely local work if you prefer.

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run database migrations:

```bash
npm run prisma:migrate
```

6. Start the app:

```bash
npm run dev
```

The default `AI_PROVIDER=mock` runs the full flow without external model credentials.

## Supabase Postgres Workflow

This project uses **Prisma as the only application data layer** even when the database is hosted on Supabase.

- `src/lib/db.ts` remains the single runtime database entrypoint.
- `prisma/schema.prisma` remains the schema source of truth.
- The `@supabase/supabase-js` / `@supabase/ssr` setup is intentionally out of scope for this phase.

Useful commands:

```bash
npm run prisma:generate
npm run prisma:push
npm run db:check
npm run db:inventory
```

- `prisma:push` applies the current Prisma schema to a target database.
- `db:check` verifies Prisma can connect to the active `DATABASE_URL`.
- `db:inventory` prints row counts for the main Prisma-managed tables before or after migration.

Full migration steps live in [docs/supabase-postgres-migration.md](/Users/jethrozz/Documents/UGit/deck-it/docs/supabase-postgres-migration.md).

## Payment Configuration (XunhuPay)

Set these environment variables before enabling real payment:

- `NEXT_PUBLIC_APP_URL` (used to build default return URL)
- `XUNHUPAY_APP_ID`
- `XUNHUPAY_APP_SECRET`
- `XUNHUPAY_NOTIFY_URL` (must point to `/api/payments/xunhupay/notify`)
- `XUNHUPAY_RETURN_URL` (optional, defaults to project payment page)
- `XUNHUPAY_PAYMENT_URL` (optional, defaults to `https://api.xunhupay.com/payment/do.html`)
- `XUNHUPAY_PLUGIN` (optional payment channel/plugin passthrough)

Order bundle pricing is currently **not env-configurable**. It is hardcoded in `src/lib/orders/constants.ts`:

- `ORDER_BUNDLE_PRICE = 199`
- `ORDER_BUNDLE_CREDITS = 2`

## Payment Behavior Notes

- Interview completion no longer enters generation directly. It first enters `/projects/{projectId}/payment`.
- Payment success unlocks generation credits; each successful bundle purchase grants `2` credits.
- Starting generation consumes `1` credit per attempt.
- Re-entering interview and then starting generation also consumes `1` credit.
- When credits are exhausted, generate/regenerate routes return `requiresPayment=true` and `nextPath=/projects/{projectId}/payment`.

### Built-in Test Coupon (Whitelist + 0.01 payment)

The app supports an internal test coupon bootstrap:

- `TEST_COUPON_CODE`: built-in coupon code
- `TEST_COUPON_ALLOWED_CONTACTS`: comma-separated email/phone whitelist

When this coupon is valid for the submitted contact identity, pricing is forced to a minimum payable amount (`0.01`) so you can test the real payment callback path without paying full amount.

## AI Provider Configuration

For the new multi-provider routing, set:

```bash
AI_PROVIDER=multi
VISION_PROVIDER=qwen
TEXT_PROVIDER=deepseek
IMAGE_PROVIDER=doubao
```

The app now resolves providers lazily by capability. Configure the capability you actually use, or configure all three when running the full flow. The block above is the common full-flow example, not a requirement that every capability be configured up front for every route.

### Vision Capability

- `VISION_PROVIDER=qwen`
- `VISION_API_KEY`
- `VISION_BASE_URL`
- `VISION_MODEL`

Used for floor plan analysis through an OpenAI-compatible `POST /chat/completions` endpoint. The app sends the floor plan as a Base64 data URL to avoid external URL access issues.

### Text Capability

- `TEXT_PROVIDER=deepseek`
- `TEXT_API_KEY`
- `TEXT_BASE_URL`
- `TEXT_MODEL`

Used for interview turns and design-plan generation through an OpenAI-compatible `POST /chat/completions` endpoint.

### Image Capability

- `IMAGE_PROVIDER=doubao`
- `IMAGE_API_KEY`
- `IMAGE_BASE_URL` (default `https://ark.cn-beijing.volces.com/api/v3`)
- `IMAGE_MODEL`
- `IMAGE_SIZE` (optional, default `2048x2048`)

Used for Seedream rendering generation through `POST /images/generations`.

Image capability also supports legacy fallback variables:

- `DOUBAO_API_KEY` before `ARK_API_KEY` when `IMAGE_API_KEY` is not set
- `SEEDREAM_MODEL` when `IMAGE_MODEL` is not set
- `SEEDREAM_SIZE` when `IMAGE_SIZE` is not set

## Legacy Single-Provider Compatibility

`AI_PROVIDER=doubao` is still supported for the old single-provider path. That mode expects:

- `DOUBAO_API_KEY` or `ARK_API_KEY`
- `DOUBAO_BASE_URL` (default `https://ark.cn-beijing.volces.com/api/v3`)
- `DOUBAO_CHAT_MODEL`
- `DOUBAO_VISION_MODEL`
- `SEEDREAM_MODEL`
- `SEEDREAM_SIZE` (optional, default `2048x2048`)

## Product Boundary

The MVP generates a homeowner-facing design brief. It does not produce CAD drawings, construction drawings, exact quotations, procurement lists, or real 3D walkthroughs.
