"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, LoaderCircle, Sparkles, XCircle } from "lucide-react";
import { Button, Surface, cx } from "@/components/ui/primitives";
import type { DesignPlan, GenerationStatus } from "@/lib/domain/schemas";
import { beginStageTransition } from "@/lib/projects/transition";

type RenderingSummary = {
  id: string;
  spaceType: string;
  imageUrl: string | null;
  status: string;
};

type GenerateResponse = {
  status: GenerationStatus;
  plan: DesignPlan;
  renderings: RenderingSummary[];
  brief: { id: string; status: string };
  nextPath: string;
};

const taskDescriptions: Record<GenerationStatus["tasks"][number]["key"], string> = {
  requirement_profile: "正在整理你的生活方式、空间诉求和设计偏好。",
  plan: "正在生成整体设计策略、重点空间布局和材质方向。",
  spaces: "正在拆解重点空间方案，整理更具体的说明。",
  renderings: "正在生成效果图预览，帮助你更直观理解空间氛围。",
  brief: "正在整理 PDF brief 和最终交付物。"
};

export function GenerationStatusPanel({
  projectId,
  initialStatus,
  initialRenderings
}: {
  projectId: string;
  initialStatus: string;
  initialRenderings: RenderingSummary[];
}) {
  const [tasks, setTasks] = useState<GenerationStatus["tasks"]>([
    { key: "requirement_profile", label: "整理需求画像", status: "running" },
    { key: "plan", label: "生成整体设计策略", status: "waiting" },
    { key: "spaces", label: "生成重点空间方案", status: "waiting" },
    { key: "renderings", label: "生成效果图", status: "waiting" },
    { key: "brief", label: "生成 PDF brief", status: "waiting" }
  ]);
  const [previewImage, setPreviewImage] = useState<string | null>(initialRenderings[0]?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runningTask = useMemo(
    () => tasks.find((task) => task.status === "running") ?? tasks.find((task) => task.status === "waiting") ?? tasks[tasks.length - 1],
    [tasks]
  );

  useEffect(() => {
    if (startedRef.current || initialStatus === "BRIEF_READY") {
      return;
    }

    startedRef.current = true;
    const timer = window.setInterval(() => {
      setTasks((current) => {
        const next = current.map((task) => ({ ...task }));
        const currentIndex = next.findIndex((task) => task.status === "running");

        if (currentIndex < 0 || currentIndex >= next.length - 1) {
          return current;
        }

        next[currentIndex].status = "done";
        next[currentIndex + 1].status = "running";
        return next;
      });
    }, 2200);

    void fetch(`/api/projects/${projectId}/generate`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }

        return (await response.json()) as GenerateResponse;
      })
      .then((payload) => {
        window.clearInterval(timer);
        setTasks(payload.status.tasks);
        setPreviewImage(payload.renderings.find((item) => item.imageUrl)?.imageUrl ?? null);
        window.setTimeout(() => {
          beginStageTransition({
            projectId,
            from: "generating",
            to: "complete",
            nextPath: payload.nextPath
          });
        }, 900);
      })
      .catch((requestError) => {
        window.clearInterval(timer);
        setError(requestError instanceof Error ? requestError.message : "生成失败，请稍后重试。");
        setTasks((current) =>
          current.map((task, index) =>
            task.status === "running"
              ? { ...task, status: "failed", error: "生成失败" }
              : index < current.findIndex((item) => item.status === "running")
                ? { ...task, status: "done" }
                : task
          )
        );
      });

    return () => window.clearInterval(timer);
  }, [initialStatus, projectId]);

  useEffect(() => {
    if (initialStatus === "BRIEF_READY") {
      setTasks((current) => current.map((task) => ({ ...task, status: "done" })));
    }
  }, [initialStatus]);

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Surface className="grid gap-4 p-5">
        {tasks.map((task) => (
          <div key={task.key} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-[var(--accent)]">{renderTaskIcon(task.status)}</div>
              <div className="grid gap-1">
                <div className="text-sm font-semibold">{task.label}</div>
                <div className="text-sm leading-6 text-[var(--muted)]">{taskDescriptions[task.key]}</div>
                {task.error ? <div className="text-sm text-[#b7443b]">{task.error}</div> : null}
              </div>
            </div>
          </div>
        ))}
        {error ? (
          <div className="grid gap-3 rounded-2xl border border-[#f1c8c4] bg-[#fff4f3] p-4">
            <p className="text-sm text-[#b7443b]">{error}</p>
            <Button type="button" onClick={() => window.location.reload()}>
              重试生成
            </Button>
          </div>
        ) : null}
      </Surface>

      <Surface className="grid gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">生成预览</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {runningTask ? `${runningTask.label}中` : "正在整理结果"}
          </p>
        </div>

        <div className="overflow-hidden rounded-[24px] bg-[var(--panel-soft)]">
          {previewImage ? (
            <img src={previewImage} alt="效果图预览" className="h-[360px] w-full object-cover" />
          ) : (
            <div className="grid h-[360px] place-items-center bg-[linear-gradient(135deg,#eef3ff,#f7f9fc)] text-[var(--muted)]">
              <div className="grid place-items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[var(--accent)] shadow-[0_10px_30px_rgba(45,104,255,0.16)]">
                  <Sparkles size={26} />
                </div>
                <div className="text-sm leading-6">{runningTask ? taskDescriptions[runningTask.key] : "正在准备预览"}</div>
              </div>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}

function renderTaskIcon(status: GenerationStatus["tasks"][number]["status"]) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={18} />;
    case "running":
      return <LoaderCircle size={18} className="animate-spin" />;
    case "failed":
      return <XCircle size={18} className="text-[#b7443b]" />;
    default:
      return <Clock3 size={18} className="text-[#96a0b2]" />;
  }
}
