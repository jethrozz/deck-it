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

export function calculateOrderPricing(input: PricingInput): PricingResult {
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
