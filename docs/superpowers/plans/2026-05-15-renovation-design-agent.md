# Renovation Design Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable MVP web app where a homeowner uploads a floor plan, confirms lightweight analysis, answers a staged design-agent interview, generates a 2-3 space renovation brief with renderings, and exports a PDF.

**Architecture:** Use a Next.js App Router monolith with focused server modules for persistence, storage, AI provider adapters, staged agent workflow, rendering jobs, and PDF export. The first implementation runs end-to-end with deterministic mock AI providers by default, while real Doubao and Seedream adapters are enabled by environment variables.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Prisma, Postgres, Zod, Vitest, Playwright, Redis/BullMQ, Volcengine TOS or S3-compatible storage, Doubao multimodal/text models, Doubao Seedream.

---

## File Structure

Create the app as a focused Next.js codebase:

- `package.json`: scripts and dependencies.
- `next.config.ts`: Next.js config.
- `tsconfig.json`: strict TypeScript config.
- `tailwind.config.ts`: Tailwind content and theme config.
- `postcss.config.js`: PostCSS config for Tailwind.
- `vitest.config.ts`: unit test config.
- `playwright.config.ts`: browser test config.
- `prisma/schema.prisma`: database schema for projects, floor plan analysis, preferences, conversations, design plans, renderings, and PDF exports.
- `src/app/page.tsx`: project creation and upload entry screen.
- `src/app/projects/[projectId]/page.tsx`: multi-step project workspace.
- `src/app/api/projects/route.ts`: project creation.
- `src/app/api/projects/[projectId]/floor-plan/route.ts`: floor plan upload and analysis.
- `src/app/api/projects/[projectId]/preferences/route.ts`: style, budget, and preference save.
- `src/app/api/projects/[projectId]/agent/respond/route.ts`: answer agent question and request next action.
- `src/app/api/projects/[projectId]/design-plan/route.ts`: design plan generation.
- `src/app/api/projects/[projectId]/renderings/route.ts`: key-space rendering generation and retry.
- `src/app/api/projects/[projectId]/brief/route.ts`: PDF generation and download metadata.
- `src/components/project-workspace.tsx`: client-side wizard and status UI.
- `src/components/brief-preview.tsx`: brief preview before PDF export.
- `src/lib/domain/schemas.ts`: Zod schemas and TypeScript types.
- `src/lib/db.ts`: Prisma client singleton.
- `src/lib/repositories/project-repository.ts`: database reads and writes.
- `src/lib/storage/storage-provider.ts`: storage interface.
- `src/lib/storage/local-storage-provider.ts`: local development storage.
- `src/lib/ai/ai-provider.ts`: provider interface.
- `src/lib/ai/mock-ai-provider.ts`: deterministic provider for tests and local development.
- `src/lib/ai/doubao-provider.ts`: Doubao and Seedream HTTP adapter.
- `src/lib/agent/workflow.ts`: staged designer-agent workflow.
- `src/lib/pdf/render-brief.ts`: HTML-to-PDF generation.
- `src/lib/jobs/queue.ts`: BullMQ queue wiring.
- `tests/unit/domain-schemas.test.ts`: schema tests.
- `tests/unit/agent-workflow.test.ts`: staged agent tests.
- `tests/unit/project-repository.test.ts`: repository tests.
- `tests/e2e/mvp-flow.spec.ts`: browser-level MVP flow.

## Task 1: Scaffold The Next.js App

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create package configuration**

Create `package.json`:

```json
{
  "name": "deck-it",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bullmq": "^5.21.2",
    "lucide-react": "^0.468.0",
    "next": "^15.0.3",
    "playwright": "^1.49.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "prisma": "^5.22.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript and framework config**

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
```

Create `postcss.config.js`:

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
```

- [ ] **Step 3: Create the initial shell UI**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "装修设计 Agent",
  description: "上传户型图，生成装修设计 brief"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  --background: #f7f5ef;
  --foreground: #20201d;
  --muted: #6d6a61;
  --panel: #ffffff;
  --line: #dad5c9;
  --accent: #2d6a62;
  --accent-strong: #1d4d47;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
}

button,
input,
textarea,
select {
  font: inherit;
}
```

Create `src/app/page.tsx`:

```tsx
import { Upload } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <p className="text-sm text-[var(--muted)]">AI 装修设计师 Agent</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight">
            上传户型图，整理出能发给设计师的装修 brief
          </h1>
        </div>

        <form
          action="/api/projects"
          method="post"
          className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6"
        >
          <label className="grid gap-2">
            <span className="text-sm font-medium">项目名称</span>
            <input
              name="name"
              required
              defaultValue="我的装修方案"
              className="rounded-md border border-[var(--line)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-white"
          >
            <Upload size={18} />
            创建项目
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 5: Verify build tooling starts**

Run:

```bash
npm run build
```

Expected: Next.js compiles the initial app shell successfully.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json package-lock.json next.config.ts tsconfig.json tailwind.config.ts postcss.config.js vitest.config.ts playwright.config.ts src/app
git commit -m "feat: scaffold renovation design app"
```

## Task 2: Add Domain Schemas And Tests

**Files:**
- Create: `src/lib/domain/schemas.ts`
- Create: `tests/unit/domain-schemas.test.ts`

- [ ] **Step 1: Write schema tests**

Create `tests/unit/domain-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  budgetTierSchema,
  floorPlanAnalysisSchema,
  preferenceProfileSchema,
  styleSchema
} from "@/lib/domain/schemas";

describe("domain schemas", () => {
  it("accepts supported styles and budget tiers", () => {
    expect(styleSchema.parse("warm_wood")).toBe("warm_wood");
    expect(budgetTierSchema.parse("quality")).toBe("quality");
  });

  it("rejects unsupported style values", () => {
    expect(() => styleSchema.parse("industrial")).toThrow();
  });

  it("validates floor plan analysis uncertainty", () => {
    const analysis = floorPlanAnalysisSchema.parse({
      rooms: [{ name: "客餐厅", type: "living_dining", confidence: 0.82 }],
      relationships: ["客餐厅连接阳台"],
      issues: [{ type: "lighting", description: "采光集中在阳台一侧", confidence: 0.72 }],
      uncertainItems: ["厨房面积不可见"],
      userCorrections: []
    });

    expect(analysis.rooms[0]?.type).toBe("living_dining");
    expect(analysis.uncertainItems).toContain("厨房面积不可见");
  });

  it("stores style, budget, and user preference text", () => {
    const profile = preferenceProfileSchema.parse({
      style: "warm_wood",
      budgetTier: "quality",
      naturalLanguagePreference: "显大，好打理，适合一家三口",
      household: "一家三口",
      adoptedSuggestions: ["保留客餐厅开放感"],
      rejectedSuggestions: []
    });

    expect(profile.budgetTier).toBe("quality");
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm run test -- tests/unit/domain-schemas.test.ts
```

Expected: FAIL because `src/lib/domain/schemas.ts` does not exist.

- [ ] **Step 3: Create schemas**

Create `src/lib/domain/schemas.ts`:

```ts
import { z } from "zod";

export const styleSchema = z.enum([
  "warm_wood",
  "vintage",
  "modern_minimal",
  "cream",
  "wabi_sabi"
]);

export const budgetTierSchema = z.enum(["economy", "quality", "premium"]);

export const roomTypeSchema = z.enum([
  "living_dining",
  "master_bedroom",
  "kitchen",
  "child_room",
  "study",
  "bathroom",
  "balcony",
  "other"
]);

export const floorPlanAnalysisSchema = z.object({
  rooms: z.array(
    z.object({
      name: z.string().min(1),
      type: roomTypeSchema,
      confidence: z.number().min(0).max(1)
    })
  ),
  relationships: z.array(z.string().min(1)),
  issues: z.array(
    z.object({
      type: z.enum(["lighting", "circulation", "storage", "layout", "unclear"]),
      description: z.string().min(1),
      confidence: z.number().min(0).max(1)
    })
  ),
  uncertainItems: z.array(z.string().min(1)),
  userCorrections: z.array(z.string().min(1))
});

export const preferenceProfileSchema = z.object({
  style: styleSchema,
  budgetTier: budgetTierSchema,
  naturalLanguagePreference: z.string().min(1),
  household: z.string().optional(),
  lifestyleNotes: z.array(z.string()).default([]),
  hardConstraints: z.array(z.string()).default([]),
  adoptedSuggestions: z.array(z.string()).default([]),
  rejectedSuggestions: z.array(z.string()).default([])
});

export const agentQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  recommendation: z.string().optional(),
  options: z.array(z.string().min(1)).min(1).max(4),
  reason: z.string().min(1)
});

export const keySpacePlanSchema = z.object({
  spaceType: roomTypeSchema,
  title: z.string().min(1),
  designGoal: z.string().min(1),
  explanation: z.string().min(1),
  layoutSuggestion: z.string().min(1),
  paletteAndMaterials: z.array(z.string().min(1)).min(1),
  furnitureAndSoftDecor: z.array(z.string().min(1)).min(1),
  budgetTradeOffs: z.string().min(1),
  practicalNotes: z.array(z.string().min(1)),
  renderingPrompt: z.string().min(1)
});

export const designPlanSchema = z.object({
  overallStrategy: z.string().min(1),
  styleSummary: z.string().min(1),
  budgetAssumptions: z.string().min(1),
  keySpaces: z.array(keySpacePlanSchema).min(2).max(3),
  disclaimer: z.string().min(1)
});

export type Style = z.infer<typeof styleSchema>;
export type BudgetTier = z.infer<typeof budgetTierSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type FloorPlanAnalysis = z.infer<typeof floorPlanAnalysisSchema>;
export type PreferenceProfile = z.infer<typeof preferenceProfileSchema>;
export type AgentQuestion = z.infer<typeof agentQuestionSchema>;
export type DesignPlan = z.infer<typeof designPlanSchema>;
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
npm run test -- tests/unit/domain-schemas.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit schemas**

Run:

```bash
git add src/lib/domain/schemas.ts tests/unit/domain-schemas.test.ts
git commit -m "feat: define renovation domain schemas"
```

## Task 3: Add Database Schema And Repository

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/lib/repositories/project-repository.ts`
- Create: `tests/unit/project-repository.test.ts`

- [ ] **Step 1: Add Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id              String             @id @default(cuid())
  name            String
  status          ProjectStatus      @default(CREATED)
  floorPlanUrl    String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  analysis        FloorPlanAnalysis?
  preference      PreferenceProfile?
  conversations   AgentConversation[]
  designPlan      DesignPlan?
  renderings      RenderingAsset[]
  briefExports    BriefExport[]
}

model FloorPlanAnalysis {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  analysisJson    Json
  confirmed       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model PreferenceProfile {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  profileJson     Json
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model AgentConversation {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  role            String
  content         String
  metadataJson    Json?
  createdAt       DateTime @default(now())
}

model DesignPlan {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  planJson        Json
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model RenderingAsset {
  id              String          @id @default(cuid())
  projectId       String
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  spaceType       String
  prompt          String
  imageUrl        String?
  status          AssetStatus     @default(PENDING)
  errorMessage    String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model BriefExport {
  id              String      @id @default(cuid())
  projectId       String
  project         Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fileUrl         String?
  status          AssetStatus @default(PENDING)
  version         Int         @default(1)
  errorMessage    String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

enum ProjectStatus {
  CREATED
  FLOOR_PLAN_ANALYZED
  PREFERENCES_COLLECTED
  INTERVIEWING
  PLAN_READY
  RENDERINGS_READY
  BRIEF_READY
}

enum AssetStatus {
  PENDING
  RUNNING
  READY
  FAILED
}
```

- [ ] **Step 2: Create Prisma client singleton**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Write repository tests against a mocked Prisma shape**

Create `tests/unit/project-repository.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createProjectRepository } from "@/lib/repositories/project-repository";

describe("project repository", () => {
  it("creates a project with CREATED status", async () => {
    const prisma = {
      project: {
        create: vi.fn().mockResolvedValue({ id: "p1", name: "我的装修方案", status: "CREATED" })
      }
    };

    const repo = createProjectRepository(prisma as never);
    const project = await repo.createProject("我的装修方案");

    expect(project.id).toBe("p1");
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { name: "我的装修方案" }
    });
  });

  it("stores confirmed floor plan analysis", async () => {
    const prisma = {
      floorPlanAnalysis: {
        upsert: vi.fn().mockResolvedValue({ id: "a1", confirmed: true })
      },
      project: {
        update: vi.fn().mockResolvedValue({ id: "p1", status: "FLOOR_PLAN_ANALYZED" })
      }
    };

    const repo = createProjectRepository(prisma as never);
    await repo.saveFloorPlanAnalysis("p1", { rooms: [], relationships: [], issues: [], uncertainItems: [], userCorrections: [] }, true);

    expect(prisma.floorPlanAnalysis.upsert).toHaveBeenCalled();
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "FLOOR_PLAN_ANALYZED" }
    });
  });
});
```

- [ ] **Step 4: Run repository tests and verify they fail**

Run:

```bash
npm run test -- tests/unit/project-repository.test.ts
```

Expected: FAIL because `project-repository.ts` does not exist.

- [ ] **Step 5: Implement repository**

Create `src/lib/repositories/project-repository.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

type PrismaLike = Pick<
  PrismaClient,
  "project" | "floorPlanAnalysis" | "preferenceProfile" | "agentConversation" | "designPlan" | "renderingAsset" | "briefExport"
>;

export function createProjectRepository(prisma: PrismaLike) {
  return {
    createProject(name: string) {
      return prisma.project.create({ data: { name } });
    },

    saveFloorPlanUrl(projectId: string, floorPlanUrl: string) {
      return prisma.project.update({
        where: { id: projectId },
        data: { floorPlanUrl }
      });
    },

    async saveFloorPlanAnalysis(projectId: string, analysis: FloorPlanAnalysis, confirmed: boolean) {
      const saved = await prisma.floorPlanAnalysis.upsert({
        where: { projectId },
        update: { analysisJson: analysis, confirmed },
        create: { projectId, analysisJson: analysis, confirmed }
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { status: "FLOOR_PLAN_ANALYZED" }
      });

      return saved;
    },

    savePreferenceProfile(projectId: string, profile: PreferenceProfile) {
      return prisma.preferenceProfile.upsert({
        where: { projectId },
        update: { profileJson: profile },
        create: { projectId, profileJson: profile }
      });
    },

    addConversationMessage(projectId: string, role: "agent" | "user" | "system", content: string, metadata?: unknown) {
      return prisma.agentConversation.create({
        data: {
          projectId,
          role,
          content,
          metadataJson: metadata === undefined ? undefined : metadata
        }
      });
    },

    saveDesignPlan(projectId: string, plan: DesignPlan) {
      return prisma.designPlan.upsert({
        where: { projectId },
        update: { planJson: plan },
        create: { projectId, planJson: plan }
      });
    }
  };
}
```

- [ ] **Step 6: Generate Prisma client and run tests**

Run:

```bash
npm run prisma:generate
npm run test -- tests/unit/project-repository.test.ts
```

Expected: Prisma client generation succeeds and repository tests PASS.

- [ ] **Step 7: Commit persistence layer**

Run:

```bash
git add prisma/schema.prisma src/lib/db.ts src/lib/repositories/project-repository.ts tests/unit/project-repository.test.ts
git commit -m "feat: add project persistence layer"
```

## Task 4: Add AI Provider Interface, Mock Provider, And Doubao Adapter

**Files:**
- Create: `src/lib/ai/ai-provider.ts`
- Create: `src/lib/ai/mock-ai-provider.ts`
- Create: `src/lib/ai/doubao-provider.ts`
- Create: `src/lib/ai/provider-factory.ts`

- [ ] **Step 1: Create provider interface**

Create `src/lib/ai/ai-provider.ts`:

```ts
import type { AgentQuestion, DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type AgentTurnInput = {
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  conversation: Array<{ role: "agent" | "user"; content: string }>;
};

export type AgentTurnOutput =
  | { type: "question"; question: AgentQuestion }
  | { type: "ready"; reason: string };

export interface AiProvider {
  analyzeFloorPlan(input: { imageUrl: string }): Promise<FloorPlanAnalysis>;
  nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput>;
  generateDesignPlan(input: { analysis: FloorPlanAnalysis; profile: PreferenceProfile; conversationSummary: string }): Promise<DesignPlan>;
  generateRendering(input: { prompt: string; spaceTitle: string }): Promise<{ imageUrl: string }>;
}
```

- [ ] **Step 2: Implement deterministic mock provider**

Create `src/lib/ai/mock-ai-provider.ts`:

```ts
import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import type { DesignPlan, FloorPlanAnalysis } from "@/lib/domain/schemas";

const mockAnalysis: FloorPlanAnalysis = {
  rooms: [
    { name: "客餐厅", type: "living_dining", confidence: 0.86 },
    { name: "主卧", type: "master_bedroom", confidence: 0.84 },
    { name: "厨房", type: "kitchen", confidence: 0.74 }
  ],
  relationships: ["客餐厅连接阳台", "厨房靠近餐厅", "主卧位于安静区域"],
  issues: [
    { type: "lighting", description: "客餐厅采光主要来自阳台一侧", confidence: 0.76 },
    { type: "storage", description: "玄关和餐边收纳需要提前规划", confidence: 0.68 }
  ],
  uncertainItems: ["厨房具体尺寸不可见"],
  userCorrections: []
};

export class MockAiProvider implements AiProvider {
  async analyzeFloorPlan(): Promise<FloorPlanAnalysis> {
    return mockAnalysis;
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    if (input.conversation.length >= 4) {
      return { type: "ready", reason: "已收集风格、采光、收纳和第三空间偏好" };
    }

    return {
      type: "question",
      question: {
        id: `q-${input.conversation.length + 1}`,
        question: "客餐厅采光集中在阳台一侧，你更希望保留开放感还是增加收纳？",
        recommendation: "建议优先保留开放感，并把收纳集中到玄关和餐边柜。",
        options: ["采纳开放感优先", "更需要收纳", "我想补充说明"],
        reason: "这个选择会直接影响柜体体量、材质深浅和客餐厅视觉开阔度。"
      }
    };
  }

  async generateDesignPlan(): Promise<DesignPlan> {
    return {
      overallStrategy: "以温暖、通透、易打理为主线，优先优化客餐厅开放感和主卧舒适度。",
      styleSummary: "原木风作为基础，减少过度日式元素，加入更克制的现代线条。",
      budgetAssumptions: "品质型预算下，优先保证高频使用空间的柜体、灯光和耐用材料。",
      keySpaces: [
        {
          spaceType: "living_dining",
          title: "客餐厅",
          designGoal: "提升开放感与日常收纳效率。",
          explanation: "客餐厅采光集中在阳台一侧，因此使用浅木色、低饱和墙面和轻体量家具来放大空间。",
          layoutSuggestion: "沙发靠长墙布置，餐边柜控制深度，避免遮挡阳台采光。",
          paletteAndMaterials: ["浅橡木", "暖白墙面", "低反光耐磨地面"],
          furnitureAndSoftDecor: ["低背沙发", "圆角餐桌", "线性灯"],
          budgetTradeOffs: "品质型档位建议把预算放在定制餐边柜和灯光层次上。",
          practicalNotes: ["避免深色满墙柜", "保留阳台到客厅的通透视线"],
          renderingPrompt: "温暖原木风客餐厅，浅橡木，暖白墙面，开放通透，适合一家三口"
        },
        {
          spaceType: "master_bedroom",
          title: "主卧",
          designGoal: "营造安静、耐看的休息空间。",
          explanation: "主卧以低刺激配色和足够收纳为重点，减少复杂造型。",
          layoutSuggestion: "床头背景保持简洁，衣柜使用浅色平板门。",
          paletteAndMaterials: ["米灰色", "浅木饰面", "柔和织物"],
          furnitureAndSoftDecor: ["软包床", "薄款床头柜", "遮光窗帘"],
          budgetTradeOffs: "品质型档位优先选择环保板材和舒适床垫。",
          practicalNotes: ["预留床两侧通行空间", "控制床头吊灯高度"],
          renderingPrompt: "温暖原木风主卧，米灰色，浅木饰面，安静舒适，柔和灯光"
        }
      ],
      disclaimer: "本方案为装修前沟通 brief，不是施工图或正式报价单。"
    };
  }

  async generateRendering(input: { prompt: string }): Promise<{ imageUrl: string }> {
    const encoded = encodeURIComponent(input.prompt.slice(0, 40));
    return { imageUrl: `https://placehold.co/1280x720?text=${encoded}` };
  }
}
```

- [ ] **Step 3: Implement Doubao adapter with environment-configured endpoints**

Create `src/lib/ai/doubao-provider.ts`:

```ts
import {
  designPlanSchema,
  floorPlanAnalysisSchema
} from "@/lib/domain/schemas";
import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";

type DoubaoConfig = {
  apiKey: string;
  visionUrl: string;
  chatUrl: string;
  seedreamUrl: string;
};

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Doubao request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export class DoubaoProvider implements AiProvider {
  constructor(private readonly config: DoubaoConfig) {}

  async analyzeFloorPlan(input: { imageUrl: string }) {
    const result = await postJson<{ output: unknown }>(this.config.visionUrl, this.config.apiKey, {
      image_url: input.imageUrl,
      instruction: "分析装修户型图，返回 JSON：rooms, relationships, issues, uncertainItems, userCorrections。不要输出施工图或精确报价。"
    });

    return floorPlanAnalysisSchema.parse(result.output);
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const result = await postJson<{ output: AgentTurnOutput }>(this.config.chatUrl, this.config.apiKey, {
      instruction: "你是装修设计师 Agent。最多追问 12 个问题。若信息足够，返回 ready；否则返回 question。",
      analysis: input.analysis,
      profile: input.profile,
      conversation: input.conversation
    });

    return result.output;
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    const result = await postJson<{ output: unknown }>(this.config.chatUrl, this.config.apiKey, {
      instruction: "生成装修设计 brief JSON，包含 overallStrategy, styleSummary, budgetAssumptions, keySpaces, disclaimer。keySpaces 数量必须是 2 到 3。",
      analysis: input.analysis,
      profile: input.profile,
      conversationSummary: input.conversationSummary
    });

    return designPlanSchema.parse(result.output);
  }

  async generateRendering(input: { prompt: string; spaceTitle: string }) {
    const result = await postJson<{ image_url?: string; data?: Array<{ url?: string }> }>(
      this.config.seedreamUrl,
      this.config.apiKey,
      {
        prompt: input.prompt,
        size: "1280x720",
        watermark: false
      }
    );

    const imageUrl = result.image_url ?? result.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error(`Seedream did not return an image URL for ${input.spaceTitle}`);
    }

    return { imageUrl };
  }
}
```

- [ ] **Step 4: Add provider factory**

Create `src/lib/ai/provider-factory.ts`:

```ts
import type { AiProvider } from "@/lib/ai/ai-provider";
import { DoubaoProvider } from "@/lib/ai/doubao-provider";
import { MockAiProvider } from "@/lib/ai/mock-ai-provider";

export function createAiProvider(): AiProvider {
  if (process.env.AI_PROVIDER !== "doubao") {
    return new MockAiProvider();
  }

  const apiKey = process.env.DOUBAO_API_KEY;
  const visionUrl = process.env.DOUBAO_VISION_URL;
  const chatUrl = process.env.DOUBAO_CHAT_URL;
  const seedreamUrl = process.env.SEEDREAM_IMAGE_URL;

  if (!apiKey || !visionUrl || !chatUrl || !seedreamUrl) {
    throw new Error("Doubao provider requires DOUBAO_API_KEY, DOUBAO_VISION_URL, DOUBAO_CHAT_URL, and SEEDREAM_IMAGE_URL.");
  }

  return new DoubaoProvider({ apiKey, visionUrl, chatUrl, seedreamUrl });
}
```

- [ ] **Step 5: Run typecheck and tests**

Run:

```bash
npm run test
npm run build
```

Expected: all tests PASS and build succeeds.

- [ ] **Step 6: Commit AI provider layer**

Run:

```bash
git add src/lib/ai
git commit -m "feat: add doubao-ready ai provider layer"
```

## Task 5: Implement Designer Agent Workflow

**Files:**
- Create: `src/lib/agent/workflow.ts`
- Create: `tests/unit/agent-workflow.test.ts`

- [ ] **Step 1: Write workflow tests**

Create `tests/unit/agent-workflow.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runNextAgentStep } from "@/lib/agent/workflow";
import type { AiProvider } from "@/lib/ai/ai-provider";

const analysis = {
  rooms: [{ name: "客餐厅", type: "living_dining" as const, confidence: 0.8 }],
  relationships: ["客餐厅连接阳台"],
  issues: [{ type: "lighting" as const, description: "采光集中在阳台一侧", confidence: 0.7 }],
  uncertainItems: [],
  userCorrections: []
};

const profile = {
  style: "warm_wood" as const,
  budgetTier: "quality" as const,
  naturalLanguagePreference: "显大，好打理",
  lifestyleNotes: [],
  hardConstraints: [],
  adoptedSuggestions: [],
  rejectedSuggestions: []
};

describe("designer agent workflow", () => {
  it("stops asking after 12 user-agent turns", async () => {
    const provider = {
      nextAgentTurn: vi.fn().mockResolvedValue({
        type: "question",
        question: {
          id: "q-13",
          question: "还要继续问吗？",
          options: ["不需要"],
          reason: "测试"
        }
      })
    } as unknown as AiProvider;

    const conversation = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? ("agent" as const) : ("user" as const),
      content: `message ${index}`
    }));

    const result = await runNextAgentStep({ provider, analysis, profile, conversation });

    expect(result.type).toBe("ready");
    expect(provider.nextAgentTurn).not.toHaveBeenCalled();
  });

  it("returns provider question when under limit", async () => {
    const provider = {
      nextAgentTurn: vi.fn().mockResolvedValue({
        type: "question",
        question: {
          id: "q-1",
          question: "是否保留客餐厅开放感？",
          options: ["采纳", "拒绝"],
          reason: "影响布局"
        }
      })
    } as unknown as AiProvider;

    const result = await runNextAgentStep({ provider, analysis, profile, conversation: [] });

    expect(result.type).toBe("question");
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm run test -- tests/unit/agent-workflow.test.ts
```

Expected: FAIL because `workflow.ts` does not exist.

- [ ] **Step 3: Implement workflow guardrails**

Create `src/lib/agent/workflow.ts`:

```ts
import type { AiProvider, AgentTurnOutput } from "@/lib/ai/ai-provider";
import type { FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type AgentWorkflowInput = {
  provider: AiProvider;
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  conversation: Array<{ role: "agent" | "user"; content: string }>;
};

function countAgentQuestions(conversation: AgentWorkflowInput["conversation"]) {
  return conversation.filter((message) => message.role === "agent").length;
}

export async function runNextAgentStep(input: AgentWorkflowInput): Promise<AgentTurnOutput> {
  if (countAgentQuestions(input.conversation) >= 12) {
    return {
      type: "ready",
      reason: "已达到最多 12 个追问，进入方案生成。"
    };
  }

  return input.provider.nextAgentTurn({
    analysis: input.analysis,
    profile: input.profile,
    conversation: input.conversation
  });
}
```

- [ ] **Step 4: Run workflow tests**

Run:

```bash
npm run test -- tests/unit/agent-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit workflow**

Run:

```bash
git add src/lib/agent/workflow.ts tests/unit/agent-workflow.test.ts
git commit -m "feat: add staged designer agent workflow"
```

## Task 6: Implement API Routes For The MVP Flow

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[projectId]/floor-plan/route.ts`
- Create: `src/app/api/projects/[projectId]/preferences/route.ts`
- Create: `src/app/api/projects/[projectId]/agent/respond/route.ts`
- Create: `src/app/api/projects/[projectId]/design-plan/route.ts`
- Create: `src/app/api/projects/[projectId]/renderings/route.ts`
- Create: `src/app/api/projects/[projectId]/brief/route.ts`

- [ ] **Step 1: Implement project creation route**

Create `src/app/api/projects/route.ts`:

```ts
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "我的装修方案").trim();
  const repo = createProjectRepository(prisma);
  const project = await repo.createProject(name || "我的装修方案");
  redirect(`/projects/${project.id}`);
}
```

- [ ] **Step 2: Implement floor-plan analysis route**

Create `src/app/api/projects/[projectId]/floor-plan/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("floorPlan");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传户型图文件。" }, { status: 400 });
  }

  const imageUrl = `/uploads/${projectId}/${encodeURIComponent(file.name)}`;
  const provider = createAiProvider();
  const repo = createProjectRepository(prisma);
  const analysis = await provider.analyzeFloorPlan({ imageUrl });

  await repo.saveFloorPlanUrl(projectId, imageUrl);
  await repo.saveFloorPlanAnalysis(projectId, analysis, false);

  return NextResponse.json({ imageUrl, analysis });
}
```

- [ ] **Step 3: Implement preferences route**

Create `src/app/api/projects/[projectId]/preferences/route.ts`:

```ts
import { NextResponse } from "next/server";
import { preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const body = await request.json();
  const profile = preferenceProfileSchema.parse(body);
  const repo = createProjectRepository(prisma);
  await repo.savePreferenceProfile(projectId, profile);
  return NextResponse.json({ profile });
}
```

- [ ] **Step 4: Implement agent response route**

Create `src/app/api/projects/[projectId]/agent/respond/route.ts` with repository reads added before wiring UI. Use Prisma includes directly for this first slice:

```ts
import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { runNextAgentStep } from "@/lib/agent/workflow";
import { floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const body = await request.json();
  const userAnswer = String(body.answer ?? "").trim();
  const repo = createProjectRepository(prisma);

  if (userAnswer) {
    await repo.addConversationMessage(projectId, "user", userAnswer);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, preference: true, conversations: { orderBy: { createdAt: "asc" } } }
  });

  if (!project?.analysis || !project.preference) {
    return NextResponse.json({ error: "请先完成户型分析和偏好设置。" }, { status: 400 });
  }

  const result = await runNextAgentStep({
    provider: createAiProvider(),
    analysis: floorPlanAnalysisSchema.parse(project.analysis.analysisJson),
    profile: preferenceProfileSchema.parse(project.preference.profileJson),
    conversation: project.conversations
      .filter((message) => message.role === "agent" || message.role === "user")
      .map((message) => ({ role: message.role as "agent" | "user", content: message.content }))
  });

  if (result.type === "question") {
    await repo.addConversationMessage(projectId, "agent", result.question.question, result.question);
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 5: Implement design plan route**

Create `src/app/api/projects/[projectId]/design-plan/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, preference: true, conversations: { orderBy: { createdAt: "asc" } } }
  });

  if (!project?.analysis || !project.preference) {
    return NextResponse.json({ error: "请先完成户型分析和偏好设置。" }, { status: 400 });
  }

  const conversationSummary = project.conversations.map((message) => `${message.role}: ${message.content}`).join("\n");
  const plan = await createAiProvider().generateDesignPlan({
    analysis: floorPlanAnalysisSchema.parse(project.analysis.analysisJson),
    profile: preferenceProfileSchema.parse(project.preference.profileJson),
    conversationSummary
  });

  await createProjectRepository(prisma).saveDesignPlan(projectId, plan);
  await prisma.project.update({ where: { id: projectId }, data: { status: "PLAN_READY" } });

  return NextResponse.json({ plan });
}
```

- [ ] **Step 6: Implement rendering route**

Create `src/app/api/projects/[projectId]/renderings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { designPlanSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const designPlan = await prisma.designPlan.findUnique({ where: { projectId } });

  if (!designPlan) {
    return NextResponse.json({ error: "请先生成设计方案。" }, { status: 400 });
  }

  const plan = designPlanSchema.parse(designPlan.planJson);
  const provider = createAiProvider();

  const renderings = await Promise.all(
    plan.keySpaces.map(async (space) => {
      const created = await prisma.renderingAsset.create({
        data: { projectId, spaceType: space.spaceType, prompt: space.renderingPrompt, status: "RUNNING" }
      });

      try {
        const result = await provider.generateRendering({ prompt: space.renderingPrompt, spaceTitle: space.title });
        return prisma.renderingAsset.update({
          where: { id: created.id },
          data: { imageUrl: result.imageUrl, status: "READY" }
        });
      } catch (error) {
        return prisma.renderingAsset.update({
          where: { id: created.id },
          data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "效果图生成失败" }
        });
      }
    })
  );

  await prisma.project.update({ where: { id: projectId }, data: { status: "RENDERINGS_READY" } });
  return NextResponse.json({ renderings });
}
```

- [ ] **Step 7: Implement PDF metadata route before full PDF generation**

Create `src/app/api/projects/[projectId]/brief/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const exportRecord = await prisma.briefExport.create({
    data: {
      projectId,
      status: "READY",
      fileUrl: `/api/projects/${projectId}/brief/download`
    }
  });

  await prisma.project.update({ where: { id: projectId }, data: { status: "BRIEF_READY" } });
  return NextResponse.json({ brief: exportRecord });
}
```

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: PASS after route type errors are corrected.

- [ ] **Step 9: Commit API routes**

Run:

```bash
git add src/app/api
git commit -m "feat: add renovation mvp api routes"
```

## Task 7: Build The Project Workspace UI

**Files:**
- Create: `src/app/projects/[projectId]/page.tsx`
- Create: `src/components/project-workspace.tsx`
- Create: `src/components/brief-preview.tsx`

- [ ] **Step 1: Create project page**

Create `src/app/projects/[projectId]/page.tsx`:

```tsx
import { prisma } from "@/lib/db";
import { ProjectWorkspace } from "@/components/project-workspace";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true,
      conversations: { orderBy: { createdAt: "asc" } },
      designPlan: true,
      renderings: true,
      briefExports: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!project) {
    return <main className="p-8">项目不存在</main>;
  }

  return <ProjectWorkspace project={JSON.parse(JSON.stringify(project))} />;
}
```

- [ ] **Step 2: Create workspace component**

Create `src/components/project-workspace.tsx`:

```tsx
"use client";

import { useState } from "react";
import { FileText, Image, MessageSquare, WandSparkles } from "lucide-react";
import { BriefPreview } from "@/components/brief-preview";

type ProjectWorkspaceProps = {
  project: {
    id: string;
    name: string;
    status: string;
    analysis?: { analysisJson: unknown } | null;
    designPlan?: { planJson: unknown } | null;
    renderings: Array<{ id: string; spaceType: string; imageUrl: string | null; status: string }>;
    conversations: Array<{ id: string; role: string; content: string; metadataJson?: unknown }>;
  };
};

const styles = [
  ["warm_wood", "原木风"],
  ["vintage", "中古风"],
  ["modern_minimal", "现代简约"],
  ["cream", "奶油风"],
  ["wabi_sabi", "侘寂风"]
] as const;

const budgets = [
  ["economy", "经济型"],
  ["quality", "品质型"],
  ["premium", "高品质型"]
] as const;

export function ProjectWorkspace({ project }: ProjectWorkspaceProps) {
  const [status, setStatus] = useState(project.status);
  const [agentResult, setAgentResult] = useState<unknown>(null);

  async function submitJson(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header>
          <p className="text-sm text-[var(--muted)]">当前状态：{status}</p>
          <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
        </header>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Image size={20} /> 上传户型图</h2>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const response = await fetch(`/api/projects/${project.id}/floor-plan`, { method: "POST", body: data });
              if (!response.ok) throw new Error(await response.text());
              setStatus("FLOOR_PLAN_ANALYZED");
            }}
            className="flex flex-wrap gap-3"
          >
            <input name="floorPlan" type="file" accept="image/*" required className="rounded-md border border-[var(--line)] px-3 py-2" />
            <button className="rounded-md bg-[var(--accent)] px-4 py-2 text-white">分析户型</button>
          </form>
        </section>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><WandSparkles size={20} /> 风格与预算</h2>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await submitJson(`/api/projects/${project.id}/preferences`, {
                style: data.get("style"),
                budgetTier: data.get("budgetTier"),
                naturalLanguagePreference: data.get("naturalLanguagePreference"),
                lifestyleNotes: [],
                hardConstraints: [],
                adoptedSuggestions: [],
                rejectedSuggestions: []
              });
              setStatus("PREFERENCES_COLLECTED");
            }}
            className="grid gap-3"
          >
            <select name="style" className="rounded-md border border-[var(--line)] px-3 py-2">
              {styles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="budgetTier" className="rounded-md border border-[var(--line)] px-3 py-2">
              {budgets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea
              name="naturalLanguagePreference"
              required
              rows={4}
              className="rounded-md border border-[var(--line)] px-3 py-2"
              defaultValue="希望显大、好打理，适合一家三口。"
            />
            <button className="w-fit rounded-md bg-[var(--accent)] px-4 py-2 text-white">保存偏好</button>
          </form>
        </section>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageSquare size={20} /> Agent 追问</h2>
          <button
            onClick={async () => {
              const result = await submitJson(`/api/projects/${project.id}/agent/respond`, { answer: "" });
              setAgentResult(result);
            }}
            className="w-fit rounded-md bg-[var(--accent)] px-4 py-2 text-white"
          >
            获取下一步问题
          </button>
          <pre className="overflow-auto rounded-md bg-[#f3f0e8] p-3 text-sm">{JSON.stringify(agentResult, null, 2)}</pre>
        </section>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText size={20} /> 方案与 PDF</h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={async () => { await submitJson(`/api/projects/${project.id}/design-plan`, {}); setStatus("PLAN_READY"); }} className="rounded-md bg-[var(--accent)] px-4 py-2 text-white">生成方案</button>
            <button onClick={async () => { await submitJson(`/api/projects/${project.id}/renderings`, {}); setStatus("RENDERINGS_READY"); }} className="rounded-md bg-[var(--accent)] px-4 py-2 text-white">生成效果图</button>
            <button onClick={async () => { await submitJson(`/api/projects/${project.id}/brief`, {}); setStatus("BRIEF_READY"); }} className="rounded-md bg-[var(--accent)] px-4 py-2 text-white">生成 PDF brief</button>
          </div>
          <BriefPreview project={project} />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create brief preview component**

Create `src/components/brief-preview.tsx`:

```tsx
type BriefPreviewProps = {
  project: {
    analysis?: { analysisJson: unknown } | null;
    designPlan?: { planJson: unknown } | null;
    renderings: Array<{ id: string; spaceType: string; imageUrl: string | null; status: string }>;
  };
};

export function BriefPreview({ project }: BriefPreviewProps) {
  return (
    <div className="grid gap-4 rounded-md border border-[var(--line)] p-4">
      <h3 className="font-semibold">方案预览</h3>
      <pre className="max-h-80 overflow-auto rounded-md bg-[#f3f0e8] p-3 text-xs">
        {JSON.stringify(
          {
            analysis: project.analysis?.analysisJson ?? null,
            plan: project.designPlan?.planJson ?? null,
            renderings: project.renderings
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit workspace UI**

Run:

```bash
git add src/app/projects src/components
git commit -m "feat: add renovation project workspace"
```

## Task 8: Implement Real PDF Rendering

**Files:**
- Create: `src/lib/pdf/render-brief.ts`
- Modify: `src/app/api/projects/[projectId]/brief/route.ts`

- [ ] **Step 1: Create PDF renderer**

Create `src/lib/pdf/render-brief.ts`:

```ts
import { chromium } from "playwright";
import type { DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type BriefPdfInput = {
  projectName: string;
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  plan: DesignPlan;
  renderings: Array<{ spaceType: string; imageUrl: string | null }>;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildBriefHtml(input: BriefPdfInput) {
  const spaces = input.plan.keySpaces
    .map((space) => {
      const rendering = input.renderings.find((item) => item.spaceType === space.spaceType);
      const image = rendering?.imageUrl ? `<img src="${escapeHtml(rendering.imageUrl)}" alt="${escapeHtml(space.title)}" />` : "<p>效果图生成中或生成失败。</p>";
      return `
        <section>
          <h2>${escapeHtml(space.title)}</h2>
          ${image}
          <p><strong>设计目标：</strong>${escapeHtml(space.designGoal)}</p>
          <p>${escapeHtml(space.explanation)}</p>
          <p><strong>布局建议：</strong>${escapeHtml(space.layoutSuggestion)}</p>
          <p><strong>预算取舍：</strong>${escapeHtml(space.budgetTradeOffs)}</p>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, "PingFang SC", sans-serif; color: #20201d; line-height: 1.65; padding: 32px; }
          h1 { font-size: 28px; }
          h2 { margin-top: 28px; font-size: 20px; }
          img { width: 100%; max-height: 420px; object-fit: cover; border-radius: 6px; }
          section { break-inside: avoid; border-top: 1px solid #ddd6c8; padding-top: 16px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(input.projectName)} 装修设计 Brief</h1>
        <p><strong>风格：</strong>${escapeHtml(input.profile.style)}</p>
        <p><strong>预算档位：</strong>${escapeHtml(input.profile.budgetTier)}</p>
        <p><strong>用户需求：</strong>${escapeHtml(input.profile.naturalLanguagePreference)}</p>
        <h2>户型分析</h2>
        <p>${escapeHtml(input.analysis.relationships.join("；"))}</p>
        <p>${escapeHtml(input.analysis.issues.map((issue) => issue.description).join("；"))}</p>
        <h2>整体策略</h2>
        <p>${escapeHtml(input.plan.overallStrategy)}</p>
        <p>${escapeHtml(input.plan.budgetAssumptions)}</p>
        ${spaces}
        <section>
          <h2>说明</h2>
          <p>${escapeHtml(input.plan.disclaimer)}</p>
        </section>
      </body>
    </html>
  `;
}

export async function renderBriefPdf(input: BriefPdfInput) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(buildBriefHtml(input), { waitUntil: "networkidle" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return pdf;
}
```

- [ ] **Step 2: Update brief route to render PDF**

Modify `src/app/api/projects/[projectId]/brief/route.ts`:

```ts
import { NextResponse } from "next/server";
import { floorPlanAnalysisSchema, preferenceProfileSchema, designPlanSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { renderBriefPdf } from "@/lib/pdf/render-brief";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, preference: true, designPlan: true, renderings: true }
  });

  if (!project?.analysis || !project.preference || !project.designPlan) {
    return NextResponse.json({ error: "请先完成户型分析、偏好设置和方案生成。" }, { status: 400 });
  }

  const pdf = await renderBriefPdf({
    projectName: project.name,
    analysis: floorPlanAnalysisSchema.parse(project.analysis.analysisJson),
    profile: preferenceProfileSchema.parse(project.preference.profileJson),
    plan: designPlanSchema.parse(project.designPlan.planJson),
    renderings: project.renderings.map((item) => ({ spaceType: item.spaceType, imageUrl: item.imageUrl }))
  });

  const exportRecord = await prisma.briefExport.create({
    data: {
      projectId,
      status: "READY",
      fileUrl: `/api/projects/${projectId}/brief/download`
    }
  });

  await prisma.project.update({ where: { id: projectId }, data: { status: "BRIEF_READY" } });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="renovation-brief-${exportRecord.version}.pdf"`
    }
  });
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit PDF export**

Run:

```bash
git add src/lib/pdf/render-brief.ts src/app/api/projects/[projectId]/brief/route.ts
git commit -m "feat: render renovation brief pdf"
```

## Task 9: Add E2E Smoke Test

**Files:**
- Create: `tests/e2e/mvp-flow.spec.ts`

- [ ] **Step 1: Write e2e flow test**

Create `tests/e2e/mvp-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("homeowner can start a renovation project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /上传户型图/ })).toBeVisible();
  await page.getByRole("button", { name: /创建项目/ }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByRole("heading", { name: /我的装修方案/ })).toBeVisible();
  await expect(page.getByText("上传户型图")).toBeVisible();
  await expect(page.getByText("风格与预算")).toBeVisible();
  await expect(page.getByText("Agent 追问")).toBeVisible();
});
```

- [ ] **Step 2: Run e2e test**

Run:

```bash
npm run test:e2e -- tests/e2e/mvp-flow.spec.ts
```

Expected: PASS with the dev server running through Playwright.

- [ ] **Step 3: Commit e2e smoke test**

Run:

```bash
git add tests/e2e/mvp-flow.spec.ts
git commit -m "test: add renovation mvp smoke flow"
```

## Task 10: Add Environment Documentation

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create environment example**

Create `.env.example`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/deck_it"
AI_PROVIDER="mock"
DOUBAO_API_KEY=""
DOUBAO_VISION_URL=""
DOUBAO_CHAT_URL=""
SEEDREAM_IMAGE_URL=""
REDIS_URL="redis://localhost:6379"
```

- [ ] **Step 2: Create README**

Create `README.md`:

```md
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
```

- [ ] **Step 3: Run documentation-stage verification**

Run:

```bash
npm run test
npm run build
npm run test:e2e
```

Expected: unit tests PASS, build PASS, e2e smoke test PASS.

- [ ] **Step 4: Commit documentation**

Run:

```bash
git add .env.example README.md
git commit -m "docs: document renovation agent setup"
```

## Task 11: Add Local Storage And Queue Boundaries

**Files:**
- Create: `.gitignore`
- Create: `src/lib/storage/storage-provider.ts`
- Create: `src/lib/storage/local-storage-provider.ts`
- Create: `src/lib/storage/provider-factory.ts`
- Create: `src/lib/jobs/queue.ts`
- Modify: `src/app/api/projects/[projectId]/floor-plan/route.ts`

- [ ] **Step 1: Ignore generated local files**

Create `.gitignore`:

```gitignore
node_modules
.next
.env
.data
playwright-report
test-results
```

- [ ] **Step 2: Create storage interface**

Create `src/lib/storage/storage-provider.ts`:

```ts
export type StoredFile = {
  url: string;
  storageKey: string;
};

export interface StorageProvider {
  saveProjectFile(input: {
    projectId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<StoredFile>;
}
```

- [ ] **Step 3: Create local storage provider**

Create `src/lib/storage/local-storage-provider.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider, StoredFile } from "@/lib/storage/storage-provider";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir = path.join(process.cwd(), ".data", "uploads")) {}

  async saveProjectFile(input: {
    projectId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<StoredFile> {
    const fileName = `${Date.now()}-${safeFileName(input.fileName)}`;
    const projectDir = path.join(this.rootDir, input.projectId);
    await mkdir(projectDir, { recursive: true });
    const diskPath = path.join(projectDir, fileName);
    await writeFile(diskPath, input.bytes);

    return {
      storageKey: `${input.projectId}/${fileName}`,
      url: `/local-uploads/${input.projectId}/${fileName}`
    };
  }
}
```

- [ ] **Step 4: Create storage factory**

Create `src/lib/storage/provider-factory.ts`:

```ts
import type { StorageProvider } from "@/lib/storage/storage-provider";
import { LocalStorageProvider } from "@/lib/storage/local-storage-provider";

export function createStorageProvider(): StorageProvider {
  return new LocalStorageProvider();
}
```

- [ ] **Step 5: Create queue boundary**

Create `src/lib/jobs/queue.ts`:

```ts
import { Queue } from "bullmq";

export type JobName = "analyze-floor-plan" | "generate-renderings" | "generate-brief";

export function createQueue(name: JobName) {
  const connectionUrl = process.env.REDIS_URL;
  if (!connectionUrl) {
    return null;
  }

  return new Queue(name, {
    connection: {
      url: connectionUrl
    }
  });
}
```

- [ ] **Step 6: Update floor-plan route to persist upload bytes**

Modify `src/app/api/projects/[projectId]/floor-plan/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";
import { createStorageProvider } from "@/lib/storage/provider-factory";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("floorPlan");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传户型图文件。" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await createStorageProvider().saveProjectFile({
    projectId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    bytes
  });

  const provider = createAiProvider();
  const repo = createProjectRepository(prisma);
  const analysis = await provider.analyzeFloorPlan({ imageUrl: stored.url });

  await repo.saveFloorPlanUrl(projectId, stored.url);
  await repo.saveFloorPlanAnalysis(projectId, analysis, false);

  return NextResponse.json({ imageUrl: stored.url, analysis });
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
npm run test
npm run build
```

Expected: unit tests PASS and build PASS.

- [ ] **Step 8: Commit storage and queue boundaries**

Run:

```bash
git add .gitignore src/lib/storage src/lib/jobs src/app/api/projects/[projectId]/floor-plan/route.ts
git commit -m "feat: add storage and queue boundaries"
```

## Self-Review Notes

Spec coverage:

- Upload and project creation are covered by Tasks 1, 3, 6, and 7.
- Lightweight floor plan understanding is covered by Tasks 2, 4, and 6.
- Uploaded file persistence is covered by Task 11.
- Style, budget tier, and natural-language preference collection are covered by Tasks 2, 6, and 7.
- Dynamic agent follow-up with a 12-question maximum is covered by Task 5.
- Design plan generation for 2-3 key spaces is covered by Tasks 2, 4, and 6.
- Rendering generation with Seedream boundary is covered by Tasks 4 and 6.
- PDF brief export is covered by Task 8.
- Error boundaries are partially covered through API validation and failed rendering persistence in Task 6; richer UI error states should be added after the first smoke flow passes.
- Mock-first local development and Doubao-ready integration are covered by Tasks 4 and 10.
- Async queue boundaries are covered by Task 11.

Type consistency:

- `Style`, `BudgetTier`, `FloorPlanAnalysis`, `PreferenceProfile`, `AgentQuestion`, and `DesignPlan` are defined in Task 2 and reused by subsequent tasks.
- Provider methods are defined in Task 4 and reused by Tasks 5 and 6.
- Prisma model names match repository and route references.

Scope control:

- This plan builds the MVP vertical slice from an empty repo.
- It intentionally defers professional CAD parsing, real 3D reconstruction, precise quotation, procurement, designer workbench, and lead distribution.
