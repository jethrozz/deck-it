// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "@/components/project-workspace";

vi.mock("@/components/brief-preview", () => ({
  BriefPreview: () => React.createElement("div", { "data-testid": "brief-preview" })
}));

const project = {
  id: "p1",
  name: "演示项目",
  status: "DRAFT",
  analysis: null,
  preference: null,
  designPlan: null,
  renderings: [],
  briefExports: [],
  conversations: []
};

describe("ProjectWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows loading on get-next-question and disables submit-answer with secondary button styling during the conflicting busy state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the request pending so we can observe the loading state.
          })
      )
    );

    render(React.createElement(ProjectWorkspace, { project }));

    const nextQuestionButton = screen.getByRole("button", { name: "获取下一步问题" });
    const submitAnswerButton = screen.getByRole("button", { name: "提交回答" });

    fireEvent.click(nextQuestionButton);

    const loadingNextQuestionButton = screen.getByRole("button", { name: "获取下一步问题" });
    const disabledSubmitAnswerButton = screen.getByRole("button", { name: "提交回答" });

    expect(loadingNextQuestionButton).toBeDisabled();
    expect(loadingNextQuestionButton).toHaveAttribute("aria-busy", "true");
    expect(loadingNextQuestionButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();

    expect(disabledSubmitAnswerButton).toBeDisabled();
    expect(disabledSubmitAnswerButton).not.toHaveAttribute("aria-busy");
    expect(disabledSubmitAnswerButton.className).toContain("border");
    expect(disabledSubmitAnswerButton.className).toContain("bg-white");
  });

  it("shows shared button loading behavior while generating the plan", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the request pending so we can observe the loading state.
          })
      )
    );

    render(React.createElement(ProjectWorkspace, { project }));

    const generatePlanButton = screen.getByRole("button", { name: "生成方案" });

    fireEvent.click(generatePlanButton);

    const loadingGeneratePlanButton = screen.getByRole("button", { name: "生成方案" });

    expect(loadingGeneratePlanButton).toBeDisabled();
    expect(loadingGeneratePlanButton).toHaveAttribute("aria-busy", "true");
    expect(loadingGeneratePlanButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();
    expect(loadingGeneratePlanButton.className).toContain("min-h-11");
    expect(loadingGeneratePlanButton.className).toContain("shadow-[0_10px_30px_rgba(45,104,255,0.22)]");
  });
});
