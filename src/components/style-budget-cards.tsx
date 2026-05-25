"use client";

import type { ReactNode } from "react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Coins, Gem, Warehouse, X } from "lucide-react";
import { budgetLabels, styleLabels } from "@/lib/projects/labels";
import { Button, cx } from "@/components/ui/primitives";
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
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const selectedStyleRef = useRef<HTMLButtonElement | null>(null);
  const styleKeys = Object.keys(styleLabels) as Style[];
  const budgetKeys = Object.keys(budgetLabels) as BudgetTier[];

  useEffect(() => {
    if (!isStyleModalOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (selectedStyleRef.current && typeof selectedStyleRef.current.scrollIntoView === "function") {
      selectedStyleRef.current.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isStyleModalOpen]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:hidden">
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">风格与预算</h2>
          <p className="text-sm text-[var(--muted)]">风格点击选择，预算使用下拉，更适合手机端操作。</p>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">装修风格</span>
          <button
            data-testid="style-picker-trigger"
            type="button"
            onClick={() => setIsStyleModalOpen(true)}
            className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-left"
          >
            <div className="grid gap-0.5">
              <span className="text-sm font-semibold text-[var(--foreground)]">{styleLabels[selectedStyle]}</span>
              <span className="text-xs text-[var(--muted)]">{styleDescriptions[selectedStyle]}</span>
            </div>
            <ChevronDown size={16} className="text-[var(--muted)]" />
          </button>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">预算档位</span>
          <select
            data-testid="budget-tier-select"
            aria-label="预算档位"
            value={selectedBudget}
            onChange={(event) => onBudgetChange(event.target.value as BudgetTier)}
            className="h-12 rounded-xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          >
            {budgetKeys.map((budget) => {
              const label = budgetLabels[budget];
              return (
                <option key={budget} value={budget}>
                  {label.title}（{label.range}）
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {isStyleModalOpen ? (
        <div data-testid="style-picker-modal" className="fixed inset-0 z-50 flex items-end bg-[#0a1224]/55 p-0 md:hidden">
          <div role="dialog" aria-modal="true" aria-label="选择装修风格" className="grid max-h-[86vh] w-full gap-4 rounded-t-[28px] bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="grid gap-1">
                <h3 className="text-lg font-semibold">选择你喜欢的风格</h3>
                <p className="text-sm text-[var(--muted)]">左右滑动查看风格，点击卡片即可选择。</p>
              </div>
              <button
                type="button"
                aria-label="关闭风格选择"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)]"
                onClick={() => setIsStyleModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div data-testid="style-picker-slider" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {styleKeys.map((style) => (
                <button
                  key={style}
                  ref={selectedStyle === style ? selectedStyleRef : null}
                  type="button"
                  onClick={() => onStyleChange(style)}
                  className={cx(
                    "min-w-[78%] snap-center overflow-hidden rounded-2xl border text-left transition",
                    selectedStyle === style
                      ? "border-[var(--accent)] shadow-[0_14px_36px_rgba(45,104,255,0.2)]"
                      : "border-[var(--line)]"
                  )}
                >
                  <div className="flex h-32 items-end p-4" style={{ background: styleArtwork[style] }}>
                    <div className="rounded-full bg-white/88 px-3 py-1 text-xs font-medium text-[#3d4656]">{styleDescriptions[style]}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-base font-semibold">{styleLabels[style]}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pb-[max(env(safe-area-inset-bottom),0px)]">
              <Button type="button" variant="secondary" onClick={() => setIsStyleModalOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={() => setIsStyleModalOpen(false)}>
                确认风格
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden gap-6 md:grid">
        <div className="grid gap-3">
          <h2 className="text-lg font-semibold">选择你喜欢的风格</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {styleKeys.map((style) => (
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
                <div className="flex h-24 items-end p-3 md:h-28 md:p-4" style={{ background: styleArtwork[style] }}>
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
          <div className="grid gap-3 sm:grid-cols-3">
            {budgetKeys.map((budget) => {
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
    </div>
  );
}
