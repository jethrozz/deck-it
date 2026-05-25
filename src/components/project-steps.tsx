"use client";

import type { ReactNode } from "react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  House,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircleMore,
  RefreshCcw,
  ScanSearch,
  Sparkles,
  SquarePen,
  UploadCloud
} from "lucide-react";
import { AnalysisSummary } from "@/components/analysis-summary";
import { GenerationStatusPanel } from "@/components/generation-status";
import { InterviewPanel } from "@/components/interview-panel";
import { StyleBudgetCards } from "@/components/style-budget-cards";
import { Button, FieldInput, FieldTextarea, SectionTitle, Surface } from "@/components/ui/primitives";
import type { BudgetTier, FloorPlanAnalysis, PreferenceProfile, Style } from "@/lib/domain/schemas";
import { beginStageTransition } from "@/lib/projects/transition";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

export function CreateProjectHero() {
  const heroFeatures = [
    { icon: <ScanSearch size={22} />, label: "户型分析" },
    { icon: <Sparkles size={22} />, label: "风格匹配" },
    { icon: <MessageCircleMore size={22} />, label: "需求洞察" },
    { icon: <House size={22} />, label: "方案生成" },
    { icon: <SquarePen size={22} />, label: "PDF brief" }
  ];

  return (
    <main className="min-h-screen bg-[#050914] p-3 text-white md:p-6">
      <div
        className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#040915] md:min-h-[calc(100vh-3rem)] md:rounded-[40px]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(4,9,21,0.96) 0%, rgba(4,9,21,0.92) 38%, rgba(4,9,21,0.5) 63%, rgba(4,9,21,0.28) 100%), url('/home-hero-reference.png')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_54%,rgba(38,130,255,0.18),transparent_34%),radial-gradient(circle_at_72%_22%,rgba(99,117,255,0.18),transparent_26%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1.05fr)_520px] lg:px-12 lg:py-10">
          <section className="flex min-h-0 flex-col gap-8 lg:min-h-[720px] lg:justify-between">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#5d74ff]/40 bg-[linear-gradient(180deg,rgba(50,101,255,0.18),rgba(131,89,255,0.14))] shadow-[0_18px_40px_rgba(45,104,255,0.18)]">
                  <House size={22} className="text-[#86a3ff]" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-[28px] font-semibold leading-none tracking-tight text-white">装它</span>
                  <span className="pb-0.5 text-base font-medium text-white/70">deck it</span>
                </div>
              </div>

              <div className="hidden rounded-2xl border border-white/12 bg-white/6 px-5 py-3 text-sm text-white/88 shadow-[0_18px_44px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:flex lg:items-center lg:gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/16 bg-white/6">
                  <House size={16} className="text-[#9db3ff]" />
                </div>
                AI 设计师，为你的家提供专业设计建议
              </div>
            </div>

            <div className="grid max-w-3xl gap-6">
              <div className="grid gap-5">
                <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-7xl">
                  AI 设计师
                  <br />
                  让装修想法从无到有
                </h1>
                <div className="h-px w-44 bg-[linear-gradient(90deg,rgba(30,187,255,0),rgba(30,187,255,1)_38%,rgba(132,107,255,0.45)_100%)] shadow-[0_0_24px_rgba(30,187,255,0.55)]" />
                <p className="max-w-2xl text-base leading-7 text-white/78 md:text-2xl md:leading-[1.9]">为你梳理思路，提供专业的设计建议，沉淀装修前的沟通 brief</p>
              </div>

              <div className="hidden max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid lg:grid-cols-5">
                {heroFeatures.map((feature) => (
                  <div key={feature.label} className="grid justify-items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-center backdrop-blur">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#5d74ff]/30 bg-[linear-gradient(180deg,rgba(28,45,94,0.46),rgba(11,19,43,0.72))] text-[#62c5ff] shadow-[0_18px_40px_rgba(34,102,255,0.16)] backdrop-blur-xl">
                      {feature.icon}
                    </div>
                    <span className="text-sm font-medium text-white/88 md:text-lg">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden max-w-[760px] gap-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,34,0.84),rgba(8,14,29,0.7))] px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.26)] backdrop-blur-xl lg:grid lg:grid-cols-[1.1fr_1fr]">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {["#d9dde8", "#f1dfd5", "#d2c5bb"].map((color, index) => (
                    <div
                      key={color}
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#0b1020] text-sm font-semibold text-[#1a2033]"
                      style={{ backgroundColor: color, zIndex: 3 - index }}
                    >
                      {["L", "Z", "W"][index]}
                    </div>
                  ))}
                </div>
                <div className="grid gap-1">
                  <div className="text-3xl font-semibold text-white">已帮助 1000+ 业主</div>
                  <div className="text-xl leading-8 text-white/72">理清需求，收获理想的家</div>
                  <div className="text-[22px] tracking-[0.3em] text-[#ffcf53]">★★★★★</div>
                </div>
              </div>
              <div className="flex items-center justify-center text-center">
                <div className="grid gap-2">
                  <div className="text-3xl font-semibold text-white">专注装修前沟通</div>
                  <div className="text-xl leading-8 text-white/72">轻量设计 brief 方案</div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-end justify-stretch lg:items-center lg:justify-end">
            <Surface className="w-full max-w-[480px] rounded-[28px] border border-[#5073ff]/55 bg-[linear-gradient(180deg,rgba(15,23,54,0.92),rgba(12,18,41,0.86))] p-6 text-white shadow-[0_0_0_1px_rgba(110,137,255,0.14),0_34px_90px_rgba(13,21,48,0.58),0_0_42px_rgba(48,92,255,0.26)] backdrop-blur-2xl md:rounded-[36px] md:p-10">
              <div className="grid gap-7">
                <div className="grid gap-3">
                  <h2 className="text-5xl font-semibold tracking-tight text-white">创建新项目</h2>
                </div>

                <form action="/api/projects" method="post" className="grid gap-6">
                  <label className="grid gap-3 text-base">
                    <span className="font-medium text-white/88">项目名称</span>
                    <FieldInput
                      name="name"
                      required
                      defaultValue="温暖的小家"
                      className="h-20 rounded-[20px] border border-white/12 bg-[rgba(245,247,255,0.92)] px-6 text-2xl font-medium text-[#182033] placeholder:text-[#7f8799] focus:border-[#6286ff]"
                      placeholder="例如：温暖的小家"
                    />
                  </label>
                  <Button
                    type="submit"
                    className="h-22 w-full justify-center rounded-[20px] bg-[linear-gradient(90deg,#5a72ff_0%,#2e61ff_100%)] py-6 text-[26px] font-semibold shadow-[0_22px_50px_rgba(41,88,255,0.32)]"
                  >
                    开始创建
                    <ArrowRight size={28} />
                  </Button>
                </form>

              </div>
            </Surface>
          </div>
        </div>
      </div>
    </main>
  );
}

export function UploadStep({ projectId }: { projectId: string }) {
  const [isReady, setIsReady] = useState(false);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function handleFileSelect(file: File) {
    setBusy(true);
    setError(null);
    setFileName(file.name);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      window.sessionStorage.setItem(
        `deck-it:pending-floor-plan:${projectId}`,
        JSON.stringify({
          name: file.name,
          type: file.type,
          dataUrl
        })
      );
      window.location.assign(`/projects/${projectId}/analysis/loading`);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Surface data-testid="upload-dropzone" className="grid place-items-center border-dashed p-6 md:p-8">
        <div className="grid max-w-md justify-items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <UploadCloud size={28} />
          </div>
          <div className="grid gap-2">
            <h2 className="text-2xl font-semibold">上传户型图</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">支持 JPG / PNG 格式，建议上传清晰的户型图。</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFileSelect(file);
              }
            }}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={!isReady || busy}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
            选择图片
          </Button>
          {fileName ? <p className="text-sm text-[var(--muted)]">已选择：{fileName}</p> : null}
          {error ? <p className="text-sm text-[#b7443b]">{error}</p> : null}
        </div>
      </Surface>

      <Surface data-testid="upload-tips" className="grid h-fit gap-3 p-4 md:p-5">
        <h3 className="text-base font-semibold">上传建议</h3>
        <ul className="grid gap-3 text-sm leading-6 text-[var(--muted)]">
          <li>确保户型图清晰可见。</li>
          <li>包含尺寸或标注会更准确。</li>
          <li>尽量完整展示所有房间。</li>
        </ul>
      </Surface>
    </div>
  );
}

export function AnalysisLoadingStep({
  projectId,
  currentStatus
}: {
  projectId: string;
  currentStatus: string;
}) {
  const [progress, setProgress] = useState(currentStatus === "FLOOR_PLAN_ANALYZED" ? 100 : 18);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || currentStatus === "FLOOR_PLAN_ANALYZED") {
      return;
    }

    startedRef.current = true;
    const payload = window.sessionStorage.getItem(`deck-it:pending-floor-plan:${projectId}`);

    if (!payload) {
      setError("没有找到待分析的户型图，请返回重新上传。");
      return;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(current + Math.round(Math.random() * 12), 88));
    }, 700);

    void (async () => {
      try {
        const parsed = JSON.parse(payload) as { name: string; type: string; dataUrl: string };
        const file = await dataUrlToFile(parsed.dataUrl, parsed.name, parsed.type);
        const formData = new FormData();
        formData.append("floorPlan", file);

        const response = await fetch(`/api/projects/${projectId}/floor-plan`, {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const result = (await response.json()) as { nextPath: string };
        window.sessionStorage.removeItem(`deck-it:pending-floor-plan:${projectId}`);
        window.clearInterval(timer);
        setProgress(100);
        window.setTimeout(() => {
          window.location.assign(result.nextPath);
        }, 500);
      } catch (requestError) {
        window.clearInterval(timer);
        setError(getErrorMessage(requestError));
      }
    })();
  }, [currentStatus, projectId]);

  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Surface className="grid min-h-[360px] place-items-center p-6 md:min-h-[420px] md:p-8">
        <div className="grid max-w-md justify-items-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(45,104,255,0.2),rgba(45,104,255,0.08)_58%,transparent_60%)] text-[var(--accent)]">
            <LoaderCircle size={30} className="animate-spin" />
          </div>
          <div className="grid gap-2">
            <h2 className="text-2xl font-semibold">正在识别户型信息...</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">正在分析房间布局、采光和空间关系。</p>
          </div>
          <div className="w-full">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">{progress}%</div>
          </div>
          {error ? <p className="text-sm text-[#b7443b]">{error}</p> : <p className="text-sm text-[var(--muted)]">预计需要 30-60 秒，请稍候。</p>}
        </div>
      </Surface>

      <Surface className="grid h-fit gap-3 p-4 md:p-5">
        <h3 className="text-base font-semibold">识别任务</h3>
        <ul className="grid gap-3 text-sm text-[var(--muted)]">
          {["识别房间", "分析采光", "空间关系", "动线分析", "收纳分析"].map((item, index) => (
            <li key={item} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--panel-soft)] text-xs text-[var(--accent)]">
                {index + 1}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Surface>
    </div>
  );
}

export function AnalysisConfirmStep({
  projectId,
  floorPlanUrl,
  analysis
}: {
  projectId: string;
  floorPlanUrl?: string | null;
  analysis: FloorPlanAnalysis;
}) {
  const [isReady, setIsReady] = useState(false);
  const [corrections, setCorrections] = useState(analysis.userCorrections.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function submit(correctionItems: string[]) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCorrections: correctionItems })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { nextPath?: string };
      beginStageTransition({
        projectId,
        from: "analysis",
        to: "preferences",
        nextPath: payload.nextPath
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_420px]">
      <Surface data-testid="analysis-preview" className="grid min-h-[320px] place-items-center overflow-hidden p-3 md:min-h-[560px] md:p-4">
        {floorPlanUrl ? (
          <img src={floorPlanUrl} alt="户型图" className="max-h-[520px] w-full rounded-[24px] object-contain" />
        ) : (
          <div className="text-sm text-[var(--muted)]">暂无户型图</div>
        )}
      </Surface>

      <div className="grid gap-4">
        <div data-testid="analysis-summary-card">
          <AnalysisSummary analysis={analysis} />
        </div>
        <Surface className="grid gap-4 p-4 md:p-5">
          <div className="grid gap-2">
            <h3 className="text-base font-semibold">以上分析准确吗？</h3>
            <p className="text-sm text-[var(--muted)]">有需要补充或修改的地方，也可以一起告诉我。</p>
          </div>
          <FieldTextarea
            rows={5}
            value={corrections}
            onChange={(event) => setCorrections(event.target.value)}
            placeholder="例如：次卧其实更像书房，玄关区域还有鞋柜空间。"
          />
          {error ? <p className="text-sm text-[#b7443b]">{error}</p> : null}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={!isReady || busy}
              onClick={() => void submit([])}
            >
              跳过，确认无误
            </Button>
            <Button
              type="button"
              disabled={!isReady || busy}
              onClick={() =>
                void submit(
                  corrections
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                )
              }
            >
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
              确认并继续
            </Button>
          </div>
        </Surface>
      </div>
    </div>
  );
}

export function PreferencesStep({
  projectId,
  initialPreference
}: {
  projectId: string;
  initialPreference?: PreferenceProfile | null;
}) {
  const [isReady, setIsReady] = useState(false);
  const [style, setStyle] = useState<Style>(initialPreference?.style ?? "modern_minimal");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>(initialPreference?.budgetTier ?? "quality");
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [notesCount, setNotesCount] = useState(initialPreference?.naturalLanguagePreference.length ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function submit() {
    const naturalLanguagePreference = notesRef.current?.value.trim() ?? "";

    if (!naturalLanguagePreference) {
      setError("请先补充你的需求和想法。");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style,
          budgetTier,
          naturalLanguagePreference,
          lifestyleNotes: [],
          hardConstraints: [],
          adoptedSuggestions: [],
          rejectedSuggestions: []
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { nextPath?: string };
      beginStageTransition({
        projectId,
        from: "preferences",
        to: "interview",
        nextPath: payload.nextPath
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <StyleBudgetCards
        selectedStyle={style}
        selectedBudget={budgetTier}
        onStyleChange={setStyle}
        onBudgetChange={setBudgetTier}
      />

      <Surface className="grid gap-4 p-4 md:p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">补充你的需求和想法</h2>
            <p className="text-sm text-[var(--muted)]">比如生活习惯、喜欢的元素、功能诉求等。</p>
          </div>
          <span className="text-xs text-[var(--muted)]">{notesCount}/300</span>
        </div>
        <FieldTextarea
          ref={notesRef}
          rows={5}
          maxLength={300}
          defaultValue={initialPreference?.naturalLanguagePreference ?? ""}
          onChange={(event) => setNotesCount(event.target.value.length)}
          placeholder="例如：希望客厅更显大，好打理；次卧兼顾书房；需要更多收纳；家里有孩子。"
        />
        <div className="flex items-center justify-between">
          {error ? <p className="text-sm text-[#b7443b]">{error}</p> : <div />}
          <Button type="button" disabled={!isReady || busy} onClick={() => void submit()}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
            保存并继续
          </Button>
        </div>
      </Surface>
    </div>
  );
}

export function GeneratingStep({
  projectId,
  status,
  renderings
}: {
  projectId: string;
  status: string;
  renderings: Array<{ id: string; spaceType: string; imageUrl: string | null; status: string }>;
}) {
  return <GenerationStatusPanel projectId={projectId} initialStatus={status} initialRenderings={renderings} />;
}

export function CompletedStep({
  projectId,
  renderings,
  briefReady
}: {
  projectId: string;
  renderings: Array<{ id: string; spaceType: string; imageUrl: string | null; status: string }>;
  briefReady: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const heroImage = renderings.find((item) => item.imageUrl)?.imageUrl ?? null;

  async function downloadBrief() {
    setDownloading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/brief`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "renovation-brief.pdf";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  async function regeneratePlan() {
    setRegenerating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/regenerate`, { method: "POST" });
      if (response.status === 402) {
        const payload = (await response.json()) as { nextPath?: string };
        if (payload.nextPath) {
          window.location.assign(payload.nextPath);
          return;
        }
        throw new Error("剩余次数不足，请先完成支付。");
      }
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { nextPath: string };
      window.location.assign(payload.nextPath);
    } catch (error) {
      window.alert(getErrorMessage(error));
      setRegenerating(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Surface className="order-2 grid gap-5 p-5 md:p-6 lg:order-1">
        <div className="grid gap-2">
          <h2 className="text-3xl font-semibold">方案已生成完成</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">你的专属设计方案已准备就绪，可以查看、下载，也可以回到设计师追问继续补充。</p>
        </div>

        <div className="grid gap-3">
          <ResultItem icon={<FileText size={18} />} title="设计方案" description="空间规划和布局建议。" actionHref={`/projects/${projectId}/brief`} />
          <ResultItem icon={<ImageIcon size={18} />} title="效果图" description="重点空间效果展示。" actionHref={`/projects/${projectId}/brief#spaces`} />
          <ResultItem icon={<CheckCircle2 size={18} />} title="PDF brief" description={briefReady ? "可下载的沟通 brief。" : "点击即可立即生成 PDF brief。"} actionLabel="下载" onAction={downloadBrief} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Button type="button" variant="secondary" onClick={() => window.location.assign(`/projects/${projectId}/interview`)}>
            <RefreshCcw size={16} />
            重新进入追问
          </Button>
          <Button type="button" variant="secondary" onClick={() => void regeneratePlan()} disabled={regenerating}>
            {regenerating ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
            重新生成方案
          </Button>
          <Button type="button" onClick={downloadBrief} disabled={downloading} className="md:col-span-2">
            {downloading ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}
            下载 PDF brief
          </Button>
        </div>
      </Surface>

      <Surface className="order-1 overflow-hidden p-3 md:p-4 lg:order-2">
        {heroImage ? (
          <img src={heroImage} alt="方案效果图" className="h-full min-h-[420px] w-full rounded-[24px] object-cover" />
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-[24px] bg-[var(--panel-soft)] text-sm text-[var(--muted)]">效果图生成完成后会显示在这里</div>
        )}
      </Surface>
    </div>
  );
}

export function InterviewStep(props: Parameters<typeof InterviewPanel>[0]) {
  return <InterviewPanel {...props} />;
}

function ResultItem({
  icon,
  title,
  description,
  actionHref,
  actionLabel = "查看",
  onAction
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const action = actionHref ? (
    <a href={actionHref} className="text-sm font-medium text-[var(--accent)]">
      {actionLabel}
    </a>
  ) : (
    <button type="button" onClick={onAction} className="text-sm font-medium text-[var(--accent)]">
      {actionLabel}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--accent)]">{icon}</div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-sm text-[var(--muted)]">{description}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, name: string, type: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: type || blob.type });
}
