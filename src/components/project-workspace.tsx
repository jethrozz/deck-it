"use client";

import React from "react";
import { useMemo, useState } from "react";
import { FileText, Image, LoaderCircle, MessageSquare, WandSparkles } from "lucide-react";
import { BriefPreview } from "@/components/brief-preview";
import { Button } from "@/components/ui/primitives";

type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  metadataJson?: unknown;
};

type WorkspaceProject = {
  id: string;
  name: string;
  status: string;
  floorPlanUrl?: string | null;
  analysis?: { analysisJson: unknown } | null;
  preference?: { profileJson: unknown } | null;
  designPlan?: { planJson: unknown } | null;
  renderings: Array<{ id: string; spaceType: string; imageUrl: string | null; status: string }>;
  briefExports: Array<{ id: string; status: string; fileUrl: string | null; createdAt?: string }>;
  conversations: ConversationMessage[];
};

type AgentResult =
  | { type: "question"; question: { id: string; question: string; recommendation?: string; options: string[] } }
  | { type: "complete"; reason: string; nextPath?: string };

type ProjectWorkspaceProps = {
  project: WorkspaceProject;
};

const styles = [
  ["warm_wood", "原木风"],
  ["vintage", "中古风"],
  ["modern_minimal", "现代简约"],
  ["cream", "奶油风"],
  ["wabi_sabi", "侘寂风"]
] as const;

const budgets = [
  ["economy", "经济型"],
  ["quality", "品质型"],
  ["premium", "高品质型"]
] as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "操作失败，请稍后重试。";
}

export function ProjectWorkspace({ project }: ProjectWorkspaceProps) {
  const [status, setStatus] = useState(project.status);
  const [analysis, setAnalysis] = useState(project.analysis ?? null);
  const [preference, setPreference] = useState(project.preference ?? null);
  const [designPlan, setDesignPlan] = useState(project.designPlan ?? null);
  const [renderings, setRenderings] = useState(project.renderings);
  const [briefExports, setBriefExports] = useState(project.briefExports);
  const [conversation, setConversation] = useState(project.conversations);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentQuestionText =
    agentResult && agentResult.type === "question" ? agentResult.question.question : "点击获取下一步问题。";
  const isAgentActionBusy = busyAction === "agent-next-question" || busyAction === "agent-respond";

  const reverseConversation = useMemo(() => [...conversation].reverse(), [conversation]);

  async function submitJson<T>(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(raw || "请求失败");
    }

    return (await response.json()) as T;
  }

  async function runAction(actionKey: string, action: () => Promise<void>) {
    setBusyAction(actionKey);
    setError(null);
    setSuccess(null);

    try {
      await action();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="grid gap-2">
          <p className="text-sm text-[var(--muted)]">当前状态：{status}</p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          {success ? <p className="text-sm text-[var(--accent)]">{success}</p> : null}
          {error ? <p className="text-sm text-[#a6342a]">{error}</p> : null}
        </header>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Image size={20} />
            上传户型图
          </h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              runAction("analyze-floor-plan", async () => {
                const data = new FormData(form);
                const response = await fetch(`/api/projects/${project.id}/floor-plan`, {
                  method: "POST",
                  body: data
                });

                if (!response.ok) {
                  const raw = await response.text();
                  throw new Error(raw || "户型分析失败");
                }

                const payload = (await response.json()) as {
                  imageUrl: string;
                  analysis: unknown;
                };

                setAnalysis({ analysisJson: payload.analysis });
                setStatus("FLOOR_PLAN_ANALYZED");
                setSuccess("户型分析完成。");
              });
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <input
              name="floorPlan"
              type="file"
              accept="image/*"
              required
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
            <Button
              type="submit"
              loading={busyAction === "analyze-floor-plan"}
              className="rounded-md px-4 py-2"
            >
              分析户型
            </Button>
          </form>
        </section>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <WandSparkles size={20} />
            风格与预算
          </h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);

              runAction("save-preferences", async () => {
                const payload = {
                  style: data.get("style"),
                  budgetTier: data.get("budgetTier"),
                  naturalLanguagePreference: data.get("naturalLanguagePreference"),
                  lifestyleNotes: [],
                  hardConstraints: [],
                  adoptedSuggestions: [],
                  rejectedSuggestions: []
                };

                const response = await submitJson<{ profile: unknown }>(
                  `/api/projects/${project.id}/preferences`,
                  payload
                );

                setPreference({ profileJson: response.profile });
                setStatus("PREFERENCES_COLLECTED");
                setSuccess("偏好已保存。");
              });
            }}
            className="grid gap-3"
          >
            <label className="grid gap-2 text-sm">
              <span className="font-medium">预设风格</span>
              <select name="style" className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
                {styles.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="font-medium">预算档位</span>
              <select name="budgetTier" className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
                {budgets.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="font-medium">自然语言需求</span>
              <textarea
                name="naturalLanguagePreference"
                required
                rows={4}
                defaultValue="希望显大、好打理，适合一家三口。"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>

            <Button
              type="submit"
              loading={busyAction === "save-preferences"}
              className="w-fit rounded-md px-4 py-2"
            >
              保存偏好
            </Button>
          </form>
        </section>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare size={20} />
            Agent 追问
          </h2>

          <p className="rounded-md bg-[#f3f0e8] px-3 py-2 text-sm">{currentQuestionText}</p>
          {agentResult && agentResult.type === "question" && agentResult.question.recommendation ? (
            <p className="text-sm text-[var(--muted)]">建议：{agentResult.question.recommendation}</p>
          ) : null}
          {agentResult && agentResult.type === "question" ? (
            <div className="flex flex-wrap gap-2">
              {agentResult.question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswer(option)}
                  className="rounded-md border border-[var(--line)] bg-white px-3 py-1 text-sm"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              runAction("agent-respond", async () => {
                const response = await submitJson<AgentResult>(`/api/projects/${project.id}/agent/respond`, {
                  action: "answer",
                  answer
                });

                if (answer.trim().length > 0) {
                  setConversation((current) => [
                    ...current,
                    {
                      id: `local-user-${Date.now()}`,
                      role: "user",
                      content: answer.trim()
                    }
                  ]);
                }

                if (response.type === "question") {
                  setConversation((current) => [
                    ...current,
                    {
                      id: `local-agent-${response.question.id}`,
                      role: "agent",
                      content: response.question.question,
                      metadataJson: response.question
                    }
                  ]);
                  setStatus("INTERVIEWING");
                } else {
                  setStatus("INTERVIEW_COMPLETE");
                  if (response.nextPath) {
                    window.location.assign(response.nextPath);
                    return;
                  }
                }

                setAgentResult(response);
                setAnswer("");
                setSuccess(response.type === "question" ? "已生成下一条追问。" : "Agent 追问已完成。");
              });
            }}
            className="grid gap-2"
          >
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={3}
              placeholder="输入回答，或先点“获取下一步问题”。"
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() =>
                  runAction("agent-next-question", async () => {
                    const response = await submitJson<AgentResult>(`/api/projects/${project.id}/agent/respond`, {
                      action: "start",
                      answer: ""
                    });

                    if (response.type === "question") {
                      setConversation((current) => [
                        ...current,
                        {
                          id: `local-agent-${response.question.id}`,
                          role: "agent",
                          content: response.question.question,
                          metadataJson: response.question
                        }
                      ]);
                      setStatus("INTERVIEWING");
                    } else if (response.nextPath) {
                      window.location.assign(response.nextPath);
                      return;
                    }

                    setAgentResult(response);
                    setSuccess(response.type === "question" ? "已获取问题。" : "Agent 追问已完成。");
                  })
                }
                disabled={isAgentActionBusy}
                loading={busyAction === "agent-next-question"}
                className="rounded-md px-4 py-2"
              >
                获取下一步问题
              </Button>

              <Button
                type="submit"
                variant="secondary"
                disabled={isAgentActionBusy}
                loading={busyAction === "agent-respond"}
                className="rounded-md px-4 py-2"
              >
                提交回答
              </Button>
            </div>
          </form>

          <div className="grid gap-2 rounded-md border border-[var(--line)] bg-[#fcfbf8] p-3">
            <p className="text-sm font-medium">对话记录</p>
            <div className="grid max-h-48 gap-2 overflow-auto pr-1 text-sm">
              {reverseConversation.length === 0 ? <p className="text-[var(--muted)]">暂无对话。</p> : null}
              {reverseConversation.map((message) => (
                <p key={message.id}>
                  <span className="font-medium">
                    {message.role === "agent" ? "Agent" : message.role === "user" ? "你" : "系统"}：
                  </span>
                  {message.content}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText size={20} />
            方案、效果图与 PDF
          </h2>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                runAction("generate-plan", async () => {
                  const response = await submitJson<{ plan: unknown }>(
                    `/api/projects/${project.id}/design-plan`,
                    {}
                  );
                  setDesignPlan({ planJson: response.plan });
                  setStatus("PLAN_READY");
                  setSuccess("设计方案已生成。");
                })
              }
              disabled={busyAction === "generate-plan"}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
            >
              {busyAction === "generate-plan" ? <LoaderCircle size={16} className="animate-spin" /> : null}
              生成方案
            </button>

            <button
              type="button"
              onClick={() =>
                runAction("generate-renderings", async () => {
                  const response = await submitJson<{
                    renderings: Array<{
                      id: string;
                      spaceType: string;
                      imageUrl: string | null;
                      status: string;
                    }>;
                  }>(`/api/projects/${project.id}/renderings`, {});

                  setRenderings(response.renderings);
                  setStatus("RENDERINGS_READY");
                  setSuccess("效果图任务完成。");
                })
              }
              disabled={busyAction === "generate-renderings"}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
            >
              {busyAction === "generate-renderings" ? <LoaderCircle size={16} className="animate-spin" /> : null}
              生成效果图
            </button>

            <button
              type="button"
              onClick={() =>
                runAction("generate-brief", async () => {
                  const response = await submitJson<{
                    brief: { id: string; status: string; fileUrl: string | null; createdAt?: string };
                  }>(`/api/projects/${project.id}/brief`, {});

                  setBriefExports((current) => [response.brief, ...current.filter((item) => item.id !== response.brief.id)]);
                  setStatus("BRIEF_READY");
                  setSuccess("PDF brief 已生成。");
                })
              }
              disabled={busyAction === "generate-brief"}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
            >
              {busyAction === "generate-brief" ? <LoaderCircle size={16} className="animate-spin" /> : null}
              生成 PDF brief
            </button>
          </div>

          <BriefPreview
            project={{
              analysis,
              preference,
              designPlan,
              renderings,
              briefExports
            }}
          />
        </section>
      </div>
    </main>
  );
}
