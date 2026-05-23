// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterviewPanel } from "@/components/interview-panel";

const beginStageTransitionMock = vi.fn();

vi.mock("@/lib/projects/transition", () => ({
  beginStageTransition: (...args: unknown[]) => beginStageTransitionMock(...args)
}));

const analysis = {
  rooms: [{ name: "客厅", type: "living_dining" as const, confidence: 0.9 }],
  relationships: ["客厅连接阳台"],
  issues: [],
  uncertainItems: [],
  userCorrections: []
};

const preference = {
  style: "warm_wood" as const,
  budgetTier: "quality" as const,
  naturalLanguagePreference: "希望空间更温暖，也更好收纳",
  lifestyleNotes: [],
  hardConstraints: [],
  adoptedSuggestions: [],
  rejectedSuggestions: []
};

const initialConversation = [
  {
    id: "agent-1",
    role: "agent",
    content: "你最想先优化哪个空间？",
    metadataJson: {
      type: "designer_prompt" as const,
      message: "你最想先优化哪个空间？",
      options: ["客厅", "次卧"],
      progress: { current: 1, max: 12 as const }
    }
  }
];

describe("InterviewPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    beginStageTransitionMock.mockReset();
  });

  it("shows the completion summary before entering the transition flow", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "complete",
        summary: "好的，我已经整理完你的核心需求，接下来开始生成方案。",
        nextPath: "/generating"
      })
    } as Response);

    render(
      React.createElement(InterviewPanel, {
        projectId: "p1",
        status: "INTERVIEWING",
        analysis,
        preference,
        initialConversation
      })
    );

    fireEvent.change(screen.getByPlaceholderText("输入你的想法，比如‘次卧平时不住人，希望能兼顾书房和收纳’"), {
      target: { value: "先看看次卧和收纳的组合方式。" }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "发送回答" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("好的，我已经整理完你的核心需求，接下来开始生成方案。")).not.toBeNull();
    expect(beginStageTransitionMock).not.toHaveBeenCalled();
    expect(screen.getByText("设计师已整理完本轮沟通，正在为你准备下一步。")).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1399);
    });
    expect(beginStageTransitionMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(beginStageTransitionMock).toHaveBeenCalledWith({
      projectId: "p1",
      from: "interview",
      to: "generating",
      nextPath: "/generating"
    });
  });
});
