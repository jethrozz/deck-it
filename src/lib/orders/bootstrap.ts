import { Prisma, type PrismaClient } from "@prisma/client";
import { TEST_COUPON_DISCOUNT_RATE, TEST_COUPON_MIN_PAYABLE } from "@/lib/orders/constants";
import { normalizeContactValue } from "@/lib/orders/contact";

export async function ensureBuiltInCoupons(prisma: PrismaClient) {
  const code = process.env.TEST_COUPON_CODE?.trim();
  if (!code) {
    return;
  }

  const allowedContactValues = (process.env.TEST_COUPON_ALLOWED_CONTACTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return normalizeContactValue(value).value;
      } catch {
        throw new Error(`Invalid TEST_COUPON_ALLOWED_CONTACTS value: ${value}`);
      }
    });

  const dedupedAllowedContactValues = [...new Set(allowedContactValues)];

  const discountRate = new Prisma.Decimal(TEST_COUPON_DISCOUNT_RATE.toFixed(2));
  const minPayableAmount = new Prisma.Decimal(TEST_COUPON_MIN_PAYABLE.toFixed(2));

  await prisma.coupon.upsert({
    where: { code },
    update: {
      discountRate,
      isActive: true,
      isTest: true,
      allowedContactValues: dedupedAllowedContactValues,
      minPayableAmount
    },
    create: {
      code,
      discountRate,
      isActive: true,
      isTest: true,
      allowedContactValues: dedupedAllowedContactValues,
      minPayableAmount
    }
  });
}
