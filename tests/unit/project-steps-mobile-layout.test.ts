// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisConfirmStep, CompletedStep, CreateProjectHero, PreferencesStep, UploadStep } from "@/components/project-steps";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

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
    vi.clearAllMocks();
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

  it("marks the create-project submit button busy while submission is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the request pending so we can observe the loading state.
          })
      )
    );

    render(React.createElement(CreateProjectHero));

    const button = screen.getByRole("button", { name: "开始创建" });
    fireEvent.click(button);

    await waitFor(() => {
      const loadingButton = screen.getByRole("button", { name: "开始创建" });

      expect(loadingButton.hasAttribute("disabled")).toBe(true);
      expect(loadingButton.getAttribute("aria-busy")).toBe("true");
      expect(loadingButton.textContent).toContain("开始创建");
      expect(loadingButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();
    });
  });

  it("only marks regenerate busy while keeping the download label available", async () => {
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
      React.createElement(CompletedStep, {
        projectId: "p1",
        briefReady: true,
        renderings: [{ id: "r1", spaceType: "living_room", imageUrl: "/demo.png", status: "SUCCEEDED" }]
      })
    );

    const regenerateButton = screen.getByRole("button", { name: "重新生成方案" });
    const downloadButton = screen.getByRole("button", { name: "下载 PDF brief" });

    fireEvent.click(regenerateButton);

    await waitFor(() => {
      const loadingRegenerateButton = screen.getByRole("button", { name: "重新生成方案" });
      const idleDownloadButton = screen.getByRole("button", { name: "下载 PDF brief" });

      expect(loadingRegenerateButton.hasAttribute("disabled")).toBe(true);
      expect(loadingRegenerateButton.getAttribute("aria-busy")).toBe("true");
      expect(loadingRegenerateButton.textContent).toContain("重新生成方案");
      expect(loadingRegenerateButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();

      expect(idleDownloadButton.hasAttribute("disabled")).toBe(false);
      expect(idleDownloadButton.getAttribute("aria-busy")).toBeNull();
      expect(idleDownloadButton.textContent).toContain("下载 PDF brief");
      expect(idleDownloadButton.querySelector("svg.animate-spin")).toBeNull();
    });

    expect(regenerateButton).not.toBe(downloadButton);
  });

  it("only marks download busy while keeping the regenerate label available", async () => {
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
      React.createElement(CompletedStep, {
        projectId: "p1",
        briefReady: false,
        renderings: [{ id: "r1", spaceType: "living_room", imageUrl: "/demo.png", status: "SUCCEEDED" }]
      })
    );

    const regenerateButton = screen.getByRole("button", { name: "重新生成方案" });
    const downloadButton = screen.getByRole("button", { name: "下载 PDF brief" });

    fireEvent.click(downloadButton);

    await waitFor(() => {
      const idleRegenerateButton = screen.getByRole("button", { name: "重新生成方案" });
      const loadingDownloadButton = screen.getByRole("button", { name: "下载 PDF brief" });

      expect(loadingDownloadButton.hasAttribute("disabled")).toBe(true);
      expect(loadingDownloadButton.getAttribute("aria-busy")).toBe("true");
      expect(loadingDownloadButton.textContent).toContain("下载 PDF brief");
      expect(loadingDownloadButton.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();

      expect(idleRegenerateButton.hasAttribute("disabled")).toBe(false);
      expect(idleRegenerateButton.getAttribute("aria-busy")).toBeNull();
      expect(idleRegenerateButton.textContent).toContain("重新生成方案");
      expect(idleRegenerateButton.querySelector("svg.animate-spin")).toBeNull();
    });

    expect(downloadButton).not.toBe(regenerateButton);
  });
});
