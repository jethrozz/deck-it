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
        const txRepository = createProjectRepository(tx as never);
        const order = await txRepository.findOrderByOrderNo(input.orderNo);

        if (!order) {
          throw new Error("订单不存在");
        }

        if (order.status === "PAID") {
          return {
            creditsGranted: order.creditsGranted,
            projectStatus: "PAYMENT_SUCCEEDED"
          };
        }

        const markPaidResult = await tx.order.updateMany({
          where: {
            id: order.id,
            status: {
              not: "PAID"
            }
          },
          data: {
            status: "PAID",
            providerOrderNo: input.providerOrderNo,
            paidAt: new Date()
          }
        });

        if (markPaidResult.count === 0) {
          return {
            creditsGranted: order.creditsGranted,
            projectStatus: "PAYMENT_SUCCEEDED"
          };
        }

        await txRepository.grantProjectCredits(order.projectId, order.creditsGranted, "PAYMENT_SUCCEEDED");

        if (order.couponId && order.contactType && order.contactValue) {
          await txRepository.createCouponRedemption({
            coupon: { connect: { id: order.couponId } },
            order: { connect: { id: order.id } },
            contactType: order.contactType,
            contactValue: order.contactValue
          });
        }

        return {
          creditsGranted: order.creditsGranted,
          projectStatus: "PAYMENT_SUCCEEDED"
        };
      });
    }
  };
}
