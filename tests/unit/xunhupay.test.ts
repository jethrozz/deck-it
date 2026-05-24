import { describe, expect, it } from "vitest";
import { buildXunhuPayHash, verifyXunhuPayHash } from "@/lib/payments/xunhupay";

describe("xunhupay signing helpers", () => {
  it("matches a known digest vector", () => {
    const hash = buildXunhuPayHash(
      {
        appid: "app_123",
        trade_order_id: "ORD-1",
        total_fee: "0.01",
        title: "Deck It 2次生成包"
      },
      "secret"
    );

    expect(hash).toBe("db5a79a7fd70c430e22e6a4484191b6d");
  });

  it("builds deterministic signatures for sorted non-empty params", () => {
    const hash = buildXunhuPayHash(
      {
        appid: "app_123",
        trade_order_id: "ORD-1",
        total_fee: "0.01",
        title: "Deck It 2次生成包",
        hash: "",
        optional: ""
      },
      "secret"
    );

    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]{32}$/u);
  });

  it("verifies callback signatures and rejects tampering", () => {
    const payload = {
      appid: "app_123",
      trade_order_id: "ORD-1",
      total_fee: "0.01",
      title: "Deck It 2次生成包"
    };

    const hash = buildXunhuPayHash(payload, "secret");

    expect(
      verifyXunhuPayHash(
        {
          ...payload,
          hash
        },
        "secret"
      )
    ).toBe(true);

    expect(
      verifyXunhuPayHash(
        {
          ...payload,
          total_fee: "0.02",
          hash
        },
        "secret"
      )
    ).toBe(false);
  });
});
