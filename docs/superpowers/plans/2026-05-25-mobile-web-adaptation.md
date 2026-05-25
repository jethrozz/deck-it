# Mobile Web Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the existing Deck It project flow for mobile web while preserving the current PC business flow, route semantics, and backend API behavior.

**Architecture:** Keep the current route and status model intact, then introduce a mobile-first presentation layer: a responsive wizard shell, reordered single-column step content, fixed bottom action areas, and compact summary patterns for dense pages like interview and payment. Reuse the existing step components and request logic wherever possible so that mobile support is mainly a layout and interaction refactor instead of a workflow rewrite.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, React Testing Library, Playwright.

---

## File Structure

- Modify `src/app/globals.css`: add mobile-safe spacing tokens and sticky action bar spacing.
- Modify `src/components/ui/primitives.tsx`: extend button/surface primitives for mobile-friendly sizing and utility hooks.
- Modify `src/components/wizard-shell.tsx`: add a mobile-first step header, horizontal progress rail, and optional sticky bottom action slot.
- Create `tests/unit/wizard-shell.test.tsx`: verify the shell renders the mobile progress header and sticky action bar hook points.
- Modify `src/app/page.tsx`: keep the dark landing direction, but restructure the hero for narrow screens.
- Modify `src/components/project-steps.tsx`: reorder upload, analysis, preferences, and complete-page blocks into mobile-first single-column flows; move fixed CTAs into dedicated mobile sections where needed.
- Modify `src/components/style-budget-cards.tsx`: convert desktop-only grids into mobile-friendly 2-column / stacked card layouts.
- Modify `src/components/analysis-summary.tsx`: tighten spacing so the summary card remains readable on 375px widths.
- Create `tests/unit/project-steps-mobile-layout.test.tsx`: verify the main mobile step sections render in the intended order.
- Modify `src/components/interview-panel.tsx`: convert the right-side summary into a collapsible mobile summary card and keep the composer pinned near the viewport bottom.
- Modify `src/components/payment-step.tsx`: front-load pricing/status, keep contact and coupon fields scrollable, and expose a sticky mobile payment bar.
- Modify `src/components/project-transition-screen.tsx`: center the confirmation state and expose clear mobile CTA hierarchy.
- Modify `src/components/generation-status.tsx`: collapse the desktop split layout into stacked status and preview cards.
- Modify `tests/unit/interview-panel.test.ts`: cover the mobile summary toggle alongside the existing completion transition behavior.
- Create `tests/unit/payment-step.test.tsx`: verify sticky payment states and the “start generating” state when credits are available.
- Modify `src/app/projects/[projectId]/upload/page.tsx`, `analysis/page.tsx`, `preferences/page.tsx`, `interview/page.tsx`, `payment/page.tsx`, `generating/page.tsx`, `complete/page.tsx`, and `transition/page.tsx`: pass shell-level copy and footer behavior consistently.
- Modify `tests/e2e/mvp-flow.spec.ts`: run the main homeowner flow in a mobile viewport and assert the mobile CTAs remain visible.
- Modify `tests/e2e/payment-flow.spec.ts`: validate the payment gate and payment page in a mobile viewport.

---

### Task 1: Build The Mobile Wizard Shell And Shared Spacing

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/primitives.tsx`
- Modify: `src/components/wizard-shell.tsx`
- Test: `tests/unit/wizard-shell.test.tsx`

- [ ] **Step 1: Write the failing shell test**

Create `tests/unit/wizard-shell.test.tsx`:

```tsx
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { WizardShell } from "@/components/wizard-shell";

describe("WizardShell", () => {
  it("renders the mobile progress rail and sticky action slot", () => {
    render(
      <WizardShell
        currentStep="preferences"
        title="风格与预算"
        description="选择你喜欢的风格，并补充需求。"
        mobileActionBar={
          <div data-testid="shell-mobile-action-bar">
            <button type="button">保存并继续</button>
          </div>
        }
      >
        <div>page body</div>
      </WizardShell>
    );

    expect(screen.getByText("风格与预算")).not.toBeNull();
    expect(screen.getByText("选择你喜欢的风格，并补充需求。")).not.toBeNull();
    expect(screen.getByRole("list", { name: "项目步骤" })).not.toBeNull();
    expect(screen.getByTestId("shell-mobile-action-bar")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run: `npm test -- tests/unit/wizard-shell.test.tsx`

Expected: FAIL because `WizardShell` does not accept `title`, `description`, or `mobileActionBar`.

- [ ] **Step 3: Add mobile-safe layout tokens and primitive sizing**

Update `src/app/globals.css`:

```css
:root {
  color-scheme: light;
  --background: #f5f7fb;
  --foreground: #182131;
  --muted: #738096;
  --panel: #ffffff;
  --panel-soft: #f6f8fc;
  --line: #e5eaf2;
  --accent: #2d68ff;
  --accent-soft: #edf3ff;
  --accent-strong: #1d4d47;
  --page-gutter: 16px;
  --mobile-action-bar-height: 88px;
}

@media (min-width: 768px) {
  :root {
    --page-gutter: 24px;
    --mobile-action-bar-height: 0px;
  }
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top, rgba(45, 104, 255, 0.06), transparent 28%),
    var(--background);
  color: var(--foreground);
  font-family: Inter, Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

Update `src/components/ui/primitives.tsx`:

```tsx
export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-[var(--accent)] text-white shadow-[0_10px_30px_rgba(45,104,255,0.22)]",
        variant === "secondary" && "border border-[var(--line)] bg-white text-[var(--foreground)]",
        variant === "ghost" && "text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[24px] border border-[var(--line)] bg-white shadow-[0_18px_60px_rgba(18,35,71,0.08)] md:rounded-[28px]",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Implement the responsive wizard shell**

Update `src/components/wizard-shell.tsx`:

```tsx
export function WizardShell({
  currentStep,
  title,
  description,
  children,
  footer,
  mobileActionBar
}: {
  currentStep: WizardStepKey;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  mobileActionBar?: ReactNode;
}) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-[var(--page-gutter)] pb-[calc(32px+var(--mobile-action-bar-height)+env(safe-area-inset-bottom))] pt-4 md:pt-8">
        <div className="grid gap-5 md:gap-6">
          <div className="flex items-center justify-between md:hidden">
            <div className="text-sm font-semibold tracking-tight text-[var(--foreground)]">装它 deck it</div>
            <div className="text-xs text-[var(--muted)]">步骤 {currentIndex + 1}/{wizardSteps.length}</div>
          </div>

          {(title || description) ? (
            <div className="grid gap-1">
              {title ? <h1 className="text-2xl font-semibold tracking-tight">{title}</h1> : null}
              {description ? <p className="text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
            </div>
          ) : null}

          <div className="overflow-x-auto pb-1">
            <ol aria-label="项目步骤" className="flex min-w-max gap-3 md:grid md:grid-cols-6 md:gap-4">
              {wizardSteps.map((step, index) => {
                const isDone = index < currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <li key={step.key} className="min-w-[88px] md:min-w-0">
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cx(
                            "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                            isDone && "border-[var(--accent)] bg-[var(--accent)] text-white",
                            isCurrent && "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
                            !isDone && !isCurrent && "border-[var(--line)] bg-white text-[#8a94a7]"
                          )}
                        >
                          {isDone ? <Check size={14} /> : index + 1}
                        </div>
                        <div className={cx("h-px flex-1", index < currentIndex ? "bg-[var(--accent)]" : "bg-[var(--line)]")} />
                      </div>
                      <span className={cx("text-xs font-medium whitespace-nowrap", isCurrent ? "text-[var(--accent)]" : "text-[var(--muted)]")}>
                        {step.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <Surface className="px-4 py-5 md:px-8 md:py-8">{children}</Surface>
          {footer ? <div className="text-center text-sm text-[var(--muted)]">{footer}</div> : null}
        </div>
      </div>

      {mobileActionBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 backdrop-blur md:hidden">
          <div className="mx-auto max-w-6xl px-[var(--page-gutter)] py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            {mobileActionBar}
          </div>
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 5: Run the shell test to verify it passes**

Run: `npm test -- tests/unit/wizard-shell.test.tsx`

Expected: PASS with one test verifying the progress rail and sticky action slot.

- [ ] **Step 6: Commit the shared shell work**

```bash
git add tests/unit/wizard-shell.test.tsx src/app/globals.css src/components/ui/primitives.tsx src/components/wizard-shell.tsx
git commit -m "feat: add mobile wizard shell foundation"
```

---

### Task 2: Reflow The Landing, Upload, Analysis, And Preferences Steps

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/project-steps.tsx`
- Modify: `src/components/style-budget-cards.tsx`
- Modify: `src/components/analysis-summary.tsx`
- Modify: `src/app/projects/[projectId]/upload/page.tsx`
- Modify: `src/app/projects/[projectId]/analysis/page.tsx`
- Modify: `src/app/projects/[projectId]/preferences/page.tsx`
- Test: `tests/unit/project-steps-mobile-layout.test.tsx`

- [ ] **Step 1: Write the failing step-layout test**

Create `tests/unit/project-steps-mobile-layout.test.tsx`:

```tsx
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { AnalysisConfirmStep, PreferencesStep, UploadStep } from "@/components/project-steps";

const analysis = {
  rooms: [{ name: "客厅", type: "living_dining" as const, confidence: 0.93 }],
  relationships: ["客厅连接阳台"],
  issues: ["玄关收纳不足"],
  uncertainItems: [],
  userCorrections: []
};

describe("mobile step layout", () => {
  it("renders upload content before the helper tips card", () => {
    const { container } = render(<UploadStep projectId="p1" />);
    const sections = Array.from(container.querySelectorAll("[data-testid]")).map((node) => node.getAttribute("data-testid"));
    expect(sections).toContain("upload-dropzone");
    expect(sections).toContain("upload-tips");
    expect(sections.indexOf("upload-dropzone")).toBeLessThan(sections.indexOf("upload-tips"));
  });

  it("renders the floor plan preview before the analysis summary", () => {
    const { container } = render(<AnalysisConfirmStep projectId="p1" floorPlanUrl="/demo.png" analysis={analysis} />);
    const sections = Array.from(container.querySelectorAll("[data-testid]")).map((node) => node.getAttribute("data-testid"));
    expect(sections.indexOf("analysis-preview")).toBeLessThan(sections.indexOf("analysis-summary-card"));
  });

  it("keeps the preferences notes block after style and budget selection", () => {
    render(<PreferencesStep projectId="p1" />);
    expect(screen.getByText("补充你的需求和想法")).not.toBeNull();
    expect(screen.getByRole("button", { name: "保存并继续" })).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the step-layout test to verify it fails**

Run: `npm test -- tests/unit/project-steps-mobile-layout.test.tsx`

Expected: FAIL because the step components do not expose the `data-testid` anchors yet.

- [ ] **Step 3: Rebuild the landing page for narrow screens**

Update `src/app/page.tsx`:

```tsx
<main className="min-h-screen bg-[#050914] p-3 text-white md:p-6">
  <div
    className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#040915] md:min-h-[calc(100vh-3rem)] md:rounded-[40px]"
    style={{ backgroundImage: "...", backgroundSize: "cover", backgroundPosition: "center" }}
  >
    <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1.05fr)_520px] lg:px-12 lg:py-10">
      <section className="flex min-h-0 flex-col gap-8 lg:min-h-[720px] lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#5d74ff]/40 bg-[linear-gradient(180deg,rgba(50,101,255,0.18),rgba(131,89,255,0.14))]">
              <House size={22} className="text-[#86a3ff]" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[28px] font-semibold leading-none tracking-tight text-white">装它</span>
              <span className="pb-0.5 text-base font-medium text-white/70">deck it</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-6xl">
            AI 设计师
            <br />
            让装修想法从无到有
          </h1>
          <p className="max-w-xl text-base leading-7 text-white/78 md:text-2xl md:leading-[1.9]">
            为你梳理思路，提供专业的设计建议，沉淀装修前的沟通 brief。
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {heroFeatures.map((feature) => (
              <div key={feature.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center backdrop-blur">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(28,45,94,0.7)] text-[#62c5ff]">
                  {feature.icon}
                </div>
                <span className="mt-3 block text-sm font-medium text-white/88">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-end justify-stretch lg:items-center lg:justify-end">
        <Surface className="w-full rounded-[28px] border border-[#5073ff]/55 bg-[linear-gradient(180deg,rgba(15,23,54,0.92),rgba(12,18,41,0.86))] p-6 text-white md:p-10">
          {/* existing form body stays intact */}
        </Surface>
      </div>
    </div>
  </div>
</main>
```

- [ ] **Step 4: Reorder the linear wizard steps into mobile-first cards**

Update the relevant blocks in `src/components/project-steps.tsx`:

```tsx
return (
  <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
    <Surface data-testid="upload-dropzone" className="grid place-items-center border-dashed p-6 md:p-8">
      {/* existing upload body */}
    </Surface>

    <Surface data-testid="upload-tips" className="grid h-fit gap-3 p-4 md:p-5">
      {/* existing tips */}
    </Surface>
  </div>
);
```

```tsx
return (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_420px]">
    <Surface data-testid="analysis-preview" className="grid min-h-[320px] place-items-center overflow-hidden p-3 md:min-h-[560px] md:p-4">
      {/* existing img preview */}
    </Surface>

    <div className="grid gap-4">
      <div data-testid="analysis-summary-card">
        <AnalysisSummary analysis={analysis} />
      </div>
      <Surface className="grid gap-4 p-4 md:p-5">
        {/* existing corrections form */}
      </Surface>
    </div>
  </div>
);
```

```tsx
return (
  <div className="grid gap-5">
    <StyleBudgetCards
      selectedStyle={style}
      selectedBudget={budgetTier}
      onStyleChange={setStyle}
      onBudgetChange={setBudgetTier}
    />

    <Surface className="grid gap-4 p-4 md:p-5">
      {/* existing textarea + save button */}
    </Surface>
  </div>
);
```

Update `src/components/style-budget-cards.tsx`:

```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
  {(Object.keys(styleLabels) as Style[]).map((style) => (
    <button
      key={style}
      type="button"
      onClick={() => onStyleChange(style)}
      className={cx(
        "overflow-hidden rounded-2xl border text-left transition",
        selectedStyle === style ? "border-[var(--accent)] shadow-[0_10px_30px_rgba(45,104,255,0.18)]" : "border-[var(--line)]"
      )}
    >
      <div className="flex h-24 items-end p-3 md:h-28 md:p-4" style={{ background: styleArtwork[style] }}>
        <div className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-[#3d4656]">{styleDescriptions[style]}</div>
      </div>
      <div className="px-4 py-3">
        <div className="text-sm font-semibold">{styleLabels[style]}</div>
      </div>
    </button>
  ))}
</div>

<div className="grid gap-3 sm:grid-cols-3">
  {(Object.keys(budgetLabels) as BudgetTier[]).map((budget) => {
    const label = budgetLabels[budget];
    return (
      <button key={budget} type="button" onClick={() => onBudgetChange(budget)} className="rounded-2xl border bg-white px-4 py-4 text-left transition">
        {/* existing icon + labels */}
      </button>
    );
  })}
</div>
```

Update `src/components/analysis-summary.tsx` card spacing to use `p-4 md:p-5` and keep list spacing at `gap-3` so the summary remains readable at 375px widths.

- [ ] **Step 5: Wire the updated copy into the route pages**

Update `src/app/projects/[projectId]/upload/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="upload"
    title="上传户型图"
    description="上传清晰户型图，我们会自动识别房间、采光和空间关系。"
    footer="我们会自动识别房间、采光和空间关系。"
  >
    <UploadStep projectId={project.id} />
  </WizardShell>
);
```

Update `src/app/projects/[projectId]/analysis/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="analysis"
    title="确认户型分析"
    description="看看 AI 是否正确理解了你的户型，再进入下一步。"
  >
    <AnalysisConfirmStep projectId={project.id} floorPlanUrl={project.floorPlanUrl} analysis={analysis} />
  </WizardShell>
);
```

Update `src/app/projects/[projectId]/preferences/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="preferences"
    title="风格与预算"
    description="选择喜欢的风格、预算档位，并补充你的生活需求。"
  >
    <PreferencesStep projectId={project.id} initialPreference={...} />
  </WizardShell>
);
```

- [ ] **Step 6: Run the step-layout test to verify it passes**

Run: `npm test -- tests/unit/project-steps-mobile-layout.test.tsx`

Expected: PASS with the sections appearing in the intended mobile-first order.

- [ ] **Step 7: Commit the linear-page mobile refactor**

```bash
git add src/app/page.tsx src/components/project-steps.tsx src/components/style-budget-cards.tsx src/components/analysis-summary.tsx src/app/projects/[projectId]/upload/page.tsx src/app/projects/[projectId]/analysis/page.tsx src/app/projects/[projectId]/preferences/page.tsx tests/unit/project-steps-mobile-layout.test.tsx
git commit -m "feat: adapt core wizard steps for mobile layout"
```

---

### Task 3: Adapt Interview, Transition, Payment, Generating, And Completion For Mobile

**Files:**
- Modify: `src/components/interview-panel.tsx`
- Modify: `src/components/payment-step.tsx`
- Modify: `src/components/project-transition-screen.tsx`
- Modify: `src/components/generation-status.tsx`
- Modify: `src/components/project-steps.tsx`
- Modify: `src/app/projects/[projectId]/interview/page.tsx`
- Modify: `src/app/projects/[projectId]/payment/page.tsx`
- Modify: `src/app/projects/[projectId]/generating/page.tsx`
- Modify: `src/app/projects/[projectId]/complete/page.tsx`
- Modify: `src/app/projects/[projectId]/transition/page.tsx`
- Modify: `tests/unit/interview-panel.test.ts`
- Create: `tests/unit/payment-step.test.tsx`

- [ ] **Step 1: Write the failing mobile interaction tests**

Create `tests/unit/payment-step.test.tsx`:

```tsx
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentStep } from "@/components/payment-step";

describe("PaymentStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a sticky mobile action bar for pending payment", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        order: {
          id: "o1",
          orderNo: "ORD-1",
          status: "PENDING",
          title: "设计方案生成",
          creditsGranted: 2,
          originalAmount: 199,
          discountAmount: 0,
          payableAmount: 199,
          contactType: null,
          contactValue: null,
          couponCodeSnapshot: null
        },
        remainingCredits: 0,
        requiresPayment: true
      })
    } as Response);

    render(
      <PaymentStep
        project={{
          id: "p1",
          status: "AWAITING_PAYMENT",
          generationCreditsPurchased: 0,
          generationCreditsUsed: 0,
          orders: []
        }}
      />
    );

    expect(await screen.findByTestId("payment-mobile-action-bar")).not.toBeNull();
    expect(screen.getByRole("button", { name: "立即支付" })).not.toBeNull();
  });
});
```

Extend `tests/unit/interview-panel.test.ts` with:

```tsx
it("toggles the mobile project summary card", () => {
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn()
  });

  render(
    React.createElement(InterviewPanel, {
      projectId: "p3",
      status: "INTERVIEWING",
      analysis,
      preference,
      initialConversation
    })
  );

  const toggle = screen.getByRole("button", { name: "展开项目摘要" });
  fireEvent.click(toggle);
  expect(screen.getByText("希望空间更温暖，也更好收纳")).not.toBeNull();
});
```

- [ ] **Step 2: Run the interaction tests to verify they fail**

Run: `npm test -- tests/unit/interview-panel.test.ts tests/unit/payment-step.test.tsx`

Expected: FAIL because the interview summary toggle and payment mobile action bar do not exist yet.

- [ ] **Step 3: Refactor the interview experience into a mobile chat-first layout**

Update `src/components/interview-panel.tsx`:

```tsx
return (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_320px]">
    <Surface className="grid min-h-[min(70vh,640px)] gap-4 p-4 md:min-h-[560px] md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI 设计师</h2>
          <p className="text-sm text-[var(--muted)]">先由设计师主动开场，再根据你的回答继续判断下一步。</p>
        </div>
        <div className="rounded-full bg-[var(--panel-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          {status === "BRIEF_READY" ? "已完成方案，可继续补充想法" : "设计师咨询中"}
        </div>
      </div>

      <button
        type="button"
        className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-left lg:hidden"
        onClick={() => setSummaryOpen((current) => !current)}
      >
        <span className="text-sm font-medium">项目摘要</span>
        <span className="text-xs text-[var(--muted)]">{summaryOpen ? "收起项目摘要" : "展开项目摘要"}</span>
      </button>

      {summaryOpen ? (
        <aside className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 lg:hidden">
          <SummaryItem label="户型" value={analysis.rooms.map((room) => roomLabels[room.type]).join(" / ")} />
          <SummaryItem label="风格" value={styleLabels[preference.style]} />
          <SummaryItem label="预算" value={`${budgetLabels[preference.budgetTier].title}（${budgetLabels[preference.budgetTier].range}）`} />
          <SummaryItem label="补充需求" value={preference.naturalLanguagePreference} />
        </aside>
      ) : null}

      <div className="grid flex-1 auto-rows-max content-start gap-4 overflow-y-auto rounded-[24px] bg-[var(--panel-soft)] p-4">
        {/* existing conversation bubbles */}
      </div>

      <div className="grid gap-3 border-t border-[var(--line)] pt-3">
        {/* existing quick options + form */}
      </div>
    </Surface>

    <Surface className="hidden h-fit gap-4 p-5 lg:grid">
      {/* existing desktop summary aside */}
    </Surface>
  </div>
);
```

Add this state near the other hooks:

```tsx
const [summaryOpen, setSummaryOpen] = useState(false);
```

- [ ] **Step 4: Refactor payment, transition, generation, and completion into stacked mobile flows**

Update `src/components/payment-step.tsx`:

```tsx
return (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_340px]">
    <Surface className="grid gap-4 p-4 md:p-6">
      <div data-testid="payment-summary-card" className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">订单支付</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">完成支付后解锁 2 次生成额度，支持重新追问后再次生成。</p>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
            {canStartGenerate ? "已可开始生成" : order?.status === "PROCESSING" ? "支付处理中" : "待支付"}
          </div>
        </div>
        <div className="mt-4 grid gap-2 rounded-2xl bg-white p-4 text-sm">
          {/* existing original / discount / payable rows */}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--line)] p-4">
        {/* existing contact inputs, coupon input, refresh button */}
      </div>

      <div data-testid="payment-mobile-action-bar" className="grid gap-3 lg:hidden">
        {canStartGenerate ? (
          <Button type="button" onClick={() => window.location.assign(`/projects/${project.id}/generating`)}>
            开始生成
          </Button>
        ) : (
          <Button type="button" disabled={payDisabled} onClick={() => void handlePay()}>
            {order?.status === "PROCESSING" ? "继续支付" : "立即支付"}
          </Button>
        )}
      </div>
    </Surface>

    <Surface className="grid h-fit gap-4 p-5">
      {/* existing current progress summary */}
    </Surface>
  </div>
);
```

Update `src/components/project-transition-screen.tsx`:

```tsx
if (transition.mode === "confirm" && !confirmed) {
  return (
    <Surface className="grid min-h-[360px] place-items-center p-5 md:p-8">
      <div className="grid w-full max-w-xl gap-6 text-center">
        <SectionTitle
          title={transition.title ?? "确认继续下一步？"}
          description={transition.description ?? "确认后将继续到下一步骤。"}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={() => navRef.current(fallbackPath)}>
            {transition.cancel ?? "取消"}
          </Button>
          <Button type="button" onClick={() => { onConfirm?.(transition); navRef.current(nextPath); }}>
            {transition.cta ?? "继续"}
          </Button>
        </div>
      </div>
    </Surface>
  );
}
```

Update `src/components/generation-status.tsx`:

```tsx
return (
  <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
    <Surface className="order-2 grid gap-4 p-4 md:p-5 lg:order-1">
      {/* existing task cards */}
    </Surface>

    <Surface className="order-1 grid gap-4 p-4 md:p-5 lg:order-2">
      <div>
        <h2 className="text-lg font-semibold">生成预览</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{runningTask ? `${runningTask.label}中` : "正在整理结果"}</p>
      </div>
      {/* existing preview box */}
    </Surface>
  </div>
);
```

Update the completion section inside `src/components/project-steps.tsx`:

```tsx
return (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
    <Surface className="order-2 grid gap-5 p-5 md:p-6 lg:order-1">
      {/* existing heading + result items + action buttons */}
    </Surface>

    <Surface className="order-1 overflow-hidden p-3 md:p-4 lg:order-2">
      {/* existing hero image */}
    </Surface>
  </div>
);
```

- [ ] **Step 5: Wire mobile shell copy into the remaining route pages**

Update `src/app/projects/[projectId]/interview/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="interview"
    title="设计师追问"
    description="AI 设计师会结合户型、预算和偏好，逐步确认你的真实需求。"
  >
    <InterviewStep ... />
  </WizardShell>
);
```

Update `src/app/projects/[projectId]/payment/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="generating"
    title="确认并支付"
    description="确认订单信息并完成支付，支付成功后即可开始生成。"
  >
    <PaymentStep project={JSON.parse(JSON.stringify(project))} />
  </WizardShell>
);
```

Update `src/app/projects/[projectId]/generating/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="generating"
    title="正在生成方案"
    description="系统正在整理需求画像、生成方案、效果图与 PDF brief。"
    footer="生成过程中请不要关闭页面。"
  >
    <GeneratingStep projectId={project.id} status={project.status} renderings={JSON.parse(JSON.stringify(project.renderings))} />
  </WizardShell>
);
```

Update `src/app/projects/[projectId]/complete/page.tsx`:

```tsx
return (
  <WizardShell
    currentStep="complete"
    title="方案已完成"
    description="你的专属设计结果已经准备好了，现在可以查看、下载或重新补充需求。"
  >
    <CompletedStep projectId={project.id} renderings={JSON.parse(JSON.stringify(project.renderings))} briefReady={project.briefExports.length > 0} />
  </WizardShell>
);
```

Update `src/app/projects/[projectId]/transition/page.tsx`:

```tsx
return (
  <WizardShell currentStep={getProjectStep(project.status).key} title="确认继续" description="确认后将进入下一步。">
    <ProjectTransitionScreen projectId={project.id} />
  </WizardShell>
);
```

- [ ] **Step 6: Run the interaction tests to verify they pass**

Run: `npm test -- tests/unit/interview-panel.test.ts tests/unit/payment-step.test.tsx`

Expected: PASS with the existing completion test still green and the new mobile summary / action bar assertions passing.

- [ ] **Step 7: Commit the complex-page mobile refactor**

```bash
git add src/components/interview-panel.tsx src/components/payment-step.tsx src/components/project-transition-screen.tsx src/components/generation-status.tsx src/components/project-steps.tsx src/app/projects/[projectId]/interview/page.tsx src/app/projects/[projectId]/payment/page.tsx src/app/projects/[projectId]/generating/page.tsx src/app/projects/[projectId]/complete/page.tsx src/app/projects/[projectId]/transition/page.tsx tests/unit/interview-panel.test.ts tests/unit/payment-step.test.tsx
git commit -m "feat: adapt interactive flow pages for mobile"
```

---

### Task 4: Lock The Mobile Flow With Playwright Regression

**Files:**
- Modify: `tests/e2e/mvp-flow.spec.ts`
- Modify: `tests/e2e/payment-flow.spec.ts`

- [ ] **Step 1: Write the mobile-focused E2E assertions**

Update `tests/e2e/mvp-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("homeowner can finish the guided renovation flow on mobile", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AI 设计师" })).toBeVisible();
  await expect(page.getByRole("button", { name: /开始创建/ })).toBeVisible();
  await page.getByRole("button", { name: /开始创建/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/upload$/);
  await expect(page.getByRole("button", { name: "选择图片" })).toBeVisible();

  // existing upload / analysis / preference / interview flow stays here

  await expect(page).toHaveURL(/\/projects\/.+\/payment$/);
  await expect(page.getByRole("heading", { name: "订单支付" })).toBeVisible();
  await expect(page.getByRole("button", { name: /立即支付|开始生成/ })).toBeVisible();
});
```

Update `tests/e2e/payment-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("generation is gated by payment and leads to the mobile payment page", async ({ page, request }) => {
  // existing project setup stays the same

  await page.goto(generatePayload.nextPath!);
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/payment$`));
  await expect(page.getByRole("heading", { name: "订单支付" })).toBeVisible();
  await expect(page.getByTestId("payment-mobile-action-bar")).toBeVisible();
  await expect(page.getByRole("button", { name: "立即支付" })).toBeVisible();
});
```

- [ ] **Step 2: Run the mobile E2E tests to verify the new assertions fail first**

Run: `npm run test:e2e -- tests/e2e/mvp-flow.spec.ts tests/e2e/payment-flow.spec.ts`

Expected: FAIL until the mobile titles, action bar, and payment assertions are wired up.

- [ ] **Step 3: Refresh the E2E flow bodies to match the real payment step**

In `tests/e2e/mvp-flow.spec.ts`, replace the old post-interview generating expectation with the current payment-first path:

```ts
await expect(page).toHaveURL(/\/projects\/.+\/transition$/);
await expect(page.getByText("确认开始生成方案？")).toBeVisible();
await page.getByRole("button", { name: /开始生成(方案)?/ }).click();

await expect(page).toHaveURL(/\/projects\/.+\/payment$/);
await expect(page.getByRole("button", { name: /立即支付|开始生成/ })).toBeVisible();
```

Keep the rest of the flow conditional on the local test setup:

```ts
if (await page.getByRole("button", { name: "开始生成" }).isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "开始生成" }).click();
} else {
  await expect(page.getByRole("button", { name: "立即支付" })).toBeVisible();
}
```

In `tests/e2e/payment-flow.spec.ts`, keep the data setup helpers unchanged, but assert the mobile payment summary before the contact form:

```ts
await expect(page.getByTestId("payment-summary-card")).toBeVisible();
await expect(page.getByText("应付金额")).toBeVisible();
await expect(page.getByRole("textbox", { name: "邮箱" })).toBeVisible();
```

- [ ] **Step 4: Run the full mobile regression set**

Run: `npm test -- tests/unit/wizard-shell.test.tsx tests/unit/project-steps-mobile-layout.test.tsx tests/unit/interview-panel.test.ts tests/unit/payment-step.test.tsx`

Expected: PASS across the new unit coverage.

Run: `npm run test:e2e -- tests/e2e/mvp-flow.spec.ts tests/e2e/payment-flow.spec.ts`

Expected: PASS with the homeowner flow and payment gate both working in a 390x844 viewport.

- [ ] **Step 5: Commit the mobile regression coverage**

```bash
git add tests/e2e/mvp-flow.spec.ts tests/e2e/payment-flow.spec.ts tests/unit/wizard-shell.test.tsx tests/unit/project-steps-mobile-layout.test.tsx tests/unit/interview-panel.test.ts tests/unit/payment-step.test.tsx
git commit -m "test: cover mobile project flow"
```

---

## Self-Review

### Spec coverage

- Shared mobile shell, horizontal progress, and bottom action strategy are implemented in Task 1.
- Homepage, upload, analysis, and preferences mobile reflow are implemented in Task 2.
- Interview, confirmation, payment, generating, and completion mobile behavior are implemented in Task 3.
- Mobile viewport regression for the main flow and payment flow are covered in Task 4.

No spec section is left without a corresponding task.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every task includes explicit files, commands, and code snippets.

### Type consistency

- `WizardShell` consistently uses `title`, `description`, and `mobileActionBar`.
- `PaymentStep` consistently exposes `payment-summary-card` and `payment-mobile-action-bar`.
- `InterviewPanel` consistently exposes the “展开项目摘要” toggle in the new mobile summary flow.
