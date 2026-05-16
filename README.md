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

- `DOUBAO_API_KEY` or `ARK_API_KEY`
- `DOUBAO_BASE_URL` (default `https://ark.cn-beijing.volces.com/api/v3`)
- `DOUBAO_CHAT_MODEL` (text agent model id)
- `DOUBAO_VISION_MODEL` (vision-capable model id for floor plan analysis)
- `SEEDREAM_MODEL` (image generation model id)
- `SEEDREAM_SIZE` (optional, default `2048x2048`)

The adapter uses OpenAI-compatible Ark endpoints:

- `POST /chat/completions` for analysis, interview, and plan generation.
- `POST /images/generations` for Seedream rendering generation.

Floor plan analysis sends image as Base64 data URL to avoid external URL access issues.

## Product Boundary

The MVP generates a homeowner-facing design brief. It does not produce CAD drawings, construction drawings, exact quotations, procurement lists, or real 3D walkthroughs.
