// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/primitives";

describe("Button loading", () => {
  it("shows a spinner, disables the button, and exposes aria-busy while loading with loadingText", () => {
    render(React.createElement(Button, { loading: true, loadingText: "提交中" }, "提交"));

    const button = screen.getByRole("button", { name: "提交中" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("提交中")).toBeInTheDocument();
    expect(button.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();
  });

  it("keeps children visible while loading when loadingText is omitted", () => {
    render(React.createElement(Button, { loading: true }, "提交"));

    const button = screen.getByRole("button", { name: "提交" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("提交")).toBeInTheDocument();
    expect(button.querySelector("svg.animate-spin[aria-hidden='true']")).not.toBeNull();
  });

  it("omits aria-busy when not loading", () => {
    render(React.createElement(Button, null, "提交"));

    const button = screen.getByRole("button", { name: "提交" });
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.querySelector("svg.animate-spin")).toBeNull();
  });

  it("still disables the button while loading even when disabled is false", () => {
    render(React.createElement(Button, { loading: true, disabled: false }, "提交"));

    const button = screen.getByRole("button", { name: "提交" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
