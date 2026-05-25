import { Check } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";
import { getStepIndex, type WizardStepKey, wizardSteps } from "@/lib/projects/flow";
import { cx, Surface } from "@/components/ui/primitives";

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
          {title || description ? (
            <div className="grid gap-1">
              {title ? <h1 className="text-2xl font-semibold tracking-tight">{title}</h1> : null}
              {description ? <p className="text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
            </div>
          ) : null}

          <div className="hidden overflow-x-auto pb-1 md:block">
            <ol aria-label="项目步骤" className="grid min-w-max grid-cols-6 gap-4">
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
