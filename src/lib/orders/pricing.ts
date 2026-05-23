import { XUNHUPAY_MIN_TEST_PAYMENT } from "@/lib/orders/constants";

type PricingCoupon = {
  code: string;
  discountRate: number;
  isTest: boolean;
  minPayableAmount: number | null;
};

type PricingInput = {
  originalAmount: number;
  coupon: PricingCoupon | null;
};

type PricingResult = {
  originalAmount: number;
  discountAmount: number;
  payableAmount: number;
};

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function assertFinitePositive(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a finite number greater than 0`);
  }
}

function assertDiscountRate(discountRate: number) {
  if (!Number.isFinite(discountRate) || discountRate <= 0 || discountRate > 1) {
    throw new Error("discountRate must be a finite number in the range (0, 1]");
  }
}

export function calculateOrderPricing(input: PricingInput): PricingResult {
  assertFinitePositive(input.originalAmount, "originalAmount");

  if (input.coupon) {
    assertDiscountRate(input.coupon.discountRate);
  }

  if (input.coupon?.isTest && input.coupon.minPayableAmount !== null) {
    assertFinitePositive(input.coupon.minPayableAmount, "minPayableAmount");
  }

  const baseAmount = roundTo2(input.originalAmount);
  const discountedAmount = input.coupon ? roundTo2(baseAmount * input.coupon.discountRate) : baseAmount;

  const payableAmount = input.coupon?.isTest
    ? roundTo2(input.coupon.minPayableAmount ?? XUNHUPAY_MIN_TEST_PAYMENT)
    : discountedAmount;

  return {
    originalAmount: baseAmount,
    discountAmount: roundTo2(baseAmount - payableAmount),
    payableAmount
  };
}
