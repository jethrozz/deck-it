// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("disables the quote button and marks it busy while applying a coupon", async () => {
    let resolveQuote: ((value: Response) => void) | null = null;
    const quoteRequest = new Promise<Response>((resolve) => {
      resolveQuote = resolve;
    });

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
      .mockResolvedValueOnce({
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
      } as Response)
      .mockImplementationOnce(() => quoteRequest);

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

    const button = await screen.findByRole("button", { name: "应用优惠码" });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "应用优惠码" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "应用优惠码" }).getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolveQuote?.({
        ok: true,
        json: async () => ({
          contact: { type: "email", value: "" },
          coupon: null,
          pricing: {
            originalAmount: 199,
            discountAmount: 0,
            payableAmount: 199
          }
        })
      } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("disables email, phone, and coupon inputs while quoting is in flight", async () => {
    let resolveQuote: ((value: Response) => void) | null = null;
    const quoteRequest = new Promise<Response>((resolve) => {
      resolveQuote = resolve;
    });

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
      .mockResolvedValueOnce({
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
      } as Response)
      .mockImplementationOnce(() => quoteRequest);

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

    const quoteButton = await screen.findByRole("button", { name: "应用优惠码" });
    const emailInput = screen.getByRole("textbox", { name: "邮箱" });
    const phoneInput = screen.getByRole("textbox", { name: "手机号" });
    const couponInput = screen.getByPlaceholderText("输入优惠码可刷新报价");

    await waitFor(() => {
      expect(emailInput).toBeEnabled();
      expect(phoneInput).toBeEnabled();
      expect(couponInput).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(quoteButton);
      await Promise.resolve();
    });

    expect(screen.getByRole("textbox", { name: "邮箱" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "手机号" })).toBeDisabled();
    expect(screen.getByPlaceholderText("输入优惠码可刷新报价")).toBeDisabled();

    await act(async () => {
      resolveQuote?.({
        ok: true,
        json: async () => ({
          contact: { type: "email", value: "" },
          coupon: null,
          pricing: {
            originalAmount: 199,
            discountAmount: 0,
            payableAmount: 199
          }
        })
      } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("disables the refresh button, marks it busy, and keeps its label while refreshing payment status", async () => {
    let resolveRefresh: ((value: Response) => void) | null = null;
    const refreshRequest = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

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
      .mockResolvedValueOnce({
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
      } as Response)
      .mockImplementationOnce(() => refreshRequest);

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

    const button = await screen.findByRole("button", { name: "刷新支付状态" });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    const loadingButton = screen.getByRole("button", { name: "刷新支付状态" });
    expect(loadingButton).toHaveProperty("disabled", true);
    expect(loadingButton.getAttribute("aria-busy")).toBe("true");
    expect(loadingButton.textContent).toContain("刷新支付状态");

    await act(async () => {
      resolveRefresh?.({
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
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("marks both pay CTAs busy, disables them, and keeps their labels while paying", async () => {
    let resolvePay: ((value: Response) => void) | null = null;
    const payRequest = new Promise<Response>((resolve) => {
      resolvePay = resolve;
    });

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
      .mockResolvedValueOnce({
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
      } as Response)
      .mockImplementationOnce(() => payRequest);

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

    const payButtons = await screen.findAllByRole("button", { name: "立即支付" });
    await act(async () => {
      fireEvent.click(payButtons[0]);
      await Promise.resolve();
    });

    await waitFor(() => {
      const loadingButtons = screen.getAllByRole("button", { name: "立即支付" });
      expect(loadingButtons).toHaveLength(2);
      for (const button of loadingButtons) {
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(button).toHaveTextContent("立即支付");
      }
    });

    await act(async () => {
      resolvePay?.({
        ok: true,
        json: async () => ({
          contact: { type: "email", value: "" },
          coupon: null,
          pricing: {
            originalAmount: 199,
            discountAmount: 0,
            payableAmount: 199
          },
          order: {
            id: "o1",
            orderNo: "ORD-1",
            status: "PROCESSING",
            title: "设计方案生成",
            creditsGranted: 2,
            originalAmount: 199,
            discountAmount: 0,
            payableAmount: 199,
            contactType: null,
            contactValue: null,
            couponCodeSnapshot: null
          },
          paymentProviderResult: {
            openid: null,
            url_qrcode: null,
            url: null,
            errcode: null,
            errmsg: null,
            hash: null
          }
        })
      } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
