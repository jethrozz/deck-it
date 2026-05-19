"use client";

import type { ReactNode } from "react";
import { Coins, Gem, Warehouse } from "lucide-react";
import { budgetLabels, styleLabels } from "@/lib/projects/labels";
import { cx } from "@/components/ui/primitives";
import type { BudgetTier, Style } from "@/lib/domain/schemas";

const styleArtwork: Record<Style, string> = {
  warm_wood: "linear-gradient(180deg, rgba(99,70,44,0.08), rgba(42,29,16,0.55)), linear-gradient(135deg, #d9c7a7, #8f6a49)",
  vintage: "linear-gradient(180deg, rgba(72,46,31,0.08), rgba(45,29,20,0.55)), linear-gradient(135deg, #b88a61, #5d4336)",
  modern_minimal: "linear-gradient(180deg, rgba(92,98,110,0.08), rgba(61,66,76,0.55)), linear-gradient(135deg, #d9dde5, #9097a5)",
  bright: "linear-gradient(180deg, rgba(220,209,178,0.06), rgba(213,189,141,0.4)), linear-gradient(135deg, #f5efe0, #d9c39a)",
  wabi_sabi: "linear-gradient(180deg, rgba(126,109,93,0.06), rgba(83,71,59,0.48)), linear-gradient(135deg, #c7b8a2, #7d6a5b)"
};

const styleDescriptions: Record<Style, string> = {
  warm_wood: "自然木色，温暖放松",
  vintage: "复古质感，层次更浓",
  modern_minimal: "克制利落，清爽耐看",
  bright: "轻盈明亮，显大通透",
  wabi_sabi: "低饱和材质，安静松弛"
};

const budgetIcons: Record<BudgetTier, ReactNode> = {
  economy: <Coins size={18} />,
  quality: <Gem size={18} />,
  premium: <Warehouse size={18} />
};

export function StyleBudgetCards({
  selectedStyle,
  selectedBudget,
  onStyleChange,
  onBudgetChange
}: {
  selectedStyle: Style;
  selectedBudget: BudgetTier;
  onStyleChange: (style: Style) => void;
  onBudgetChange: (budget: BudgetTier) => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">选择你喜欢的风格</h2>
        <div className="grid gap-3 md:grid-cols-5">
          {(Object.keys(styleLabels) as Style[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onStyleChange(style)}
              className={cx(
                "overflow-hidden rounded-2xl border text-left transition",
                selectedStyle === style
                  ? "border-[var(--accent)] shadow-[0_10px_30px_rgba(45,104,255,0.18)]"
                  : "border-[var(--line)]"
              )}
            >
              <div className="flex h-28 items-end p-4" style={{ background: styleArtwork[style] }}>
                <div className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-[#3d4656]">
                  {styleDescriptions[style]}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-sm font-semibold">{styleLabels[style]}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">选择预算档位</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(budgetLabels) as BudgetTier[]).map((budget) => {
            const label = budgetLabels[budget];
            return (
              <button
                key={budget}
                type="button"
                onClick={() => onBudgetChange(budget)}
                className={cx(
                  "rounded-2xl border bg-white px-4 py-4 text-left transition",
                  selectedBudget === budget
                    ? "border-[var(--accent)] shadow-[0_10px_30px_rgba(45,104,255,0.16)]"
                    : "border-[var(--line)]"
                )}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  {budgetIcons[budget]}
                </div>
                <div className="text-base font-semibold">{label.title}</div>
                <div className="text-sm text-[var(--muted)]">{label.range}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
