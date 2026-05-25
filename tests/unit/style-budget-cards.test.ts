// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { StyleBudgetCards } from "@/components/style-budget-cards";

describe("StyleBudgetCards", () => {
  it("opens the style picker modal on mobile trigger click", () => {
    render(
      React.createElement(StyleBudgetCards, {
        selectedStyle: "modern_minimal",
        selectedBudget: "quality",
        onStyleChange: vi.fn(),
        onBudgetChange: vi.fn()
      })
    );

    fireEvent.click(screen.getByTestId("style-picker-trigger"));
    expect(screen.getByRole("dialog", { name: "选择装修风格" })).not.toBeNull();
    expect(screen.getByTestId("style-picker-slider")).not.toBeNull();
  });

  it("updates budget tier with dropdown selection", () => {
    const onBudgetChange = vi.fn();
    render(
      React.createElement(StyleBudgetCards, {
        selectedStyle: "modern_minimal",
        selectedBudget: "quality",
        onStyleChange: vi.fn(),
        onBudgetChange
      })
    );

    fireEvent.change(screen.getByTestId("budget-tier-select"), { target: { value: "premium" } });
    expect(onBudgetChange).toHaveBeenCalledWith("premium");
  });
});
