"use client";

import { LoaderCircle } from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { Button, SectionTitle, Surface } from "@/components/ui/primitives";
import {
  consumeStageTransition,
  getTransitionFallbackPath,
  getTransitionNextPath,
  type ProjectStageTransition
} from "@/lib/projects/transition";

const AUTO_FORWARD_DELAY_MS = 1000;
const FALLBACK_DELAY_MS = 1200;

type TransitionState =
  | { type: "loading" }
  | {
      type: "ready";
      transition: ProjectStageTransition;
      nextPath: string;
      fallbackPath: string;
      confirmed: boolean;
    }
  | { type: "fallback"; fallbackPath: string };

export function ProjectTransitionScreen({
  projectId,
  onConfirm,
  navigate,
  storage
}: {
  projectId: string;
  onConfirm?: (transition: ProjectStageTransition) => void;
  navigate?: (path: string) => void;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}) {
  const nav = navigate ?? ((path: string) => window.location.assign(path));
  const navRef = useRef(nav);
  navRef.current = nav;

  const [state, setState] = useState<TransitionState>({ type: "loading" });

  useEffect(() => {
    const transition = consumeStageTransition(projectId, storage);
    const fallbackPath = getTransitionFallbackPath(projectId);

    if (!transition) {
      setState({ type: "fallback", fallbackPath });
      const timer = window.setTimeout(() => navRef.current(fallbackPath), FALLBACK_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    const nextPath = getTransitionNextPath(transition);
    if (transition.mode === "auto") {
      setState({
        type: "ready",
        transition,
        nextPath,
        fallbackPath,
        confirmed: true
      });
      const timer = window.setTimeout(() => navRef.current(nextPath), AUTO_FORWARD_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    setState({
      type: "ready",
      transition,
      nextPath,
      fallbackPath,
      confirmed: false
    });

    return undefined;
  }, [projectId, storage]);

  if (state.type === "loading") {
    return (
      <Surface className="grid min-h-[320px] place-items-center p-8">
        <div className="grid justify-items-center gap-3 text-center">
          <LoaderCircle size={24} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--muted)]">正在准备下一步...</p>
        </div>
      </Surface>
    );
  }

  if (state.type === "fallback") {
    return (
      <Surface className="grid min-h-[320px] place-items-center p-8">
        <div className="grid max-w-lg justify-items-center gap-5 text-center">
          <SectionTitle title="未找到过渡信息" description="将返回项目页继续流程。" />
          <Button type="button" onClick={() => navRef.current(state.fallbackPath)}>
            返回项目
          </Button>
        </div>
      </Surface>
    );
  }

  const { transition, nextPath, fallbackPath, confirmed } = state;

  if (transition.mode === "confirm" && !confirmed) {
    return (
      <Surface className="grid min-h-[320px] place-items-center p-8">
        <div className="grid max-w-xl gap-6 text-center">
          <SectionTitle
            title={transition.title ?? "确认继续下一步？"}
            description={transition.description ?? "确认后将继续到下一步骤。"}
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navRef.current(fallbackPath);
              }}
            >
              {transition.cancel ?? "取消"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirm?.(transition);
                navRef.current(nextPath);
              }}
            >
              {transition.cta ?? "继续"}
            </Button>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="grid min-h-[320px] place-items-center p-8">
      <div className="grid justify-items-center gap-4 text-center">
        <LoaderCircle size={26} className="animate-spin text-[var(--accent)]" />
        <SectionTitle title={transition.title ?? "正在进入下一步"} description={transition.description ?? "请稍候..."} />
      </div>
    </Surface>
  );
}
