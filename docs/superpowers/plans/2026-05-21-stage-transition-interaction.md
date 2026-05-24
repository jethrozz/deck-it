# 阶段切换交互优化实施计划

> **给执行型 agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项执行。本计划使用 `- [ ]` 复选框格式跟踪进度。

**目标：** 为项目的自动阶段切换补上统一的过渡承接层，为普通流转提供动画提示，并在“设计师追问 -> 方案生成中”之间加入确认提示。

**架构：** 保持后端状态机和现有 API 返回结构不变，只在前端新增一层“阶段过渡上下文 + 过渡承接页”。原先多个直接 `window.location.assign(...)` 的自动跳转点，统一改为先写入一次性过渡信息，再进入 `/projects/[projectId]/transition`，由该页面决定自动前进还是先弹确认。

**技术栈：** Next.js App Router、React Client Components、TypeScript、Vitest、Playwright、项目现有 UI primitives

---

## 文件结构

- 修改：`src/lib/projects/flow.ts`
  增加阶段过渡元数据，定义哪些阶段切换是 `auto`，哪些是 `confirm`。
- 新建：`src/lib/projects/transition.ts`
  负责一次性过渡上下文、`sessionStorage` 读写、过渡页路由路径，以及统一的阶段跳转入口。
- 新建：`src/components/project-transition-screen.tsx`
  渲染全屏过渡提示与“设计师追问完成后”的确认弹窗。
- 新建：`src/app/projects/[projectId]/transition/page.tsx`
  挂载过渡屏组件，并与项目现有 `WizardShell` 样式保持一致。
- 修改：`src/components/project-steps.tsx`
  把分析确认、风格预算提交等自动阶段推进改成走统一过渡入口。
- 修改：`src/components/interview-panel.tsx`
  把追问完成后的直接跳转改成 `confirm` 模式的阶段过渡。
- 修改：`src/components/generation-status.tsx`
  把“方案生成完成 -> 结果页”的直接跳转改成 `auto` 模式过渡。
- 新建：`tests/unit/project-transition.test.ts`
  覆盖阶段过渡模式映射、过渡上下文生成、一次性消费和无效上下文回退。
- 修改：`tests/unit/project-flow.test.ts`
  增加阶段元数据与可见步骤的一致性验证。
- 修改：`tests/e2e/mvp-flow.spec.ts`
  覆盖新过渡页、确认弹窗和关键链路行为。

### 任务 1：补齐阶段过渡元数据与过渡辅助方法

**文件：**
- 修改：`src/lib/projects/flow.ts`
- 新建：`src/lib/projects/transition.ts`
- 新建：`tests/unit/project-transition.test.ts`
- 修改：`tests/unit/project-flow.test.ts`

- [ ] **步骤 1：先写失败的单元测试，约束阶段过渡规则**

```ts
import { describe, expect, it } from "vitest";
import {
  getProjectRoute,
  getTransitionConfig,
  isAutoStageTransition,
  wizardSteps
} from "@/lib/projects/flow";

describe("project transition metadata", () => {
  it("marks interview to generating as confirm", () => {
    expect(getTransitionConfig("interview", "generating")).toEqual({
      mode: "confirm",
      title: "追问已完成",
      description: "设计师已完成本轮需求整理，确认后开始生成方案。",
      ctaLabel: "开始生成方案",
      cancelLabel: "再检查一下"
    });
  });

  it("marks preferences to interview as auto", () => {
    expect(getTransitionConfig("preferences", "interview")?.mode).toBe("auto");
    expect(isAutoStageTransition("preferences", "interview")).toBe(true);
  });

  it("returns null for unsupported transitions", () => {
    expect(getTransitionConfig("upload", "complete")).toBeNull();
  });

  it("keeps transition keys aligned with visible wizard steps", () => {
    expect(wizardSteps.map((step) => step.key)).toContain("interview");
    expect(getProjectRoute("p1", "INTERVIEW_COMPLETE")).toBe("/projects/p1/generating");
  });
});
```

- [ ] **步骤 2：运行测试，确认它先失败**

运行：

```bash
npm test -- --run tests/unit/project-flow.test.ts tests/unit/project-transition.test.ts
```

预期输出：

```text
FAIL  tests/unit/project-transition.test.ts
Error: Cannot find module '@/lib/projects/transition'
```

- [ ] **步骤 3：在 `flow.ts` 中补齐过渡规则，并创建过渡 helper 文件**

```ts
// src/lib/projects/flow.ts
export type TransitionMode = "auto" | "confirm";

export type StageTransitionConfig = {
  mode: TransitionMode;
  title: string;
  description: string;
  nextLabel: string;
  ctaLabel?: string;
  cancelLabel?: string;
};

const stageTransitions: Partial<Record<`${WizardStepKey}->${WizardStepKey}`, StageTransitionConfig>> = {
  "analysis->preferences": {
    mode: "auto",
    title: "户型分析完成",
    description: "正在进入风格与预算。",
    nextLabel: "风格与预算"
  },
  "preferences->interview": {
    mode: "auto",
    title: "偏好已记录",
    description: "正在进入设计师追问。",
    nextLabel: "设计师追问"
  },
  "interview->generating": {
    mode: "confirm",
    title: "追问已完成",
    description: "设计师已完成本轮需求整理，确认后开始生成方案。",
    nextLabel: "方案生成中",
    ctaLabel: "开始生成方案",
    cancelLabel: "再检查一下"
  },
  "generating->complete": {
    mode: "auto",
    title: "方案生成完成",
    description: "正在进入方案结果。",
    nextLabel: "方案完成"
  }
};

export function getTransitionConfig(from: WizardStepKey, to: WizardStepKey) {
  return stageTransitions[`${from}->${to}`] ?? null;
}

export function isAutoStageTransition(from: WizardStepKey, to: WizardStepKey) {
  return getTransitionConfig(from, to)?.mode === "auto";
}
```

```ts
// src/lib/projects/transition.ts
import { getTransitionConfig, type WizardStepKey } from "@/lib/projects/flow";

export const TRANSITION_STORAGE_KEY = "deck-it:stage-transition";

export type ProjectStageTransition = {
  projectId: string;
  from: WizardStepKey;
  to: WizardStepKey;
  nextPath: string;
  mode: "auto" | "confirm";
  title: string;
  description: string;
  nextLabel: string;
  ctaLabel?: string;
  cancelLabel?: string;
  nonce: string;
};

export function buildStageTransition(input: {
  projectId: string;
  from: WizardStepKey;
  to: WizardStepKey;
  nextPath: string;
}): ProjectStageTransition | null {
  const config = getTransitionConfig(input.from, input.to);
  if (!config) return null;
  return {
    ...input,
    ...config,
    nonce: `${input.projectId}:${input.from}:${input.to}:${Date.now()}`
  };
}
```

- [ ] **步骤 4：补上存储、消费和回退逻辑，让测试通过**

```ts
// src/lib/projects/transition.ts
export function persistStageTransition(transition: ProjectStageTransition) {
  window.sessionStorage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify(transition));
}

export function consumeStageTransition(projectId: string) {
  const raw = window.sessionStorage.getItem(TRANSITION_STORAGE_KEY);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as ProjectStageTransition;
  if (parsed.projectId !== projectId) return null;

  window.sessionStorage.removeItem(TRANSITION_STORAGE_KEY);
  return parsed;
}

export function getTransitionRoute(projectId: string) {
  return `/projects/${projectId}/transition`;
}

export function beginStageTransition(input: {
  projectId: string;
  from: WizardStepKey;
  to: WizardStepKey;
  nextPath: string;
}) {
  const transition = buildStageTransition(input);
  if (!transition) {
    window.location.assign(input.nextPath);
    return;
  }

  persistStageTransition(transition);
  window.location.assign(getTransitionRoute(input.projectId));
}
```

运行：

```bash
npm test -- --run tests/unit/project-flow.test.ts tests/unit/project-transition.test.ts
```

预期输出：

```text
PASS  tests/unit/project-flow.test.ts
PASS  tests/unit/project-transition.test.ts
```

- [ ] **步骤 5：提交这一小段改动**

```bash
git add src/lib/projects/flow.ts src/lib/projects/transition.ts tests/unit/project-flow.test.ts tests/unit/project-transition.test.ts
git commit -m "feat: add project stage transition helpers"
```

### 任务 2：实现过渡承接页和全屏过渡 UI

**文件：**
- 新建：`src/components/project-transition-screen.tsx`
- 新建：`src/app/projects/[projectId]/transition/page.tsx`
- 修改：`src/lib/projects/transition.ts`
- 测试：`tests/unit/project-transition.test.ts`

- [ ] **步骤 1：先写组件层测试，约束确认弹窗行为**

```ts
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectTransitionScreen } from "@/components/project-transition-screen";

describe("ProjectTransitionScreen", () => {
  it("shows confirm actions for interview to generating", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ProjectTransitionScreen
        transition={{
          projectId: "p1",
          from: "interview",
          to: "generating",
          nextPath: "/projects/p1/generating",
          mode: "confirm",
          title: "追问已完成",
          description: "设计师已完成本轮需求整理，确认后开始生成方案。",
          nextLabel: "方案生成中",
          ctaLabel: "开始生成方案",
          cancelLabel: "再检查一下",
          nonce: "nonce"
        }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "开始生成方案" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **步骤 2：运行测试，确认组件还不存在时先失败**

运行：

```bash
npm test -- --run tests/unit/project-transition.test.ts
```

预期输出：

```text
FAIL  tests/unit/project-transition.test.ts
Error: Cannot find module '@/components/project-transition-screen'
```

- [ ] **步骤 3：实现过渡组件，覆盖 `auto` 和 `confirm` 两种模式**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { Button, Surface } from "@/components/ui/primitives";
import type { ProjectStageTransition } from "@/lib/projects/transition";

export function ProjectTransitionScreen({
  transition,
  onConfirm,
  onCancel
}: {
  transition: ProjectStageTransition;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [isForwarding, setIsForwarding] = useState(transition.mode === "auto");

  useEffect(() => {
    if (transition.mode !== "auto" || !isForwarding) return;
    const timer = window.setTimeout(() => onConfirm(), 1400);
    return () => window.clearTimeout(timer);
  }, [isForwarding, onConfirm, transition.mode]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-10">
      <Surface className="w-full max-w-[640px] overflow-hidden rounded-[32px] border border-[#5073ff]/25 bg-[linear-gradient(180deg,rgba(15,23,54,0.96),rgba(9,15,33,0.94))] p-8 text-white shadow-[0_24px_80px_rgba(7,14,32,0.35)]">
        <div className="grid gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(99,140,255,0.32),rgba(99,140,255,0.08)_60%,transparent_62%)] text-[#9db3ff]">
            {isForwarding ? <LoaderCircle size={28} className="animate-spin" /> : <Sparkles size={28} />}
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold">{transition.title}</h1>
            <p className="text-base leading-7 text-white/72">{transition.description}</p>
            <p className="text-sm text-[#9db3ff]">下一阶段：{transition.nextLabel}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,#4e7bff,#75d4ff)] transition-[width] duration-[1400ms]" />
          </div>
          {transition.mode === "confirm" && !isForwarding ? (
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onCancel}>
                {transition.cancelLabel}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsForwarding(true);
                  window.setTimeout(() => onConfirm(), 900);
                }}
              >
                {transition.ctaLabel}
                <ArrowRight size={16} />
              </Button>
            </div>
          ) : null}
        </div>
      </Surface>
    </div>
  );
}
```

- [ ] **步骤 4：增加过渡路由页，并接上一次性上下文消费**

```tsx
// src/app/projects/[projectId]/transition/page.tsx
import { WizardShell } from "@/components/wizard-shell";
import { ProjectTransitionScreen } from "@/components/project-transition-screen";

export default function ProjectTransitionPage() {
  return (
    <WizardShell currentStep="generating" footer="正在为你切换到下一阶段。">
      <ProjectTransitionScreen />
    </WizardShell>
  );
}
```

```tsx
// 在 ProjectTransitionScreen 中补齐真正的消费逻辑
const transition = consumeStageTransition(projectId);
if (!transition) {
  window.location.replace(fallbackPath);
  return null;
}
```

运行：

```bash
npm test -- --run tests/unit/project-transition.test.ts
```

预期输出：

```text
PASS  tests/unit/project-transition.test.ts
```

- [ ] **步骤 5：提交过渡页和 UI 这一段**

```bash
git add src/components/project-transition-screen.tsx src/app/projects/[projectId]/transition/page.tsx src/lib/projects/transition.ts tests/unit/project-transition.test.ts
git commit -m "feat: add project transition route"
```

### 任务 3：把现有自动跳转点全部改成统一入口

**文件：**
- 修改：`src/components/project-steps.tsx`
- 修改：`src/components/interview-panel.tsx`
- 修改：`src/components/generation-status.tsx`
- 修改：`src/lib/projects/transition.ts`
- 测试：`tests/unit/project-transition.test.ts`

- [ ] **步骤 1：先写失败测试，锁定新的跳转行为**

```ts
import { describe, expect, it, vi } from "vitest";
import { beginStageTransition } from "@/lib/projects/transition";

describe("beginStageTransition", () => {
  it("navigates through the transition route for preferences to interview", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { assign },
      sessionStorage: { setItem: vi.fn() }
    });

    beginStageTransition({
      projectId: "p1",
      from: "preferences",
      to: "interview",
      nextPath: "/projects/p1/interview"
    });

    expect(assign).toHaveBeenCalledWith("/projects/p1/transition");
  });
});
```

- [ ] **步骤 2：运行测试，确认旧逻辑下它会失败**

运行：

```bash
npm test -- --run tests/unit/project-transition.test.ts tests/unit/agent-workflow.test.ts
```

预期输出：

```text
FAIL  tests/unit/project-transition.test.ts
AssertionError: expected "assign" to have been called with "/projects/p1/transition"
```

- [ ] **步骤 3：把直跳逻辑替换成 `beginStageTransition(...)`**

```ts
// src/components/project-steps.tsx
import { beginStageTransition } from "@/lib/projects/transition";

beginStageTransition({
  projectId,
  from: "analysis",
  to: "preferences",
  nextPath: result.nextPath
});

beginStageTransition({
  projectId,
  from: "preferences",
  to: "interview",
  nextPath: result.nextPath
});
```

```ts
// src/components/interview-panel.tsx
beginStageTransition({
  projectId,
  from: "interview",
  to: "generating",
  nextPath: getProjectNavigationPath(projectId, payload.nextPath)
});
```

```ts
// src/components/generation-status.tsx
beginStageTransition({
  projectId,
  from: "generating",
  to: "complete",
  nextPath: getProjectNavigationPath(projectId, payload.nextPath)
});
```

- [ ] **步骤 4：补上重复跳转和直达目标页时的防护**

```ts
// src/lib/projects/transition.ts
export function beginStageTransition(input: {
  projectId: string;
  from: WizardStepKey;
  to: WizardStepKey;
  nextPath: string;
}) {
  if (window.location.pathname === input.nextPath) return;

  const transition = buildStageTransition(input);
  if (!transition) {
    window.location.assign(input.nextPath);
    return;
  }

  persistStageTransition(transition);
  window.location.assign(getTransitionRoute(input.projectId));
}
```

运行：

```bash
npm test -- --run tests/unit/project-transition.test.ts tests/unit/project-flow.test.ts tests/unit/agent-workflow.test.ts
```

预期输出：

```text
PASS  tests/unit/project-transition.test.ts
PASS  tests/unit/project-flow.test.ts
PASS  tests/unit/agent-workflow.test.ts
```

- [ ] **步骤 5：提交跳转改造这一段**

```bash
git add src/components/project-steps.tsx src/components/interview-panel.tsx src/components/generation-status.tsx src/lib/projects/transition.ts tests/unit/project-transition.test.ts
git commit -m "feat: route stage changes through transition screen"
```

### 任务 4：补 E2E 流程验证并打磨边界体验

**文件：**
- 修改：`tests/e2e/mvp-flow.spec.ts`
- 修改：`src/components/project-transition-screen.tsx`
- 修改：`src/app/projects/[projectId]/transition/page.tsx`
- 测试：`tests/unit/project-transition.test.ts`

- [ ] **步骤 1：先改 E2E 断言，要求流程经过过渡页**

```ts
await page.getByRole("button", { name: /保存并继续/ }).click();

await expect(page).toHaveURL(/\/projects\/.+\/transition$/);
await expect(page.getByText("偏好已记录")).toBeVisible();
await expect(page.getByText("下一阶段：设计师追问")).toBeVisible();
await expect(page).toHaveURL(/\/projects\/.+\/interview$/, { timeout: 5000 });

// 后续在同一测试里继续断言 interview -> generating
await expect(page).toHaveURL(/\/projects\/.+\/transition$/);
await expect(page.getByRole("button", { name: "开始生成方案" })).toBeVisible();
await page.getByRole("button", { name: "开始生成方案" }).click();
await expect(page).toHaveURL(/\/projects\/.+\/generating$/, { timeout: 5000 });
```

- [ ] **步骤 2：运行 E2E，确认新断言先失败**

运行：

```bash
npm run test:e2e -- tests/e2e/mvp-flow.spec.ts
```

预期输出：

```text
FAIL  tests/e2e/mvp-flow.spec.ts
Expected URL to match /\/projects\/.+\/transition$/
```

- [ ] **步骤 3：补刷新、丢失上下文和取消确认时的 UI 回退**

```tsx
// src/components/project-transition-screen.tsx
if (!transition) {
  return (
    <Surface className="grid min-h-[320px] place-items-center p-6">
      <div className="text-center text-sm text-[var(--muted)]">
        未找到阶段切换信息，正在返回项目流程。
      </div>
    </Surface>
  );
}
```

```ts
// confirm cancel path
onCancel={() => {
  window.location.assign(`/projects/${projectId}/interview`);
}}
```

```tsx
// transition 页默认步骤高亮
<WizardShell currentStep={transition?.to ?? "generating"} footer="正在为你切换到下一阶段。">
```

- [ ] **步骤 4：重新跑单测和 E2E，确认全部通过**

运行：

```bash
npm test -- --run tests/unit/project-transition.test.ts tests/unit/project-flow.test.ts
npm run test:e2e -- tests/e2e/mvp-flow.spec.ts
```

预期输出：

```text
PASS  tests/unit/project-transition.test.ts
PASS  tests/unit/project-flow.test.ts
PASS  tests/e2e/mvp-flow.spec.ts
```

- [ ] **步骤 5：提交最终验证和体验打磨**

```bash
git add tests/e2e/mvp-flow.spec.ts src/components/project-transition-screen.tsx src/app/projects/[projectId]/transition/page.tsx tests/unit/project-transition.test.ts
git commit -m "test: cover stage transition handoff flow"
```

## 自检

### 规格覆盖检查

- 普通自动阶段切换的统一过渡提示：由任务 1 的元数据和任务 2 的过渡页实现。
- “设计师追问 -> 方案生成中”的确认提示：由任务 1 的 `confirm` 配置和任务 3 的跳转接入实现。
- 不改后端状态机：所有任务都保留现有 API `nextPath` 返回，只替换前端跳转方式。
- 刷新、缺失上下文、重复跳转、取消确认：由任务 3 和任务 4 的防护与回退覆盖。
- 测试要求：由任务 1 单测和任务 4 E2E 覆盖。

### 占位词检查

- 文档里没有 `TODO`、`TBD`、`后续补充` 或“自行处理异常”这类空泛描述。
- 每个任务都给了明确文件路径、代码片段、运行命令和预期结果。

### 类型与命名一致性检查

- 过渡模式统一使用 `auto | confirm`。
- helper 命名统一使用：`buildStageTransition`、`beginStageTransition`、`consumeStageTransition`、`getTransitionConfig`。
- 阶段 key 全部沿用现有流程：`analysis`、`preferences`、`interview`、`generating`、`complete`。
