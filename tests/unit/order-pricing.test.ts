import { describe, expect, it } from "vitest";
import { calculateOrderPricing } from "@/lib/orders/pricing";

describe("calculateOrderPricing", () => {
  it("applies a fixed discount rate", () => {
    expect(
      calculateOrderPricing({
        originalAmount: 199,
        coupon: { code: "SAVE20", discountRate: 0.8, isTest: false, minPayableAmount: null }
      })
    ).toMatchObject({
      discountAmount: 39.8,
      payableAmount: 159.2
    });
  });

  it("forces the XunhuPay test coupon to 0.01", () => {
    expect(
      calculateOrderPricing({
        originalAmount: 199,
        coupon: { code: "TESTPAY", discountRate: 0.8, isTest: true, minPayableAmount: 0.01 }
      }).payableAmount
    ).toBe(0.01);
  });

  it("uses default amount when no coupon is applied", () => {
    expect(calculateOrderPricing({ originalAmount: 199, coupon: null })).toMatchObject({
      discountAmount: 0,
      payableAmount: 199
    });
  });

  it("rejects invalid original amount", () => {
    expect(() => calculateOrderPricing({ originalAmount: 0, coupon: null })).toThrow(
      "originalAmount must be a finite number greater than 0"
    );
  });

  it("rejects invalid discount rate", () => {
    expect(() =>
      calculateOrderPricing({
        originalAmount: 199,
        coupon: { code: "BAD", discountRate: 1.2, isTest: false, minPayableAmount: null }
      })
    ).toThrow("discountRate must be a finite number in the range (0, 1]");
  });

  it("rejects invalid min payable amount for test coupons", () => {
    expect(() =>
      calculateOrderPricing({
        originalAmount: 199,
        coupon: { code: "TESTPAY", discountRate: 0.8, isTest: true, minPayableAmount: 0 }
      })
    ).toThrow("minPayableAmount must be a finite number greater than 0");
  });
});
