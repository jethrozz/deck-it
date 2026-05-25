// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
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
});
