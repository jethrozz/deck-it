import { Prisma, type PrismaClient } from "@prisma/client";
import { TEST_COUPON_DISCOUNT_RATE, TEST_COUPON_MIN_PAYABLE } from "@/lib/orders/constants";

function normalizeAllowedContact(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("86") && digits.length === 13) {
    return digits.slice(2);
  }

  return digits;
}

export async function ensureBuiltInCoupons(prisma: PrismaClient) {
  const code = process.env.TEST_COUPON_CODE?.trim();
  if (!code) {
    return;
  }

  const allowedContactValues = (process.env.TEST_COUPON_ALLOWED_CONTACTS ?? "")
    .split(",")
    .map(normalizeAllowedContact)
    .filter((value): value is string => Boolean(value));

  const discountRate = new Prisma.Decimal(TEST_COUPON_DISCOUNT_RATE.toFixed(2));
  const minPayableAmount = new Prisma.Decimal(TEST_COUPON_MIN_PAYABLE.toFixed(2));

  await prisma.coupon.upsert({
    where: { code },
    update: {
      discountRate,
      isActive: true,
      isTest: true,
      allowedContactValues,
      minPayableAmount
    },
    create: {
      code,
      discountRate,
      isActive: true,
      isTest: true,
      allowedContactValues,
      minPayableAmount
    }
  });
}
