"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { budgetLabels, roomLabels, styleLabels } from "@/lib/projects/labels";
import { Button, FieldInput, Surface, cx } from "@/components/ui/primitives";
import type { AgentInterviewResponse, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";
import { beginStageTransition } from "@/lib/projects/transition";

const COMPLETE_MESSAGE_VISIBLE_MS = 1400;

type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  metadataJson?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.startsWith("<!DOCTYPE html>") || message.startsWith("<html")) {
      return "请求失败，服务暂时没有正确返回内容，请稍后重试。";
    }
    return message;
  }

  return "请求失败，请稍后重试。";
}

function parseAgentMetadata(value: unknown): AgentInterviewResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AgentInterviewResponse> & { type?: string };
  if (candidate.type === "designer_prompt" || candidate.type === "suggestion" || candidate.type === "complete") {
    return candidate as AgentInterviewResponse;
  }

  return null;
}

export function InterviewPanel({
  projectId,
  status,
  analysis,
  preference,
  initialConversation
}: {
  projectId: string;
  status: string;
  analysis: FloorPlanAnalysis;
  preference: PreferenceProfile;
  initialConversation: ConversationMessage[];
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [draft, setDraft] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedTransition, setCompletedTransition] = useState<{ nextPath: string } | null>(null);
  const initializedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const latestAgentTurn = useMemo(() => {
    const latestAgentMessage = [...conversation].reverse().find((item) => item.role === "agent");
    return parseAgentMetadata(latestAgentMessage?.metadataJson);
  }, [conversation]);

  const latestProgressTurn = useMemo(() => {
    const latestProgressMessage = [...conversation].reverse().find((item) => {
      if (item.role !== "agent") {
        return false;
      }

      const metadata = parseAgentMetadata(item.metadataJson);
      return Boolean(metadata && "progress" in metadata);
    });

    return parseAgentMetadata(latestProgressMessage?.metadataJson);
  }, [conversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, pending, completedTransition]);

  useEffect(() => {
    if (!completedTransition) {
      return;
    }

    const timer = window.setTimeout(() => {
      beginStageTransition({
        projectId,
        from: "interview",
        to: "generating",
        nextPath: completedTransition.nextPath
      });
    }, COMPLETE_MESSAGE_VISIBLE_MS);

    return () => window.clearTimeout(timer);
  }, [completedTransition, projectId]);

  useEffect(() => {
    if (initializedRef.current || conversation.some((item) => item.role === "agent")) {
      return;
    }

    initializedRef.current = true;
    void requestNextTurn("start");
  }, [conversation]);

  async function requestNextTurn(action: "start" | "answer", answer = "") {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    setPending(true);
    setError(null);

    try {
      if (action === "answer" && answer.trim()) {
        setConversation((current) => [
          ...current,
          {
            id: `user-${Date.now()}`,
            role: "user",
            content: answer.trim()
          }
        ]);
      }

      const response = await fetch(`/api/projects/${projectId}/agent/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          answer
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as AgentInterviewResponse;

      if (payload.type === "complete") {
        setConversation((current) => [
          ...current,
          {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: payload.summary,
            metadataJson: payload
          }
        ]);
        setCompletedTransition({ nextPath: `/projects/${projectId}/payment` });
        return;
      }

      setConversation((current) => [
        ...current,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: payload.message,
          metadataJson: payload
        }
      ]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      requestInFlightRef.current = false;
      setPending(false);
    }
  }

  const progress = latestProgressTurn && "progress" in latestProgressTurn ? latestProgressTurn.progress : { current: 0, max: 12 };
  const isLocked = pending || completedTransition !== null;

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
            <SummaryItem
              label="预算"
              value={`${budgetLabels[preference.budgetTier].title}（${budgetLabels[preference.budgetTier].range}）`}
            />
            <SummaryItem label="补充需求" value={preference.naturalLanguagePreference} />
            <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">追问进度</span>
                <span className="text-[var(--muted)]">
                  {progress.current}/{progress.max}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.max(8, (progress.current / progress.max) * 100)}%` }}
                />
              </div>
            </div>
          </aside>
        ) : null}

        <div className="grid flex-1 auto-rows-max content-start gap-4 overflow-y-auto rounded-[24px] bg-[var(--panel-soft)] p-4">
          {conversation.map((message) => (
            <div
              key={message.id}
              className={cx("max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6", message.role === "user"
                ? "ml-auto bg-[var(--accent)] text-white"
                : "bg-white text-[var(--foreground)] shadow-[0_10px_24px_rgba(18,35,71,0.06)]")}
            >
              {message.content}
            </div>
          ))}
          {pending ? (
            <div className="flex max-w-[88%] items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-[var(--muted)] shadow-[0_10px_24px_rgba(18,35,71,0.06)]">
              <LoaderCircle size={16} className="animate-spin" />
              设计师正在判断下一步...
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {latestAgentTurn && latestAgentTurn.type !== "complete" && latestAgentTurn.options?.length ? (
          <div className="flex flex-wrap gap-2">
            {latestAgentTurn.options.map((option) => (
              <Button
                key={option}
                type="button"
                variant="secondary"
                disabled={isLocked}
                onClick={() => setDraft(option)}
                className="px-3 py-2"
              >
                {option}
              </Button>
            ))}
          </div>
          ) : null}

        <form
          className="grid gap-3 border-t border-[var(--line)] pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim() || isLocked) {
              return;
            }

            const answer = draft;
            setDraft("");
            void requestNextTurn("answer", answer);
          }}
        >
          <FieldInput
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={completedTransition !== null}
            placeholder="输入你的想法，比如‘次卧平时不住人，希望能兼顾书房和收纳’"
          />
          <div className="flex items-center justify-between">
            {error ? (
              <p className="text-sm text-[#b7443b]">{error}</p>
            ) : completedTransition ? (
              <p className="text-sm text-[var(--muted)]">设计师已整理完本轮沟通，正在为你准备下一步。</p>
            ) : (
              <div />
            )}
            <Button type="submit" disabled={isLocked || !draft.trim()}>
              <Send size={16} />
              发送回答
            </Button>
          </div>
        </form>
      </Surface>

      <Surface className="hidden h-fit gap-4 p-5 lg:grid">
        <div>
          <h3 className="text-base font-semibold">项目摘要</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">设计师会持续参考这些信息做判断。</p>
        </div>

        <aside className="grid gap-3 text-sm">
          <SummaryItem label="户型" value={analysis.rooms.map((room) => roomLabels[room.type]).join(" / ")} />
          <SummaryItem label="风格" value={styleLabels[preference.style]} />
          <SummaryItem
            label="预算"
            value={`${budgetLabels[preference.budgetTier].title}（${budgetLabels[preference.budgetTier].range}）`}
          />
          <SummaryItem label="补充需求" value={preference.naturalLanguagePreference} />
        </aside>

        <div className="rounded-2xl border border-[var(--line)] p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">追问进度</span>
            <span className="text-[var(--muted)]">
              {progress.current}/{progress.max}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${Math.max(8, (progress.current / progress.max) * 100)}%` }}
            />
          </div>
        </div>
      </Surface>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className="mt-1 leading-6 text-[var(--foreground)]">{value}</div>
    </div>
  );
}
