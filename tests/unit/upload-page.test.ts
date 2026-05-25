// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getProjectSummary = vi.fn();
const redirect = vi.fn();

globalThis.React = React;

vi.mock("next/navigation", () => ({
  redirect
}));

vi.mock("@/lib/projects/load-project", () => ({
  getProjectSummary
}));

vi.mock("@/components/wizard-shell", () => ({
  WizardShell: ({ children, title }: { children: React.ReactNode; title: string }) =>
    React.createElement("section", null, React.createElement("h1", null, title), children)
}));

vi.mock("@/components/project-steps", () => ({
  UploadStep: ({ projectId }: { projectId: string }) => React.createElement("div", null, `upload:${projectId}`)
}));

describe("upload page", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads lightweight project summary data for the upload shell", async () => {
    getProjectSummary.mockResolvedValue({
      id: "p1",
      status: "CREATED"
    });

    const { default: UploadPage } = await import("@/app/projects/[projectId]/upload/page");
    const page = await UploadPage({ params: Promise.resolve({ projectId: "p1" }) });

    render(page);

    expect(getProjectSummary).toHaveBeenCalledWith("p1");
    expect(screen.getByText("upload:p1")).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});
