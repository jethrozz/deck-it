import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { getStepIndex, type WizardStepKey, wizardSteps } from "@/lib/projects/flow";
import { cx, Surface } from "@/components/ui/primitives";

export function WizardShell({
  currentStep,
  children,
  footer
}: {
  currentStep: WizardStepKey;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <Surface className="px-6 py-5 md:px-10 md:py-8">
          <div className="grid gap-8">
            <div className="mx-auto w-full max-w-[1040px]">
              <ol className="grid grid-cols-2 gap-4 md:grid-cols-6">
                {wizardSteps.map((step, index) => {
                  const isDone = index < currentIndex;
                  const isCurrent = index === currentIndex;

                  return (
                    <li key={step.key} className="grid gap-2">
                      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2">
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
                        {index < wizardSteps.length - 1 ? (
                          <div
                            className={cx(
                              "hidden h-px flex-1 md:block",
                              index < currentIndex ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                            )}
                          />
                        ) : null}
                      </div>
                      <div className="relative h-5">
                        <span
                          className={cx(
                            "absolute left-[0.875rem] w-max -translate-x-1/2 text-xs font-medium whitespace-nowrap",
                            isCurrent ? "text-[var(--accent)]" : "text-[var(--muted)]"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {children}
          </div>
        </Surface>

        {footer ? <div className="text-center text-sm text-[var(--muted)]">{footer}</div> : null}
      </div>
    </main>
  );
}
