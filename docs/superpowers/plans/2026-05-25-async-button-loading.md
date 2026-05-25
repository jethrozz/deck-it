# Async Button Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent loading states to async and navigation-wait buttons without affecting immediate UI-only controls.

**Architecture:** Extend the shared `Button` primitive with first-class loading support, then migrate representative async buttons to that API while leaving synchronous controls alone. Reuse existing local pending state in each flow instead of introducing a global loading store.

**Tech Stack:** React 19, Next.js App Router, TypeScript, Vitest, Lucide icons, Tailwind utility classes

---

## File Map

- Modify: `src/components/ui/primitives.tsx`
  Adds `loading`, `loadingText`, and built-in spinner handling to the shared `Button`.
- Modify: `src/components/project-steps.tsx`
  Migrates the main async journey buttons to the shared loading API.
- Modify: `src/components/interview-panel.tsx`
  Adds loading feedback to the async submit button in the interview flow.
- Modify: `src/components/payment-step.tsx`
  Adds loading feedback to quote, pay, refresh, and generate-entry actions.
- Modify: `src/components/project-workspace.tsx`
  Replaces async raw buttons with the shared primitive where waiting is user-visible.
- Create: `tests/unit/button-loading.test.tsx`
  Verifies shared `Button` loading behavior.
- Modify: `tests/unit/payment-step.test.tsx`
  Verifies at least one async button enters loading and disables while pending.

### Task 1: Shared Button Loading API

**Files:**
- Modify: `src/components/ui/primitives.tsx`
- Test: `tests/unit/button-loading.test.tsx`

- [ ] **Step 1: Write the failing shared-button test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/primitives";

describe("Button loading", () => {
  it("shows a spinner, disables the button, and exposes aria-busy while loading", () => {
    render(
      <Button loading loadingText="提交中">
        提交
      </Button>
    );

    const button = screen.getByRole("button", { name: "提交中" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("提交中")).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/button-loading.test.tsx`
Expected: FAIL because `Button` does not yet support `loading`, `loadingText`, or `aria-busy`.

- [ ] **Step 3: Write minimal shared-button implementation**

```tsx
import { LoaderCircle } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  loadingText?: string;
  loadingIndicator?: React.ReactNode;
};

export function Button({
  className,
  variant = "primary",
  loading = false,
  loadingText,
  loadingIndicator,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const content = loading && loadingText ? loadingText : children;

  return (
    <button
      className={cx(/* keep existing classes */, className)}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      {...props}
    >
      {loading ? loadingIndicator ?? <LoaderCircle size={16} className="animate-spin" /> : null}
      {content}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/button-loading.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/primitives.tsx tests/unit/button-loading.test.tsx
git commit -m "feat: add shared button loading state"
```

### Task 2: Migrate Main Project Journey Buttons

**Files:**
- Modify: `src/components/project-steps.tsx`
- Test: `tests/unit/floor-plan-route.test.tsx`

- [ ] **Step 1: Write a failing/updated test for a representative async action**

Add a focused assertion that one async button uses the shared loading copy rather than a hand-built spinner branch:

```tsx
expect(screen.getByRole("button", { name: /确认并继续/i })).toBeDisabled();
expect(screen.getByRole("button", { name: /确认并继续/i })).toHaveAttribute("aria-busy", "true");
```

- [ ] **Step 2: Run representative tests**

Run: `npm test -- tests/unit/floor-plan-route.test.tsx`
Expected: FAIL or remain incomplete until component wiring is added.

- [ ] **Step 3: Replace manual spinner branches with `Button.loading`**

Use this pattern in `project-steps.tsx`:

```tsx
<Button type="button" loading={busy} disabled={!isReady} onClick={() => void submit([])}>
  跳过，确认无误
</Button>

<Button
  type="button"
  loading={busy}
  loadingText="确认并继续"
  disabled={!isReady}
  onClick={() => void submit(parsedCorrections)}
>
  确认并继续
</Button>
```

Also migrate:

- project creation submit
- upload trigger
- preferences save-and-continue
- completed-step regenerate / download buttons

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- tests/unit/floor-plan-route.test.tsx tests/unit/payment-step.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/project-steps.tsx tests/unit/floor-plan-route.test.tsx tests/unit/payment-step.test.tsx
git commit -m "feat: add loading states to project journey buttons"
```

### Task 3: Wire Interview and Payment Async Buttons

**Files:**
- Modify: `src/components/interview-panel.tsx`
- Modify: `src/components/payment-step.tsx`
- Test: `tests/unit/payment-step.test.tsx`

- [ ] **Step 1: Write the failing payment-step test**

Add a test that clicks the quote or pay button and expects loading state:

```tsx
await user.click(screen.getByRole("button", { name: "应用优惠码" }));
expect(screen.getByRole("button", { name: "应用优惠码" })).toBeDisabled();
expect(screen.getByRole("button", { name: "应用优惠码" })).toHaveAttribute("aria-busy", "true");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/payment-step.test.tsx`
Expected: FAIL because current buttons only render conditional icons.

- [ ] **Step 3: Implement minimal wiring**

Replace current manual loading branches with the shared API:

```tsx
<Button
  type="button"
  variant="secondary"
  loading={quoting}
  disabled={!order || paying || preparing}
  onClick={() => void handleQuote()}
>
  应用优惠码
</Button>
```

```tsx
<Button type="submit" loading={pending} disabled={completedTransition !== null || !draft.trim()}>
  <Send size={16} />
  发送回答
</Button>
```

Keep local state ownership unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/payment-step.test.tsx tests/unit/interview-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/interview-panel.tsx src/components/payment-step.tsx tests/unit/payment-step.test.tsx
git commit -m "feat: add loading states to interview and payment buttons"
```

### Task 4: Upgrade Async Buttons in Project Workspace

**Files:**
- Modify: `src/components/project-workspace.tsx`

- [ ] **Step 1: Identify async raw buttons**

Convert only these raw async buttons to the shared primitive:

- analyze floor plan submit
- save preferences submit
- get next question
- submit answer

Keep option chips and other immediate controls as raw lightweight buttons.

- [ ] **Step 2: Implement minimal replacement**

Use this pattern:

```tsx
<Button type="submit" loading={busyAction === "analyze-floor-plan"}>
  分析户型
</Button>
```

```tsx
<Button
  type="button"
  loading={busyAction === "agent-next-question"}
  disabled={busyAction === "agent-respond"}
>
  获取下一步问题
</Button>
```

- [ ] **Step 3: Run targeted regression tests**

Run: `npm test -- tests/unit/agent-workflow.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/project-workspace.tsx
git commit -m "feat: align workspace async buttons with shared loading states"
```

### Task 5: Full Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused async-button test set**

Run: `npm test -- tests/unit/button-loading.test.tsx tests/unit/payment-step.test.tsx tests/unit/interview-panel.test.tsx`
Expected: PASS

- [ ] **Step 2: Run the full unit suite**

Run: `npm test`
Expected: PASS with existing skipped integration tests unchanged

- [ ] **Step 3: Review diff for accidental sync-control changes**

Run: `git diff -- src/components/ui/primitives.tsx src/components/project-steps.tsx src/components/interview-panel.tsx src/components/payment-step.tsx src/components/project-workspace.tsx`
Expected: Only async buttons and shared button behavior changed

- [ ] **Step 4: Commit final cleanup if needed**

```bash
git add src/components/ui/primitives.tsx src/components/project-steps.tsx src/components/interview-panel.tsx src/components/payment-step.tsx src/components/project-workspace.tsx tests/unit/button-loading.test.tsx tests/unit/payment-step.test.tsx
git commit -m "test: verify async button loading coverage"
```
