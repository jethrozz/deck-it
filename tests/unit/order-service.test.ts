import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createOrderService } from "@/lib/orders/order-service";

describe("order service", () => {
  it("rejects coupon reuse for the same normalized contact", async () => {
    const prisma = {
      $transaction: vi.fn(),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "o1",
          projectId: "p1",
          originalAmount: new Prisma.Decimal("199.00")
        })
      },
      coupon: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          code: "SAVE20",
          discountRate: new Prisma.Decimal("0.80"),
          isActive: true,
          isTest: false,
          minPayableAmount: null,
          allowedContactValues: null
        })
      },
      couponRedemption: {
        findFirst: vi.fn().mockResolvedValue({
          id: "r1"
        })
      }
    };

    const service = createOrderService(prisma as never);

    await expect(
      service.quoteOrder({
        projectId: "p1",
        orderId: "o1",
        email: " USER@Example.com ",
        phone: "",
        couponCode: "SAVE20"
      })
    ).rejects.toThrow("该优惠码已被此联系方式使用");
  });

  it("allows test coupon reuse for the same normalized contact", async () => {
    const prisma = {
      $transaction: vi.fn(),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "o1",
          projectId: "p1",
          originalAmount: new Prisma.Decimal("199.00")
        })
      },
      coupon: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c-test",
          code: "TESTPAY",
          discountRate: new Prisma.Decimal("0.80"),
          isActive: true,
          isTest: true,
          minPayableAmount: new Prisma.Decimal("0.01"),
          allowedContactValues: []
        })
      },
      couponRedemption: {
        findFirst: vi.fn().mockResolvedValue({
          id: "r1"
        })
      }
    };

    const service = createOrderService(prisma as never);

    const result = await service.quoteOrder({
      projectId: "p1",
      orderId: "o1",
      email: " USER@Example.com ",
      phone: "",
      couponCode: "TESTPAY"
    });

    expect(result.coupon?.isTest).toBe(true);
    expect(result.pricing.payableAmount).toBe(0.01);
  });

  it("settles paid order idempotently, grants credits, and creates redemption once", async () => {
    const { service, tx, state } = createSettlementHarness();

    const first = await service.settlePaidOrder({
      orderNo: "ORD-1",
      providerOrderNo: "XH-1",
      providerStatus: "OD",
      paidAmount: "159.20"
    });
    const second = await service.settlePaidOrder({
      orderNo: "ORD-1",
      providerOrderNo: "XH-1",
      providerStatus: "OD",
      paidAmount: "159.20"
    });

    expect(first).toEqual({
      creditsGranted: 2,
      projectStatus: "PAYMENT_SUCCEEDED"
    });
    expect(second).toEqual({
      creditsGranted: 2,
      projectStatus: "PAYMENT_SUCCEEDED"
    });

    expect(state.purchasedCredits).toBe(2);
    expect(state.projectStatus).toBe("PAYMENT_SUCCEEDED");
    expect(tx.project.update).toHaveBeenCalledTimes(1);
    expect(tx.couponRedemption.create).toHaveBeenCalledTimes(1);
  });

  it("does not create redemption for test coupons", async () => {
    const { service, tx } = createSettlementHarness({ couponIsTest: true });

    const result = await service.settlePaidOrder({
      orderNo: "ORD-1",
      providerOrderNo: "XH-1",
      providerStatus: "OD",
      paidAmount: "159.20"
    });

    expect(result).toEqual({
      creditsGranted: 2,
      projectStatus: "PAYMENT_SUCCEEDED"
    });
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });

  it("rejects settlement when provider status is not OD", async () => {
    const { service, tx } = createSettlementHarness();

    await expect(
      service.settlePaidOrder({
        orderNo: "ORD-1",
        providerOrderNo: "XH-1",
        providerStatus: "WP",
        paidAmount: "159.20"
      })
    ).rejects.toThrow("支付状态未成功");

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.project.update).not.toHaveBeenCalled();
  });

  it("rejects settlement when callback paid amount mismatches order payable amount", async () => {
    const { service, tx } = createSettlementHarness();

    await expect(
      service.settlePaidOrder({
        orderNo: "ORD-1",
        providerOrderNo: "XH-1",
        providerStatus: "OD",
        paidAmount: "159.21"
      })
    ).rejects.toThrow("支付金额校验失败");

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.project.update).not.toHaveBeenCalled();
  });

  it("rejects provider order number mismatch for already paid replays", async () => {
    const { service, tx } = createSettlementHarness({
      status: "PAID",
      providerOrderNo: "XH-ORIGINAL"
    });

    await expect(
      service.settlePaidOrder({
        orderNo: "ORD-1",
        providerOrderNo: "XH-REPLAY",
        providerStatus: "OD",
        paidAmount: "159.20"
      })
    ).rejects.toThrow("支付流水号不一致");

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.project.update).not.toHaveBeenCalled();
  });

  it("rejects settlement for terminal non-payable states", async () => {
    const { service, tx } = createSettlementHarness({
      status: "FAILED"
    });

    await expect(
      service.settlePaidOrder({
        orderNo: "ORD-1",
        providerOrderNo: "XH-1",
        providerStatus: "OD",
        paidAmount: "159.20"
      })
    ).rejects.toThrow("订单状态不允许入账");

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.project.update).not.toHaveBeenCalled();
  });
});

function createSettlementHarness(overrides?: {
  status?: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELED";
  providerOrderNo?: string | null;
  couponIsTest?: boolean;
}) {
  const orderRecord = {
    id: "o1",
    projectId: "p1",
    orderNo: "ORD-1",
    status: overrides?.status ?? ("PENDING" as "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELED"),
    creditsGranted: 2,
    couponId: "c1",
    contactType: "EMAIL",
    contactValue: "user@example.com",
    providerOrderNo: overrides?.providerOrderNo ?? null,
    payableAmount: new Prisma.Decimal("159.20")
  };

  const state = {
    purchasedCredits: 0,
    projectStatus: "AWAITING_PAYMENT"
  };

  const tx = {
    order: {
      findUnique: vi.fn().mockImplementation(async () => orderRecord),
      updateMany: vi.fn().mockImplementation(async ({ data }: { data: { providerOrderNo: string } }) => {
        if (orderRecord.status !== "PENDING" && orderRecord.status !== "PROCESSING") {
          return { count: 0 };
        }

        orderRecord.status = "PAID";
        orderRecord.providerOrderNo = data.providerOrderNo;
        return { count: 1 };
      })
    },
    project: {
      update: vi.fn().mockImplementation(async ({ data }: { data: { generationCreditsPurchased: { increment: number }; status: string } }) => {
        state.purchasedCredits += data.generationCreditsPurchased.increment;
        state.projectStatus = data.status;
        return {
          id: "p1",
          generationCreditsPurchased: state.purchasedCredits,
          status: state.projectStatus
        };
      })
    },
    couponRedemption: {
      create: vi.fn().mockResolvedValue({
        id: "r1"
      }),
      findFirst: vi.fn()
    },
    coupon: {
      findUnique: vi.fn().mockResolvedValue({
        isTest: overrides?.couponIsTest ?? false
      })
    },
    floorPlanAnalysis: {},
    preferenceProfile: {},
    agentConversation: {},
    designPlan: {},
    renderingAsset: {},
    briefExport: {},
    $transaction: vi.fn()
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    order: {},
    project: {},
    coupon: {},
    couponRedemption: {}
  };

  return {
    service: createOrderService(prisma as never),
    tx,
    state
  };
}
