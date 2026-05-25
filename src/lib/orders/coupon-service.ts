import { ContactType, type PrismaClient } from "@prisma/client";
import { createProjectRepository } from "@/lib/repositories/project-repository";
import type { ContactIdentity } from "@/lib/orders/contact";

type PrismaLike = Pick<PrismaClient, "coupon" | "couponRedemption">;

type ResolvedCoupon = {
  id: string;
  code: string;
  discountRate: number;
  isTest: boolean;
  minPayableAmount: number | null;
};

function decimalToNumber(value: { toString(): string } | number | null) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

function toContactType(type: ContactIdentity["type"]) {
  return type === "email" ? ContactType.EMAIL : ContactType.PHONE;
}

function parseAllowedContacts(allowedContactValues: unknown) {
  if (!Array.isArray(allowedContactValues)) {
    return [];
  }

  return allowedContactValues.filter((value): value is string => typeof value === "string");
}

export async function resolveCouponForContact(
  prisma: PrismaLike,
  code: string,
  contact: ContactIdentity
): Promise<ResolvedCoupon> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw new Error("优惠码不能为空");
  }

  const repository = createProjectRepository(prisma as never);
  const coupon = await repository.findCouponByCode(normalizedCode);

  if (!coupon || !coupon.isActive) {
    throw new Error("优惠码不存在或不可用");
  }

  if (coupon.isTest) {
    const allowed = parseAllowedContacts(coupon.allowedContactValues);
    if (allowed.length > 0 && !allowed.includes(contact.value)) {
      throw new Error("该测试优惠码不适用于当前联系方式");
    }
  }

  if (!coupon.isTest) {
    const prior = await prisma.couponRedemption.findFirst({
      where: {
        couponId: coupon.id,
        contactType: toContactType(contact.type),
        contactValue: contact.value
      }
    });

    if (prior) {
      throw new Error("该优惠码已被此联系方式使用");
    }
  }

  return {
    id: coupon.id,
    code: coupon.code,
    discountRate: decimalToNumber(coupon.discountRate) ?? 1,
    isTest: coupon.isTest,
    minPayableAmount: decimalToNumber(coupon.minPayableAmount)
  };
}
