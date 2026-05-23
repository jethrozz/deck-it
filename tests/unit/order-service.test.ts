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

  it("settles paid order idempotently, grants credits, and creates redemption once", async () => {
    const orderRecord = {
      id: "o1",
      projectId: "p1",
      orderNo: "ORD-1",
      status: "PENDING",
      creditsGranted: 2,
      couponId: "c1",
      contactType: "EMAIL",
      contactValue: "user@example.com"
    };

    let purchasedCredits = 0;
    let projectStatus = "AWAITING_PAYMENT";

    const tx = {
      order: {
        findUnique: vi.fn().mockImplementation(async () => orderRecord),
        updateMany: vi.fn().mockImplementation(async () => {
          if (orderRecord.status === "PAID") {
            return { count: 0 };
          }

          orderRecord.status = "PAID";
          return { count: 1 };
        })
      },
      project: {
        update: vi.fn().mockImplementation(async ({ data }: { data: { generationCreditsPurchased: { increment: number }; status: string } }) => {
          purchasedCredits += data.generationCreditsPurchased.increment;
          projectStatus = data.status;
          return {
            id: "p1",
            generationCreditsPurchased: purchasedCredits,
            status: projectStatus
          };
        })
      },
      couponRedemption: {
        create: vi.fn().mockResolvedValue({
          id: "r1"
        })
      },
      coupon: {
        findUnique: vi.fn()
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

    const service = createOrderService(prisma as never);

    const first = await service.settlePaidOrder({
      orderNo: "ORD-1",
      providerOrderNo: "XH-1"
    });
    const second = await service.settlePaidOrder({
      orderNo: "ORD-1",
      providerOrderNo: "XH-1"
    });

    expect(first).toEqual({
      creditsGranted: 2,
      projectStatus: "PAYMENT_SUCCEEDED"
    });
    expect(second).toEqual({
      creditsGranted: 2,
      projectStatus: "PAYMENT_SUCCEEDED"
    });

    expect(purchasedCredits).toBe(2);
    expect(projectStatus).toBe("PAYMENT_SUCCEEDED");
    expect(tx.project.update).toHaveBeenCalledTimes(1);
    expect(tx.couponRedemption.create).toHaveBeenCalledTimes(1);
    expect(tx.couponRedemption.create).toHaveBeenCalledWith({
      data: {
        coupon: { connect: { id: "c1" } },
        contactType: "EMAIL",
        contactValue: "user@example.com",
        order: { connect: { id: "o1" } }
      }
    });
  });
});
