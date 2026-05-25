// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisConfirmStep, PreferencesStep, UploadStep } from "@/components/project-steps";

const analysis = {
  rooms: [{ name: "客厅", type: "living_dining" as const, confidence: 0.93 }],
  relationships: ["客厅连接阳台"],
  issues: [
    {
      type: "storage" as const,
      description: "玄关收纳不足",
      confidence: 0.88
    }
  ],
  uncertainItems: [],
  userCorrections: []
};

describe("mobile step layout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders upload area before the helper tips card", () => {
    const { container } = render(React.createElement(UploadStep, { projectId: "p1" }));
    const sections = Array.from(container.querySelectorAll("[data-testid]")).map((node) => node.getAttribute("data-testid"));
    expect(sections).toContain("upload-dropzone");
    expect(sections).toContain("upload-tips");
    expect(sections.indexOf("upload-dropzone")).toBeLessThan(sections.indexOf("upload-tips"));
  });

  it("renders floor plan preview before analysis summary", () => {
    const { container } = render(
      React.createElement(AnalysisConfirmStep, {
        projectId: "p1",
        floorPlanUrl: "/demo.png",
        analysis
      })
    );
    const sections = Array.from(container.querySelectorAll("[data-testid]")).map((node) => node.getAttribute("data-testid"));
    expect(sections.indexOf("analysis-preview")).toBeLessThan(sections.indexOf("analysis-summary-card"));
  });

  it("keeps notes section in preferences step", () => {
    render(React.createElement(PreferencesStep, { projectId: "p1" }));
    expect(screen.getByText("补充你的需求和想法")).not.toBeNull();
    expect(screen.getByRole("button", { name: "保存并继续" })).not.toBeNull();
  });

  it("marks save-and-continue busy while preferences submission is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the request pending so we can observe the loading state.
          })
      )
    );

    render(
      React.createElement(PreferencesStep, {
        projectId: "p1",
        initialPreference: {
          style: "modern_minimal",
          budgetTier: "quality",
          naturalLanguagePreference: "想要更好打理，也需要更多收纳。",
          lifestyleNotes: [],
          hardConstraints: [],
          adoptedSuggestions: [],
          rejectedSuggestions: []
        }
      })
    );

    const button = screen.getByRole("button", { name: "保存并继续" });
    fireEvent.click(button);

    const loadingButton = screen.getByRole("button", { name: "保存并继续" });

    expect(loadingButton.hasAttribute("disabled")).toBe(true);
    expect(loadingButton.getAttribute("aria-busy")).toBe("true");
    expect(loadingButton.textContent).toContain("保存并继续");
    expect(loadingButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();
  });

  it("only shows busy state on the clicked analysis action while keeping both labels visible", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the request pending so we can observe the loading state.
          })
      )
    );

    render(
      React.createElement(AnalysisConfirmStep, {
        projectId: "p1",
        floorPlanUrl: "/demo.png",
        analysis
      })
    );

    const skipButton = screen.getByRole("button", { name: "跳过，确认无误" });
    const confirmButton = screen.getByRole("button", { name: "确认并继续" });

    fireEvent.click(confirmButton);

    const loadingConfirmButton = screen.getByRole("button", { name: "确认并继续" });
    const disabledSkipButton = screen.getByRole("button", { name: "跳过，确认无误" });

    expect(loadingConfirmButton.hasAttribute("disabled")).toBe(true);
    expect(loadingConfirmButton.getAttribute("aria-busy")).toBe("true");
    expect(loadingConfirmButton.textContent).toContain("确认并继续");
    expect(loadingConfirmButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();

    expect(disabledSkipButton.hasAttribute("disabled")).toBe(true);
    expect(disabledSkipButton.getAttribute("aria-busy")).toBeNull();
    expect(disabledSkipButton.textContent).toContain("跳过，确认无误");
    expect(disabledSkipButton.querySelector("svg.animate-spin")).toBeNull();

    expect(skipButton).not.toBe(confirmButton);
  });
});
