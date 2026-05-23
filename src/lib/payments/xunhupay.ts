import { createHash } from "node:crypto";

type XunhuPayParams = Record<string, string | undefined | null>;

export function buildXunhuPayHash(params: XunhuPayParams, appSecret: string) {
  if (!appSecret) {
    throw new Error("XunhuPay app secret is required");
  }

  const sorted = Object.keys(params)
    .filter((key) => key !== "hash")
    .filter((key) => {
      const value = params[key];
      return value !== undefined && value !== null && value !== "";
    })
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("md5").update(`${sorted}${appSecret}`).digest("hex");
}

export function verifyXunhuPayHash(params: XunhuPayParams, appSecret: string) {
  const receivedHash = (params.hash ?? "").toLowerCase();
  if (!receivedHash) {
    return false;
  }

  const expectedHash = buildXunhuPayHash(params, appSecret);
  return receivedHash === expectedHash;
}
