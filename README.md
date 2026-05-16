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

3. Start Postgres and set `DATABASE_URL`.

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

## Doubao And Seedream

Set `AI_PROVIDER=doubao` and configure:

- `DOUBAO_API_KEY`
- `DOUBAO_VISION_URL`
- `DOUBAO_CHAT_URL`
- `SEEDREAM_IMAGE_URL`

The adapter expects JSON responses that match the schemas in `src/lib/domain/schemas.ts`.

## Product Boundary

The MVP generates a homeowner-facing design brief. It does not produce CAD drawings, construction drawings, exact quotations, procurement lists, or real 3D walkthroughs.
