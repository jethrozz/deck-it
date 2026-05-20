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
