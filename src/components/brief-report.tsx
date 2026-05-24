"use client";

import { useState } from "react";
import { Download, FileText, Image as ImageIcon, LayoutPanelLeft, Lightbulb, Ruler } from "lucide-react";
import { budgetLabels, roomLabels, styleLabels } from "@/lib/projects/labels";
import { Surface } from "@/components/ui/primitives";
import type { DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

type RenderingAsset = {
  id: string;
  spaceType: string;
  prompt: string;
  imageUrl: string | null;
  status: string;
};

export function BriefReport({
  projectId,
  projectName,
  analysis,
  preference,
  plan,
  renderings
}: {
  projectId: string;
  projectName: string;
  analysis: FloorPlanAnalysis;
  preference: PreferenceProfile;
  plan: DesignPlan;
  renderings: RenderingAsset[];
}) {
  const sections = [
    { id: "overview", label: "项目概览", icon: <LayoutPanelLeft size={16} /> },
    { id: "analysis", label: "户型分析", icon: <Ruler size={16} /> },
    { id: "needs", label: "需求摘要", icon: <Lightbulb size={16} /> },
    { id: "spaces", label: "重点空间", icon: <ImageIcon size={16} /> }
  ];

  const [regenerating, setRegenerating] = useState(false);
  const firstRendering = renderings.find((item) => item.imageUrl)?.imageUrl ?? null;

  async function regeneratePlan() {
    setRegenerating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/regenerate`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { nextPath: string };
      window.location.assign(payload.nextPath);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "重新生成失败，请稍后重试。");
      setRegenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8">
      <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Surface className="h-fit p-5">
          <div className="mb-6">
            <p className="text-xs font-medium text-[var(--muted)]">{projectName}</p>
            <h1 className="mt-2 text-xl font-semibold">{styleLabels[preference.style]}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {budgetLabels[preference.budgetTier].title}（{budgetLabels[preference.budgetTier].range}）
            </p>
          </div>

          <nav className="grid gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
              >
                {section.icon}
                {section.label}
              </a>
            ))}
          </nav>
        </Surface>

        <div className="grid gap-6">
          <Surface className="grid gap-6 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-4xl">
                <p className="text-sm font-medium text-[var(--accent)]">装修小案</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal">{projectName}</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                  <p className="font-semibold text-[var(--foreground)]">{plan.styleSummary}</p>
                  <p>{plan.overallStrategy}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <button
                  type="button"
                  onClick={() => void regeneratePlan()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-5 py-2 text-sm font-medium whitespace-nowrap transition hover:bg-[var(--panel-soft)]"
                >
                  {regenerating ? "重新生成中..." : "重新生成方案"}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign(`/projects/${projectId}/complete`)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-5 py-2 text-sm font-medium whitespace-nowrap transition hover:bg-[var(--panel-soft)]"
                >
                  <FileText size={16} />
                  返回完成页
                </button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_360px]">
              <section id="overview" className="grid gap-4">
                <div>
                  <h3 className="text-xl font-semibold">方案概览</h3>
                  <ul className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted)]">
                    <li>围绕 {styleLabels[preference.style]} 的整体气质，优先保证空间通透感与长期耐看。</li>
                    <li>{plan.budgetAssumptions}</li>
                    <li>{plan.disclaimer}</li>
                  </ul>
                </div>
                <section id="analysis" className="grid gap-3">
                  <h3 className="text-xl font-semibold">户型分析</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoCard title="空间关系" body={analysis.relationships.join("，")} />
                    <InfoCard title="待关注问题" body={analysis.issues.map((item) => item.description).join("，")} />
                  </div>
                </section>
                <section id="needs" className="grid gap-3">
                  <h3 className="text-xl font-semibold">需求摘要</h3>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-sm leading-7 text-[var(--muted)]">
                    <p>{preference.naturalLanguagePreference}</p>
                    {preference.adoptedSuggestions.length > 0 ? (
                      <p className="mt-3">已采纳建议：{preference.adoptedSuggestions.join("，")}</p>
                    ) : null}
                    {preference.lifestyleNotes.length > 0 ? (
                      <p className="mt-3">生活方式：{preference.lifestyleNotes.join("，")}</p>
                    ) : null}
                  </div>
                </section>
              </section>

              <div className="overflow-hidden rounded-[24px] bg-[var(--panel-soft)]">
                {firstRendering ? (
                  <img src={firstRendering} alt="主要效果图" className="h-full min-h-[360px] w-full object-cover" />
                ) : (
                  <div className="grid min-h-[360px] place-items-center text-sm text-[var(--muted)]">效果图生成后会显示在这里</div>
                )}
              </div>
            </div>
          </Surface>

          <Surface className="grid gap-4 p-6" id="spaces">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">重点空间方案</h3>
              <button
                type="button"
                onClick={() => window.location.assign(`/projects/${projectId}/complete`)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium"
              >
                <Download size={16} />
                查看交付物
              </button>
            </div>
            <div className="grid gap-5">
              {plan.keySpaces.map((space, index) => {
                const rendering =
                  renderings.find((item) => item.prompt === space.renderingPrompt && item.imageUrl) ??
                  renderings.find((item) => item.spaceType === space.spaceType && item.imageUrl);
                return (
                  <div key={`${space.spaceType}-${space.title}-${index}`} className="grid gap-4 rounded-[24px] border border-[var(--line)] p-5 lg:grid-cols-[minmax(0,1.1fr)_320px]">
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs font-medium text-[var(--accent)]">{roomLabels[space.spaceType]}</p>
                        <h4 className="mt-1 text-xl font-semibold">{space.title}</h4>
                      </div>
                      <p className="text-sm leading-7 text-[var(--muted)]">{space.explanation}</p>
                      <InfoCard title="设计目标" body={space.designGoal} />
                      <InfoCard title="布局建议" body={space.layoutSuggestion} />
                      <InfoCard title="预算取舍" body={space.budgetTradeOffs} />
                    </div>
                    <div className="overflow-hidden rounded-[20px] bg-[var(--panel-soft)]">
                      {rendering?.imageUrl ? (
                        <img src={rendering.imageUrl} alt={space.title} className="h-full min-h-[280px] w-full object-cover" />
                      ) : (
                        <div className="grid min-h-[280px] place-items-center text-sm text-[var(--muted)]">该空间效果图正在准备中</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</div>
    </div>
  );
}
