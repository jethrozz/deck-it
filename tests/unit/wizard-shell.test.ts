// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { WizardShell } from "@/components/wizard-shell";

describe("WizardShell", () => {
  it("renders mobile progress rail and action slot", () => {
    render(
      React.createElement(
        WizardShell,
        {
          currentStep: "preferences",
          title: "风格与预算",
          description: "选择你喜欢的风格，并补充需求。",
          mobileActionBar: React.createElement(
            "div",
            { "data-testid": "shell-mobile-action-bar" },
            React.createElement("button", { type: "button" }, "保存并继续")
          )
        },
        React.createElement("div", null, "page body")
      )
    );

    expect(screen.getByText("风格与预算")).not.toBeNull();
    expect(screen.getByText("选择你喜欢的风格，并补充需求。")).not.toBeNull();
    expect(screen.getByRole("list", { name: "项目步骤" })).not.toBeNull();
    expect(screen.getByTestId("shell-mobile-action-bar")).not.toBeNull();
  });
});
