import { describe, expect, it } from "vitest";
import { normalizeContactIdentity } from "@/lib/orders/contact";

describe("normalizeContactIdentity", () => {
  it("normalizes email identities", () => {
    expect(normalizeContactIdentity("  USER@Example.com ", "")).toEqual({
      type: "email",
      value: "user@example.com"
    });
  });

  it("normalizes phone identities", () => {
    expect(normalizeContactIdentity("", " +86 138-0013-8000 ")).toEqual({
      type: "phone",
      value: "13800138000"
    });
  });

  it("rejects overlong phone values", () => {
    expect(() => normalizeContactIdentity("", "138001380001")).toThrow("手机号格式不正确");
  });

  it("rejects phone values that do not start with 1", () => {
    expect(() => normalizeContactIdentity("", "23800138000")).toThrow("手机号格式不正确");
  });

  it("rejects invalid email", () => {
    expect(() => normalizeContactIdentity("not-an-email", "")).toThrow("邮箱格式不正确");
  });

  it("requires at least one contact value", () => {
    expect(() => normalizeContactIdentity("", " ")).toThrow("请填写邮箱或手机号");
  });
});
