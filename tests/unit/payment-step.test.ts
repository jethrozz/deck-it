// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentStep } from "@/components/payment-step";

describe("PaymentStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows mobile action bar for pending payment state", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order: {
            id: "o1",
            orderNo: "ORD-1",
            status: "PENDING",
            title: "设计方案生成",
            creditsGranted: 2,
            originalAmount: 199,
            discountAmount: 0,
            payableAmount: 199,
            contactType: null,
            contactValue: null,
            couponCodeSnapshot: null
          },
          remainingCredits: 0,
          requiresPayment: true
        })
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          projectStatus: "AWAITING_PAYMENT",
          remainingCredits: 0,
          requiresPayment: true,
          order: {
            id: "o1",
            orderNo: "ORD-1",
            status: "PENDING",
            title: "设计方案生成",
            creditsGranted: 2,
            originalAmount: 199,
            discountAmount: 0,
            payableAmount: 199,
            contactType: null,
            contactValue: null,
            couponCodeSnapshot: null
          }
        })
      } as Response);

    render(
      React.createElement(PaymentStep, {
        project: {
          id: "p1",
          status: "AWAITING_PAYMENT",
          generationCreditsPurchased: 0,
          generationCreditsUsed: 0,
          orders: []
        }
      })
    );

    const mobileBar = await screen.findByTestId("payment-mobile-action-bar");
    expect(mobileBar).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "立即支付" }).length).toBeGreaterThan(0);
  });
});
