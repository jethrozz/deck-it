import { type PrismaClient, type ProjectStatus } from "@prisma/client";
import { calculateOrderPricing } from "@/lib/orders/pricing";
import { normalizeContactIdentity } from "@/lib/orders/contact";
import { createProjectRepository } from "@/lib/repositories/project-repository";
import { resolveCouponForContact } from "@/lib/orders/coupon-service";

type PrismaLike = Pick<PrismaClient, "$transaction" | "order" | "project" | "coupon" | "couponRedemption">;

type QuoteOrderInput = {
  projectId: string;
  orderId: string;
  email: string;
  phone: string;
  couponCode: string;
};

type SettlePaidOrderInput = {
  orderNo: string;
  providerOrderNo: string;
  providerStatus: string;
  paidAmount: number | string;
};

type PaidOrderResult = {
  creditsGranted: number;
  projectStatus: ProjectStatus;
};

function decimalToNumber(value: { toString(): string } | number) {
  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

const XUNHUPAY_SUCCESS_STATUS = "OD";
const ALLOWED_PRE_PAY_STATUSES = new Set(["PENDING", "PROCESSING"]);
const NON_PAYABLE_TERMINAL_STATUSES = new Set(["FAILED", "EXPIRED", "CANCELED"]);

function normalizeMoneyToCents(value: number | string, fieldName: string) {
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }

  return Math.round(parsed * 100);
}

function assertProviderSuccessStatus(providerStatus: string) {
  if (providerStatus !== XUNHUPAY_SUCCESS_STATUS) {
    throw new Error("支付状态未成功");
  }
}

function assertPaidAmountMatches(payableAmount: { toString(): string } | number, paidAmount: number | string) {
  const payableCents = normalizeMoneyToCents(decimalToNumber(payableAmount), "payableAmount");
  const paidCents = normalizeMoneyToCents(paidAmount, "paidAmount");

  if (payableCents !== paidCents) {
    throw new Error("支付金额校验失败");
  }
}

function assertProviderOrderNoIntegrity(storedProviderOrderNo: string | null, providerOrderNo: string) {
  if (!providerOrderNo.trim()) {
    throw new Error("支付流水号不能为空");
  }

  if (storedProviderOrderNo !== null && storedProviderOrderNo !== providerOrderNo) {
    throw new Error("支付流水号不一致");
  }
}

export function createOrderService(prisma: PrismaLike) {
  const repository = createProjectRepository(prisma as never);

  return {
    async quoteOrder(input: QuoteOrderInput) {
      const order = await repository.findOrderById(input.orderId);
      if (!order || order.projectId !== input.projectId) {
        throw new Error("订单不存在");
      }

      const contact = normalizeContactIdentity(input.email, input.phone);
      const normalizedCouponCode = input.couponCode.trim();
      const coupon = normalizedCouponCode
        ? await resolveCouponForContact(prisma, normalizedCouponCode, contact)
        : null;

      const pricing = calculateOrderPricing({
        originalAmount: decimalToNumber(order.originalAmount),
        coupon
      });

      return {
        orderId: order.id,
        contact,
        coupon: coupon
          ? {
              id: coupon.id,
              code: coupon.code,
              isTest: coupon.isTest
            }
          : null,
        pricing
      };
    },

    async settlePaidOrder(input: SettlePaidOrderInput): Promise<PaidOrderResult> {
      return prisma.$transaction(async (tx) => {
        assertProviderSuccessStatus(input.providerStatus);
        assertProviderOrderNoIntegrity(null, input.providerOrderNo);

        const txRepository = createProjectRepository(tx as never);
        const order = await txRepository.findOrderByOrderNo(input.orderNo);

        if (!order) {
          throw new Error("订单不存在");
        }

        assertPaidAmountMatches(order.payableAmount, input.paidAmount);

        if (order.status === "PAID") {
          assertProviderOrderNoIntegrity(order.providerOrderNo, input.providerOrderNo);

          return {
            creditsGranted: order.creditsGranted,
            projectStatus: "PAYMENT_SUCCEEDED"
          };
        }

        if (NON_PAYABLE_TERMINAL_STATUSES.has(order.status)) {
          throw new Error("订单状态不允许入账");
        }

        if (!ALLOWED_PRE_PAY_STATUSES.has(order.status)) {
          throw new Error(`订单状态不支持支付入账: ${order.status}`);
        }

        const markPaidResult = await tx.order.updateMany({
          where: {
            id: order.id,
            status: { in: ["PENDING", "PROCESSING"] }
          },
          data: {
            status: "PAID",
            providerOrderNo: input.providerOrderNo,
            paidAt: new Date()
          }
        });

        if (markPaidResult.count === 0) {
          const latestOrder = await txRepository.findOrderByOrderNo(input.orderNo);
          if (!latestOrder) {
            throw new Error("订单不存在");
          }

          assertPaidAmountMatches(latestOrder.payableAmount, input.paidAmount);

          if (latestOrder.status === "PAID") {
            assertProviderOrderNoIntegrity(latestOrder.providerOrderNo, input.providerOrderNo);
            return {
              creditsGranted: latestOrder.creditsGranted,
              projectStatus: "PAYMENT_SUCCEEDED"
            };
          }

          if (NON_PAYABLE_TERMINAL_STATUSES.has(latestOrder.status)) {
            throw new Error("订单状态不允许入账");
          }

          if (!ALLOWED_PRE_PAY_STATUSES.has(latestOrder.status)) {
            throw new Error(`订单状态不支持支付入账: ${latestOrder.status}`);
          }

          throw new Error("支付入账冲突，请重试");
        }

        if (order.couponId && order.contactType && order.contactValue) {
          await txRepository.createCouponRedemption({
            coupon: { connect: { id: order.couponId } },
            order: { connect: { id: order.id } },
            contactType: order.contactType,
            contactValue: order.contactValue
          });
        }

        await txRepository.grantProjectCredits(order.projectId, order.creditsGranted, "PAYMENT_SUCCEEDED");

        return {
          creditsGranted: order.creditsGranted,
          projectStatus: "PAYMENT_SUCCEEDED"
        };
      });
    }
  };
}
