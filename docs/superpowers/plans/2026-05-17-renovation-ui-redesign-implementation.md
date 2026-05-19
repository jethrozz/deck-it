# Renovation UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the renovation design Agent UI to match `ui/ui.png`: a staged wizard, automatic designer interview, automatic generation flow, completion transition, and readable final brief page.

**Architecture:** Replace the current all-in-one `ProjectWorkspace` page with route-level steps backed by a shared wizard shell, status-to-route helpers, and focused API endpoints. Keep the existing Prisma entities, AI provider boundary, storage provider, and PDF renderer, while adding missing workflow statuses and a small generation orchestrator endpoint.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Prisma, Vitest, Playwright, lucide-react.

---

## File Structure

- Modify `prisma/schema.prisma`: extend `ProjectStatus` with the workflow states used by the UI.
- Modify `src/lib/domain/schemas.ts`: add `bright` style, interview response schemas, and generation task schemas.
- Create `src/lib/projects/flow.ts`: map project statuses to wizard steps and canonical routes.
- Create `src/lib/projects/labels.ts`: labels for the current style, budget, and room enums; later update style labels when the UI style schema changes.
- Modify `src/lib/repositories/project-repository.ts`: add focused status and confirmation helpers.
- Modify `src/lib/agent/workflow.ts`: return designer prompts/suggestions/complete states instead of the old question-only shape.
- Modify `src/lib/ai/ai-provider.ts`: update the agent turn output contract.
- Modify `src/lib/ai/mock-ai-provider.ts`: make mock interview turns deterministic for tests.
- Modify `src/lib/ai/doubao-provider.ts`: normalize live output into the new interview contract.
- Modify `src/app/api/projects/route.ts`: redirect newly created projects to `/upload`.
- Create `src/app/api/projects/[projectId]/analysis/route.ts`: save analysis confirmation and corrections.
- Modify `src/app/api/projects/[projectId]/preferences/route.ts`: move directly to `INTERVIEWING`.
- Modify `src/app/api/projects/[projectId]/agent/respond/route.ts`: support `action: "start"` and `action: "answer"`.
- Create `src/app/api/projects/[projectId]/generate/route.ts`: orchestrate plan, renderings, and PDF record generation behind one user action.
- Create `src/components/wizard-shell.tsx`: shared centered wizard frame and top progress.
- Create `src/components/ui/primitives.tsx`: buttons, cards, inputs, badges used across pages.
- Create `src/components/analysis-summary.tsx`: readable floor-plan analysis summary.
- Create `src/components/style-budget-cards.tsx`: style image cards and budget cards.
- Create `src/components/interview-panel.tsx`: designer conversation UI.
- Create `src/components/generation-status.tsx`: generation task list and preview.
- Create `src/components/brief-report.tsx`: final report content without JSON.
- Modify `src/app/page.tsx`: implement the dark create-project hero.
- Create route pages under `src/app/projects/[projectId]/upload/page.tsx`, `analysis/loading/page.tsx`, `analysis/page.tsx`, `preferences/page.tsx`, `interview/page.tsx`, `generating/page.tsx`, `complete/page.tsx`, and `brief/page.tsx`.
- Modify `src/app/projects/[projectId]/page.tsx`: redirect to the canonical route from project status.
- Modify `src/app/globals.css`: add the UI theme tokens from the reference.
- Modify `tests/unit/domain-schemas.test.ts`: cover new schema values.
- Create `tests/unit/project-flow.test.ts`: cover status-to-route mapping.
- Modify `tests/unit/agent-workflow.test.ts`: cover designer start, answer, and 12-turn completion.
- Modify `tests/unit/project-repository.test.ts`: cover status updates and analysis confirmation.
- Replace `tests/e2e/mvp-flow.spec.ts` with the staged UI journey.

---

### Task 1: Workflow Statuses And Route Mapping

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/projects/flow.ts`
- Create: `src/lib/projects/labels.ts`
- Test: `tests/unit/project-flow.test.ts`

- [ ] **Step 1: Write the status mapping test**

Create `tests/unit/project-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getProjectStep, getProjectRoute, wizardSteps } from "@/lib/projects/flow";

describe("project flow mapping", () => {
  it("maps project statuses to canonical wizard routes", () => {
    const projectId = "p1";

    expect(getProjectRoute(projectId, "CREATED")).toBe("/projects/p1/upload");
    expect(getProjectRoute(projectId, "FLOOR_PLAN_UPLOADING")).toBe("/projects/p1/upload");
    expect(getProjectRoute(projectId, "FLOOR_PLAN_ANALYZING")).toBe("/projects/p1/analysis/loading");
    expect(getProjectRoute(projectId, "FLOOR_PLAN_ANALYZED")).toBe("/projects/p1/analysis");
    expect(getProjectRoute(projectId, "ANALYSIS_CONFIRMED")).toBe("/projects/p1/preferences");
    expect(getProjectRoute(projectId, "PREFERENCES_COLLECTED")).toBe("/projects/p1/interview");
    expect(getProjectRoute(projectId, "INTERVIEWING")).toBe("/projects/p1/interview");
    expect(getProjectRoute(projectId, "INTERVIEW_COMPLETE")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_REQUIREMENT_PROFILE")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_PLAN")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "PLAN_READY")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_RENDERINGS")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "RENDERINGS_READY")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_BRIEF")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "BRIEF_READY")).toBe("/projects/p1/complete");
  });

  it("maps statuses to the six visible wizard steps", () => {
    expect(wizardSteps.map((step) => step.label)).toEqual([
      "上传户型图",
      "户型分析",
      "风格预算",
      "设计师咨询",
      "生成中",
      "方案完成"
    ]);

    expect(getProjectStep("CREATED").key).toBe("upload");
    expect(getProjectStep("FLOOR_PLAN_ANALYZING").key).toBe("analysis");
    expect(getProjectStep("ANALYSIS_CONFIRMED").key).toBe("preferences");
    expect(getProjectStep("INTERVIEWING").key).toBe("interview");
    expect(getProjectStep("GENERATING_PLAN").key).toBe("generating");
    expect(getProjectStep("BRIEF_READY").key).toBe("complete");
  });
});
```

- [ ] **Step 2: Run the mapping test to verify it fails**

Run: `npm test -- tests/unit/project-flow.test.ts`

Expected: FAIL because `src/lib/projects/flow.ts` does not exist.

- [ ] **Step 3: Extend Prisma project statuses**

Update `prisma/schema.prisma`:

```prisma
enum ProjectStatus {
  CREATED
  FLOOR_PLAN_UPLOADING
  FLOOR_PLAN_ANALYZING
  FLOOR_PLAN_ANALYZED
  ANALYSIS_CONFIRMED
  PREFERENCES_COLLECTED
  INTERVIEWING
  INTERVIEW_COMPLETE
  GENERATING_REQUIREMENT_PROFILE
  GENERATING_PLAN
  PLAN_READY
  GENERATING_RENDERINGS
  RENDERINGS_READY
  GENERATING_BRIEF
  BRIEF_READY
}
```

- [ ] **Step 4: Add labels and flow helpers**

Create `src/lib/projects/labels.ts`:

```ts
import type { BudgetTier, RoomType, Style } from "@/lib/domain/schemas";

export const styleLabels: Record<Style, string> = {
  warm_wood: "原木风",
  vintage: "中古风",
  modern_minimal: "现代简约",
  cream: "奶油风",
  wabi_sabi: "侘寂风"
};

export const budgetLabels: Record<BudgetTier, { title: string; range: string }> = {
  economy: { title: "经济型", range: "10-15 万" },
  quality: { title: "品质型", range: "15-25 万" },
  premium: { title: "高品质型", range: "25 万以上" }
};

export const roomLabels: Record<RoomType, string> = {
  living_dining: "客餐厅",
  master_bedroom: "主卧",
  kitchen: "厨房",
  child_room: "儿童房",
  study: "书房",
  bathroom: "卫生间",
  balcony: "阳台",
  other: "其他空间"
};
```

Create `src/lib/projects/flow.ts`:

```ts
import type { ProjectStatus } from "@prisma/client";

export type WizardStepKey = "upload" | "analysis" | "preferences" | "interview" | "generating" | "complete";

export type WizardStep = {
  key: WizardStepKey;
  label: string;
};

export const wizardSteps: WizardStep[] = [
  { key: "upload", label: "上传户型图" },
  { key: "analysis", label: "户型分析" },
  { key: "preferences", label: "风格预算" },
  { key: "interview", label: "设计师咨询" },
  { key: "generating", label: "生成中" },
  { key: "complete", label: "方案完成" }
];

const statusToStep: Record<ProjectStatus, WizardStepKey> = {
  CREATED: "upload",
  FLOOR_PLAN_UPLOADING: "upload",
  FLOOR_PLAN_ANALYZING: "analysis",
  FLOOR_PLAN_ANALYZED: "analysis",
  ANALYSIS_CONFIRMED: "preferences",
  PREFERENCES_COLLECTED: "interview",
  INTERVIEWING: "interview",
  INTERVIEW_COMPLETE: "generating",
  GENERATING_REQUIREMENT_PROFILE: "generating",
  GENERATING_PLAN: "generating",
  PLAN_READY: "generating",
  GENERATING_RENDERINGS: "generating",
  RENDERINGS_READY: "generating",
  GENERATING_BRIEF: "generating",
  BRIEF_READY: "complete"
};

const stepToPath: Record<WizardStepKey, string> = {
  upload: "upload",
  analysis: "analysis",
  preferences: "preferences",
  interview: "interview",
  generating: "generating",
  complete: "complete"
};

export function getProjectStep(status: ProjectStatus): WizardStep {
  const key = statusToStep[status];
  return wizardSteps.find((step) => step.key === key) ?? wizardSteps[0];
}

export function getProjectRoute(projectId: string, status: ProjectStatus) {
  if (status === "FLOOR_PLAN_ANALYZING") {
    return `/projects/${projectId}/analysis/loading`;
  }

  return `/projects/${projectId}/${stepToPath[getProjectStep(status).key]}`;
}

export function getStepIndex(stepKey: WizardStepKey) {
  return wizardSteps.findIndex((step) => step.key === stepKey);
}
```

- [ ] **Step 5: Run Prisma generate**

Run: `npm run prisma:generate`

Expected: Prisma client generation succeeds and TypeScript can import the expanded `ProjectStatus`.

- [ ] **Step 6: Run mapping test to verify it passes**

Run: `npm test -- tests/unit/project-flow.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/projects/flow.ts src/lib/projects/labels.ts tests/unit/project-flow.test.ts
git commit -m "feat: add guided project flow mapping"
```

---

### Task 2: Domain Schemas And Repository Workflow Helpers

**Files:**
- Modify: `src/lib/domain/schemas.ts`
- Modify: `src/lib/projects/labels.ts`
- Modify: `src/lib/repositories/project-repository.ts`
- Modify: `tests/unit/domain-schemas.test.ts`
- Modify: `tests/unit/project-repository.test.ts`

- [ ] **Step 1: Write schema and repository tests**

Add these cases to `tests/unit/domain-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  agentInterviewResponseSchema,
  generationStatusSchema,
  preferenceProfileSchema,
  styleSchema
} from "@/lib/domain/schemas";

describe("domain schemas", () => {
  it("accepts the UI style set", () => {
    expect(styleSchema.options).toEqual(["warm_wood", "vintage", "modern_minimal", "bright", "wabi_sabi"]);
  });

  it("parses designer prompt interview responses", () => {
    expect(
      agentInterviewResponseSchema.parse({
        type: "designer_prompt",
        message: "我建议把次卧做成多功能书房，你们对这个空间有什么需求吗？",
        options: ["书房", "客房", "儿童活动区"],
        progress: { current: 1, max: 12 }
      }).type
    ).toBe("designer_prompt");
  });

  it("parses generation task status", () => {
    expect(
      generationStatusSchema.parse({
        tasks: [
          { key: "requirement_profile", label: "整理需求画像", status: "done" },
          { key: "plan", label: "生成整体设计策略", status: "running" },
          { key: "spaces", label: "生成重点空间方案", status: "waiting" },
          { key: "renderings", label: "生成效果图", status: "waiting" },
          { key: "brief", label: "生成 PDF brief", status: "waiting" }
        ]
      }).tasks
    ).toHaveLength(5);
  });

  it("parses preference profiles with bright style", () => {
    const profile = preferenceProfileSchema.parse({
      style: "bright",
      budgetTier: "quality",
      naturalLanguagePreference: "希望明亮通透，适合一家三口。",
      lifestyleNotes: [],
      hardConstraints: [],
      adoptedSuggestions: [],
      rejectedSuggestions: []
    });

    expect(profile.style).toBe("bright");
  });
});
```

Add these cases to `tests/unit/project-repository.test.ts`:

```ts
it("confirms floor plan analysis and stores user corrections", async () => {
  const prisma = {
    floorPlanAnalysis: {
      update: vi.fn().mockResolvedValue({ id: "a1", confirmed: true })
    },
    project: {
      update: vi.fn().mockResolvedValue({ id: "p1", status: "ANALYSIS_CONFIRMED" })
    }
  };

  const repo = createProjectRepository(prisma as never);
  await repo.confirmFloorPlanAnalysis("p1", ["次卧需要作为书房"]);

  expect(prisma.floorPlanAnalysis.update).toHaveBeenCalledWith({
    where: { projectId: "p1" },
    data: {
      confirmed: true,
      analysisJson: {
        userCorrections: ["次卧需要作为书房"]
      }
    }
  });
  expect(prisma.project.update).toHaveBeenCalledWith({
    where: { id: "p1" },
    data: { status: "ANALYSIS_CONFIRMED" }
  });
});

it("updates project status directly", async () => {
  const prisma = {
    project: {
      update: vi.fn().mockResolvedValue({ id: "p1", status: "INTERVIEWING" })
    }
  };

  const repo = createProjectRepository(prisma as never);
  await repo.updateProjectStatus("p1", "INTERVIEWING");

  expect(prisma.project.update).toHaveBeenCalledWith({
    where: { id: "p1" },
    data: { status: "INTERVIEWING" }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/domain-schemas.test.ts tests/unit/project-repository.test.ts`

Expected: FAIL because the new schemas and repository helpers do not exist.

- [ ] **Step 3: Update domain schemas**

In `src/lib/domain/schemas.ts`, replace the style enum and add the new response schemas:

```ts
export const styleSchema = z.enum(["warm_wood", "vintage", "modern_minimal", "bright", "wabi_sabi"]);
```

Add below `agentQuestionSchema`:

```ts
export const interviewProgressSchema = z.object({
  current: z.number().int().min(0).max(12),
  max: z.literal(12)
});

export const agentInterviewResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("designer_prompt"),
    message: z.string().min(1),
    options: z.array(z.string().min(1)).max(4).optional(),
    recommendation: z.string().min(1).optional(),
    progress: interviewProgressSchema
  }),
  z.object({
    type: z.literal("suggestion"),
    message: z.string().min(1),
    options: z.array(z.string().min(1)).min(1).max(4),
    progress: interviewProgressSchema
  }),
  z.object({
    type: z.literal("complete"),
    summary: z.string().min(1),
    nextPath: z.string().min(1)
  })
]);

export const generationTaskSchema = z.object({
  key: z.enum(["requirement_profile", "plan", "spaces", "renderings", "brief"]),
  label: z.string().min(1),
  status: z.enum(["waiting", "running", "done", "failed"]),
  error: z.string().optional()
});

export const generationStatusSchema = z.object({
  tasks: z.array(generationTaskSchema).length(5)
});
```

Add exports at the bottom:

```ts
export type AgentInterviewResponse = z.infer<typeof agentInterviewResponseSchema>;
export type GenerationStatus = z.infer<typeof generationStatusSchema>;
```

- [ ] **Step 4: Update style labels for the new UI style set**

In `src/lib/projects/labels.ts`, replace `styleLabels` with:

```ts
export const styleLabels: Record<Style, string> = {
  warm_wood: "原木风",
  vintage: "中古风",
  modern_minimal: "现代简约",
  bright: "明亮通透",
  wabi_sabi: "侘寂风"
};
```

- [ ] **Step 5: Update repository helpers**

In `src/lib/repositories/project-repository.ts`, import `ProjectStatus`:

```ts
import type { Prisma, PrismaClient, ProjectStatus } from "@prisma/client";
```

Add these methods inside the returned object:

```ts
updateProjectStatus(projectId: string, status: ProjectStatus) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status }
  });
},

confirmFloorPlanAnalysis(projectId: string, userCorrections: string[]) {
  return prisma.$transaction([
    prisma.floorPlanAnalysis.update({
      where: { projectId },
      data: {
        confirmed: true,
        analysisJson: {
          userCorrections
        }
      }
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { status: "ANALYSIS_CONFIRMED" }
    })
  ]);
}
```

Also add `"$transaction"` to `PrismaLike`:

```ts
type PrismaLike = Pick<
  PrismaClient,
  | "$transaction"
  | "project"
  | "floorPlanAnalysis"
  | "preferenceProfile"
  | "agentConversation"
  | "designPlan"
  | "renderingAsset"
  | "briefExport"
>;
```

- [ ] **Step 6: Adjust repository test mock for transaction**

In the `confirmFloorPlanAnalysis` test, add `$transaction` to the mock:

```ts
$transaction: vi.fn(async (operations: unknown[]) => operations)
```

Expected assertion:

```ts
expect(prisma.$transaction).toHaveBeenCalledTimes(1);
```

- [ ] **Step 7: Run tests**

Run: `npm test -- tests/unit/domain-schemas.test.ts tests/unit/project-repository.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/domain/schemas.ts src/lib/projects/labels.ts src/lib/repositories/project-repository.ts tests/unit/domain-schemas.test.ts tests/unit/project-repository.test.ts
git commit -m "feat: add guided workflow domain helpers"
```

---

### Task 3: API Workflow Updates

**Files:**
- Modify: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[projectId]/analysis/route.ts`
- Modify: `src/app/api/projects/[projectId]/floor-plan/route.ts`
- Modify: `src/app/api/projects/[projectId]/preferences/route.ts`
- Modify: `src/app/api/projects/[projectId]/agent/respond/route.ts`
- Create: `src/app/api/projects/[projectId]/generate/route.ts`
- Test: add focused unit coverage through repository and workflow tests from Tasks 2 and 4.

- [ ] **Step 1: Update project creation redirect**

In `src/app/api/projects/route.ts`, change the redirect:

```ts
redirect(`/projects/${project.id}/upload`);
```

- [ ] **Step 2: Update floor-plan status transitions**

In `src/app/api/projects/[projectId]/floor-plan/route.ts`, before AI analysis, set status:

```ts
await repo.updateProjectStatus(projectId, "FLOOR_PLAN_ANALYZING");
```

After `repo.saveFloorPlanAnalysis(projectId, analysis, false)`, return:

```ts
return NextResponse.json({
  imageUrl: stored.url,
  analysis,
  nextPath: `/projects/${projectId}/analysis`
});
```

- [ ] **Step 3: Add analysis confirmation route**

Create `src/app/api/projects/[projectId]/analysis/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

const requestSchema = z.object({
  userCorrections: z.array(z.string().min(1)).default([])
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const body = requestSchema.parse(await request.json());

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true }
  });

  if (!project?.analysis) {
    return NextResponse.json({ error: "请先完成户型分析。" }, { status: 400 });
  }

  await createProjectRepository(prisma).confirmFloorPlanAnalysis(projectId, body.userCorrections);

  return NextResponse.json({
    confirmed: true,
    nextPath: `/projects/${projectId}/preferences`
  });
}
```

- [ ] **Step 4: Update preferences route**

In `src/app/api/projects/[projectId]/preferences/route.ts`, replace the status update:

```ts
await prisma.project.update({ where: { id: projectId }, data: { status: "INTERVIEWING" } });

return NextResponse.json({
  profile,
  nextPath: `/projects/${projectId}/interview`
});
```

- [ ] **Step 5: Update agent respond route contract**

In `src/app/api/projects/[projectId]/agent/respond/route.ts`, parse:

```ts
const bodySchema = z.object({
  action: z.enum(["start", "answer"]),
  answer: z.string().default("")
});
```

The route behavior:

```ts
if (body.action === "answer" && body.answer.trim().length > 0) {
  await repo.addConversationMessage(projectId, "user", body.answer.trim());
}

const result = await runNextAgentStep({
  provider,
  analysis,
  profile,
  conversation: project.conversations.map((message) => ({
    role: message.role === "agent" ? "agent" : "user",
    content: message.content
  }))
});

if (result.type === "complete") {
  await repo.addConversationMessage(projectId, "agent", result.summary, result);
  await repo.updateProjectStatus(projectId, "INTERVIEW_COMPLETE");
  return NextResponse.json(result);
}

await repo.addConversationMessage(projectId, "agent", result.message, result);
return NextResponse.json(result);
```

- [ ] **Step 6: Add generation orchestration route**

Create `src/app/api/projects/[projectId]/generate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { prisma } from "@/lib/db";
import { designPlanSchema, floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true,
      conversations: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!project?.analysis || !project.preference) {
    return NextResponse.json({ error: "请先完成户型分析、偏好设置和设计师咨询。" }, { status: 400 });
  }

  const repo = createProjectRepository(prisma);
  const provider = createAiProvider();
  const analysis = floorPlanAnalysisSchema.parse(project.analysis.analysisJson);
  const profile = preferenceProfileSchema.parse(project.preference.profileJson);
  const conversationSummary = project.conversations.map((message) => `${message.role}: ${message.content}`).join("\n");

  await repo.updateProjectStatus(projectId, "GENERATING_PLAN");
  const plan = await provider.generateDesignPlan({ analysis, profile, conversationSummary });
  await repo.saveDesignPlan(projectId, plan);
  await repo.updateProjectStatus(projectId, "PLAN_READY");

  await repo.updateProjectStatus(projectId, "GENERATING_RENDERINGS");
  const parsedPlan = designPlanSchema.parse(plan);
  const renderings = await Promise.all(
    parsedPlan.keySpaces.map(async (space) => {
      const created = await prisma.renderingAsset.create({
        data: {
          projectId,
          spaceType: space.spaceType,
          prompt: space.renderingPrompt,
          status: "RUNNING"
        }
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
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "效果图生成失败"
          }
        });
      }
    })
  );
  await repo.updateProjectStatus(projectId, "RENDERINGS_READY");

  await repo.updateProjectStatus(projectId, "GENERATING_BRIEF");
  const brief = await prisma.briefExport.create({
    data: {
      projectId,
      status: "READY",
      version: 1
    }
  });
  await repo.updateProjectStatus(projectId, "BRIEF_READY");

  return NextResponse.json({
    plan,
    renderings,
    brief,
    nextPath: `/projects/${projectId}/complete`
  });
}
```

- [ ] **Step 7: Run typecheck and unit tests**

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/projects/[projectId]/analysis/route.ts src/app/api/projects/[projectId]/floor-plan/route.ts src/app/api/projects/[projectId]/preferences/route.ts src/app/api/projects/[projectId]/agent/respond/route.ts src/app/api/projects/[projectId]/generate/route.ts
git commit -m "feat: add guided project api flow"
```

---

### Task 4: Designer Interview Contract

**Files:**
- Modify: `src/lib/ai/ai-provider.ts`
- Modify: `src/lib/agent/workflow.ts`
- Modify: `src/lib/ai/mock-ai-provider.ts`
- Modify: `src/lib/ai/doubao-provider.ts`
- Modify: `tests/unit/agent-workflow.test.ts`

- [ ] **Step 1: Replace agent workflow tests**

Update `tests/unit/agent-workflow.test.ts` to expect the new contract:

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
  style: "modern_minimal" as const,
  budgetTier: "quality" as const,
  naturalLanguagePreference: "显大，好打理",
  lifestyleNotes: [],
  hardConstraints: [],
  adoptedSuggestions: [],
  rejectedSuggestions: []
};

describe("designer agent workflow", () => {
  it("returns a designer opening prompt when conversation is empty", async () => {
    const provider = {
      nextAgentTurn: vi.fn().mockResolvedValue({
        type: "designer_prompt",
        message: "我看客餐厅连接阳台，可以优先考虑显大和采光。你们最在意哪个生活场景？",
        options: ["孩子活动区", "朋友聚餐", "投影观影"],
        progress: { current: 1, max: 12 }
      })
    } as unknown as AiProvider;

    const result = await runNextAgentStep({ provider, analysis, profile, conversation: [] });

    expect(result.type).toBe("designer_prompt");
    expect(provider.nextAgentTurn).toHaveBeenCalledTimes(1);
  });

  it("completes after 12 designer turns", async () => {
    const provider = {
      nextAgentTurn: vi.fn()
    } as unknown as AiProvider;

    const conversation = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? ("agent" as const) : ("user" as const),
      content: `message ${index}`
    }));

    const result = await runNextAgentStep({ provider, analysis, profile, conversation });

    expect(result).toEqual({
      type: "complete",
      summary: "已收集足够信息，将按当前需求生成装修设计方案。",
      nextPath: "/generating"
    });
    expect(provider.nextAgentTurn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run workflow test to verify it fails**

Run: `npm test -- tests/unit/agent-workflow.test.ts`

Expected: FAIL because `AgentTurnOutput` still uses the old `question`/`ready` union.

- [ ] **Step 3: Update AI provider contract**

In `src/lib/ai/ai-provider.ts`, import `AgentInterviewResponse`:

```ts
import type { AgentInterviewResponse, DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";
```

Replace `AgentTurnOutput`:

```ts
export type AgentTurnOutput = AgentInterviewResponse;
```

- [ ] **Step 4: Update workflow completion**

In `src/lib/agent/workflow.ts`, replace the max-turn branch:

```ts
if (countAgentQuestions(input.conversation) >= 12) {
  return {
    type: "complete",
    summary: "已收集足够信息，将按当前需求生成装修设计方案。",
    nextPath: "/generating"
  };
}
```

- [ ] **Step 5: Update mock provider**

In `src/lib/ai/mock-ai-provider.ts`, make `nextAgentTurn` return:

```ts
return {
  type: "designer_prompt",
  message:
    input.conversation.length === 0
      ? "我看这个户型的客餐厅连接阳台，可以优先考虑显大和采光。你们最在意哪个生活场景？"
      : "明白。我会把这个需求纳入方案里。还有没有需要兼顾的收纳、办公或儿童活动需求？",
  options: input.conversation.length === 0 ? ["孩子活动区", "朋友聚餐", "投影观影"] : ["需要收纳", "需要办公", "没有了"],
  progress: {
    current: Math.min(Math.floor(input.conversation.length / 2) + 1, 12),
    max: 12
  }
};
```

- [ ] **Step 6: Update Doubao provider normalization**

In `src/lib/ai/doubao-provider.ts`, normalize live model output through `agentInterviewResponseSchema.safeParse`. If parsing fails, return a safe designer prompt:

```ts
return {
  type: "designer_prompt",
  message: "我已经看过户型和偏好。你们最希望优先改善哪个空间，客餐厅、主卧，还是次卧/书房？",
  options: ["客餐厅", "主卧", "次卧/书房"],
  progress: { current: 1, max: 12 }
};
```

- [ ] **Step 7: Run workflow tests and typecheck**

Run: `npm test -- tests/unit/agent-workflow.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/ai-provider.ts src/lib/agent/workflow.ts src/lib/ai/mock-ai-provider.ts src/lib/ai/doubao-provider.ts tests/unit/agent-workflow.test.ts
git commit -m "feat: add designer interview workflow"
```

---

### Task 5: Shared UI Components And Theme

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/primitives.tsx`
- Create: `src/components/wizard-shell.tsx`
- Create: `src/components/analysis-summary.tsx`
- Create: `src/components/style-budget-cards.tsx`
- Create: `src/components/interview-panel.tsx`
- Create: `src/components/generation-status.tsx`
- Create: `src/components/brief-report.tsx`

- [ ] **Step 1: Add theme tokens**

Replace `:root` in `src/app/globals.css` with:

```css
:root {
  color-scheme: light;
  --background: #f6f8fc;
  --foreground: #101828;
  --muted: #667085;
  --panel: #ffffff;
  --line: #e4e7ec;
  --soft: #f2f6ff;
  --accent: #2563ff;
  --accent-strong: #174ee5;
  --success: #12b76a;
  --warning: #f79009;
  --danger: #d92d20;
}
```

Add:

```css
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

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}
```

- [ ] **Step 2: Create primitives**

Create `src/components/ui/primitives.tsx`:

```tsx
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:opacity-60",
        props.className ?? ""
      ].join(" ")}
    />
  );
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[#f8fafc] disabled:opacity-60",
        props.className ?? ""
      ].join(" ")}
    />
  );
}

export function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-lg border border-[var(--line)] bg-white shadow-sm ${className}`}>{children}</section>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100",
        props.className ?? ""
      ].join(" ")}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100",
        props.className ?? ""
      ].join(" ")}
    />
  );
}
```

- [ ] **Step 3: Create wizard shell**

Create `src/components/wizard-shell.tsx`:

```tsx
import { Check } from "lucide-react";
import { getStepIndex, wizardSteps, type WizardStepKey } from "@/lib/projects/flow";

export function StepProgress({ currentStep }: { currentStep: WizardStepKey }) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <nav className="mx-auto grid max-w-4xl grid-cols-6 gap-2" aria-label="项目进度">
      {wizardSteps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step.key} className="grid gap-2 text-center">
            <div className="flex items-center justify-center">
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                  isDone || isCurrent ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[#cfd5e1] bg-white text-[var(--muted)]"
                ].join(" ")}
              >
                {isDone ? <Check size={14} /> : index + 1}
              </span>
            </div>
            <span className={isCurrent ? "text-xs font-semibold text-[var(--accent)]" : "text-xs text-[var(--muted)]"}>
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

export function WizardShell({
  currentStep,
  children,
  footer
}: {
  currentStep: WizardStepKey;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8">
      <StepProgress currentStep={currentStep} />
      <div className="mx-auto mt-8 max-w-6xl">{children}</div>
      {footer ? <div className="mx-auto mt-5 max-w-4xl text-center text-xs text-[var(--muted)]">{footer}</div> : null}
    </main>
  );
}
```

- [ ] **Step 4: Create content components**

Create the remaining components with focused props:

`src/components/analysis-summary.tsx`:

```tsx
import type { FloorPlanAnalysis } from "@/lib/domain/schemas";
import { roomLabels } from "@/lib/projects/labels";

export function AnalysisSummary({ analysis }: { analysis: FloorPlanAnalysis }) {
  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold">分析摘要</h2>
      <SummaryCard title="空间组成" text={analysis.rooms.map((room) => room.name || roomLabels[room.type]).join("、") || "暂未识别到明确房间"} />
      <SummaryCard title="空间关系" text={analysis.relationships.join("；") || "暂未识别到明确空间关系"} />
      <SummaryCard title="建议事项" text={analysis.issues.map((issue) => issue.description).join("；") || "暂无明显风险"} />
      <SummaryCard title="需要确认" text={analysis.uncertainItems.join("；") || "暂无需要确认的信息"} />
    </div>
  );
}

function SummaryCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[#fbfcff] p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </div>
  );
}
```

`src/components/style-budget-cards.tsx` exports `StyleCardGrid` and `BudgetCardGrid` using `styleLabels` and `budgetLabels`.

`src/components/interview-panel.tsx` exports `InterviewPanel` with `messages`, `summary`, `onSubmit`, and `busy` props.

`src/components/generation-status.tsx` exports `GenerationStatusPanel` with five fixed task rows.

`src/components/brief-report.tsx` exports `BriefReport` that renders `analysis`, `profile`, `plan`, `renderings`, and never calls `JSON.stringify`.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/ui/primitives.tsx src/components/wizard-shell.tsx src/components/analysis-summary.tsx src/components/style-budget-cards.tsx src/components/interview-panel.tsx src/components/generation-status.tsx src/components/brief-report.tsx
git commit -m "feat: add guided redesign ui components"
```

---

### Task 6: Route Pages

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/projects/[projectId]/page.tsx`
- Create: all step route pages listed in File Structure.
- Delete or stop using: `src/components/project-workspace.tsx`

- [ ] **Step 1: Update project index redirect**

Replace `src/app/projects/[projectId]/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getProjectRoute } from "@/lib/projects/flow";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  redirect(getProjectRoute(project.id, project.status));
}
```

- [ ] **Step 2: Implement dark create-project page**

Replace `src/app/page.tsx` with the dark hero matching UI 1. Keep the form action `/api/projects`, use project name input `name`, and primary button text `开始创建`.

- [ ] **Step 3: Implement upload page**

Create `src/app/projects/[projectId]/upload/page.tsx`. It should:

- Load the project.
- Render `WizardShell currentStep="upload"`.
- Show upload drop zone and upload suggestions.
- Use a client component or plain form with `action={`/api/projects/${projectId}/floor-plan`}`.
- After a successful client fetch, route to `/projects/${projectId}/analysis/loading`.

- [ ] **Step 4: Implement analysis loading page**

Create `src/app/projects/[projectId]/analysis/loading/page.tsx`. It should render UI 3. If project status is already `FLOOR_PLAN_ANALYZED`, redirect to `/analysis`; if status is earlier, redirect to `/upload`.

- [ ] **Step 5: Implement analysis confirmation page**

Create `src/app/projects/[projectId]/analysis/page.tsx`. It should:

- Load `project.analysis`.
- Parse with `floorPlanAnalysisSchema`.
- Render uploaded floor plan on the left.
- Render `AnalysisSummary` on the right.
- Submit `userCorrections` to `/api/projects/[projectId]/analysis`.
- Redirect to `/preferences` on success.

- [ ] **Step 6: Implement preferences page**

Create `src/app/projects/[projectId]/preferences/page.tsx`. It should:

- Render `StyleCardGrid`.
- Render `BudgetCardGrid`.
- Render text area with 300-character counter.
- POST to `/api/projects/[projectId]/preferences`.
- Redirect to `/interview`.

- [ ] **Step 7: Implement interview page**

Create `src/app/projects/[projectId]/interview/page.tsx` plus `src/components/interview-step-client.tsx`. The client component should:

- Call `/api/projects/[projectId]/agent/respond` with `{ action: "start" }` on first mount when there is no agent conversation.
- Render designer messages and user replies.
- POST `{ action: "answer", answer }` on submit.
- Redirect to `/generating` when response type is `complete`.

- [ ] **Step 8: Implement generating page**

Create `src/app/projects/[projectId]/generating/page.tsx` plus `src/components/generation-step-client.tsx`. The client component should:

- POST once to `/api/projects/[projectId]/generate`.
- Render task list states while waiting.
- Redirect to `/complete` on success.
- Show retry button on failure.

- [ ] **Step 9: Implement complete page**

Create `src/app/projects/[projectId]/complete/page.tsx`. It should:

- Load plan, renderings, and brief export.
- Render UI 8 completion message.
- Link to `/brief`.
- Offer PDF download by POSTing `/brief` or linking a future file URL when available.

- [ ] **Step 10: Implement final brief page**

Create `src/app/projects/[projectId]/brief/page.tsx`. It should:

- Load project with analysis, preference, designPlan, renderings, briefExports.
- Parse the JSON fields.
- Render `BriefReport`.
- Include left navigation labels from UI 9.
- Include no `pre` tag and no `JSON.stringify`.

- [ ] **Step 11: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/app/page.tsx src/app/projects/[projectId]/page.tsx src/app/projects/[projectId]/upload/page.tsx src/app/projects/[projectId]/analysis/loading/page.tsx src/app/projects/[projectId]/analysis/page.tsx src/app/projects/[projectId]/preferences/page.tsx src/app/projects/[projectId]/interview/page.tsx src/app/projects/[projectId]/generating/page.tsx src/app/projects/[projectId]/complete/page.tsx src/app/projects/[projectId]/brief/page.tsx src/components/interview-step-client.tsx src/components/generation-step-client.tsx
git commit -m "feat: add staged renovation wizard pages"
```

---

### Task 7: E2E Coverage And Visual QA

**Files:**
- Replace: `tests/e2e/mvp-flow.spec.ts`

- [ ] **Step 1: Replace E2E test with staged flow assertions**

Replace `tests/e2e/mvp-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("homeowner moves through guided renovation wizard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /AI 设计师/ })).toBeVisible();
  await page.getByLabel("项目名称").fill("温暖的小家");
  await page.getByRole("button", { name: "开始创建" }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/upload/);
  await expect(page.getByText("上传户型图")).toBeVisible();
  await expect(page.getByText("上传建议")).toBeVisible();

  await page.setInputFiles('input[type="file"]', "ui/ui.png");
  await expect(page).toHaveURL(/\/analysis/);

  await expect(page.getByText("分析摘要")).toBeVisible();
  await page.getByPlaceholder(/补充或修改/).fill("次卧希望作为多功能书房。");
  await page.getByRole("button", { name: /确认并继续/ }).click();

  await expect(page).toHaveURL(/\/preferences/);
  await page.getByText("现代简约").click();
  await page.getByText("品质型").click();
  await page.getByPlaceholder(/生活习惯/).fill("希望明亮通透，显大，好打理。");
  await page.getByRole("button", { name: /保存并继续/ }).click();

  await expect(page).toHaveURL(/\/interview/);
  await expect(page.getByText(/我看|我建议|你们/)).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test**

Run: `npm run test:e2e -- tests/e2e/mvp-flow.spec.ts`

Expected: PASS with the mock provider. If the database is required locally, run with the same `DATABASE_URL` used for existing project E2E flows.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npm run test:e2e -- tests/e2e/mvp-flow.spec.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/mvp-flow.spec.ts
git commit -m "test: cover guided renovation wizard flow"
```

---

## Self-Review

**Spec coverage:** This plan covers all 9 UI screens from `ui/ui.png`, the 6-step top progress, automatic routing, automatic designer opening prompt, automatic generation, completion transition, final report page, and the no-JSON final output rule.

**Placeholder scan:** The plan contains exact target files, exact route paths, exact commands, concrete tests, and concrete code snippets for the key workflow helpers, schemas, API contracts, and route behavior.

**Type consistency:** The plan uses one interview response type, `AgentInterviewResponse`, one status mapping helper, `getProjectRoute`, and the same ProjectStatus names across Prisma, helpers, APIs, and tests.
