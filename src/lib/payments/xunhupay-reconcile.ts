import { randomUUID } from "node:crypto";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createOrderService } from "@/lib/orders/order-service";
import { buildXunhuPayHash } from "@/lib/payments/xunhupay";

const XUNHUPAY_QUERY_URL_DEFAULT = "https://api.xunhupay.com/payment/query.html";
const XUNHUPAY_SUCCESS_STATUS = "OD";
const POLL_INTERVAL_MS = 30_000;
const CHINA_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const POLLABLE_STATUSES: OrderStatus[] = ["PENDING", "PROCESSING"];

type XunhuPayQueryResponse = {
  errcode?: number;
  errmsg?: string;
  status?: string;
  data?: {
    status?: string;
    open_order_id?: string | number;
    pay_order_id?: string | number;
    transaction_id?: string | number;
    total_fee?: string | number;
    price?: string | number;
  };
};

type ReconcileConfig = {
  appId: string;
  appSecret: string;
  queryUrl: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __xunhupayOrderReconcileTimer: ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __xunhupayOrderReconcileRunning: boolean | undefined;
}

function readConfig(): ReconcileConfig | null {
  const appId = process.env.XUNHUPAY_APP_ID?.trim() ?? "";
  const appSecret = process.env.XUNHUPAY_APP_SECRET?.trim() ?? "";
  if (!appId || !appSecret) {
    return null;
  }

  return {
    appId,
    appSecret,
    queryUrl: process.env.XUNHUPAY_QUERY_URL?.trim() || XUNHUPAY_QUERY_URL_DEFAULT
  };
}

function isReconcileEnabled() {
  const flag = process.env.XUNHUPAY_RECONCILE_ENABLED?.trim().toLowerCase();
  if (!flag) {
    return true;
  }

  return flag !== "0" && flag !== "false" && flag !== "off";
}

function getTodayRangeInChina(now = new Date()) {
  const chinaNow = new Date(now.getTime() + CHINA_TIMEZONE_OFFSET_MS);
  const year = chinaNow.getUTCFullYear();
  const month = chinaNow.getUTCMonth();
  const day = chinaNow.getUTCDate();

  const start = new Date(Date.UTC(year, month, day) - CHINA_TIMEZONE_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

function readProviderStatus(payload: XunhuPayQueryResponse) {
  return (payload.data?.status ?? payload.status ?? "").trim();
}

function readProviderOrderNo(payload: XunhuPayQueryResponse) {
  return String(payload.data?.transaction_id ?? payload.data?.pay_order_id ?? payload.data?.open_order_id ?? "").trim();
}

function readPaidAmount(payload: XunhuPayQueryResponse) {
  const raw = payload.data?.total_fee ?? payload.data?.price;
  return raw === undefined || raw === null ? "" : String(raw).trim();
}

async function queryOrderStatus(config: ReconcileConfig, orderNo: string) {
  const fields: Record<string, string> = {
    appid: config.appId,
    out_trade_order: orderNo,
    time: String(Math.floor(Date.now() / 1000)),
    nonce_str: randomUUID().replace(/-/g, "")
  };

  const hash = buildXunhuPayHash(fields, config.appSecret);
  const response = await fetch(config.queryUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ ...fields, hash })
  });

  const raw = await response.text();
  let payload: XunhuPayQueryResponse | null = null;
  try {
    payload = JSON.parse(raw) as XunhuPayQueryResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.errmsg?.trim() || `虎皮椒查单失败（HTTP ${response.status}）`);
  }

  if (!payload) {
    throw new Error("虎皮椒查单返回了非 JSON 数据");
  }

  if ((payload.errcode ?? 1) !== 0) {
    throw new Error(payload.errmsg?.trim() || "虎皮椒查单返回失败");
  }

  return payload;
}

async function reconcileTick(config: ReconcileConfig) {
  if (globalThis.__xunhupayOrderReconcileRunning) {
    return;
  }

  globalThis.__xunhupayOrderReconcileRunning = true;
  try {
    const { start, end } = getTodayRangeInChina();
    const candidates = await prisma.order.findMany({
      where: {
        provider: "XUNHUPAY",
        status: { in: POLLABLE_STATUSES },
        createdAt: {
          gte: start,
          lt: end
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        orderNo: true
      }
    });

    const preview = candidates.slice(0, 3).map((item) => item.orderNo).join(",");
    console.info(
      `[xunhupay-reconcile] tick candidates=${candidates.length} window=${start.toISOString()}~${end.toISOString()} preview=${
        preview || "-"
      }`
    );

    if (candidates.length === 0) {
      console.info("[xunhupay-reconcile] settled=0");
      return;
    }

    const orderService = createOrderService(prisma);
    let settledCount = 0;
    const settledOrders: string[] = [];

    for (const order of candidates) {
      try {
        const queryResult = await queryOrderStatus(config, order.orderNo);
        const providerStatus = readProviderStatus(queryResult).toUpperCase();
        if (providerStatus !== XUNHUPAY_SUCCESS_STATUS) {
          console.info(`[xunhupay-reconcile] skip order=${order.orderNo} reason=status status=${providerStatus || "-"}`);
          continue;
        }

        const providerOrderNo = readProviderOrderNo(queryResult);
        if (!providerOrderNo) {
          console.info(
            `[xunhupay-reconcile] skip order=${order.orderNo} reason=missing-fields providerOrderNo=- paidAmount=${
              readPaidAmount(queryResult) || "-"
            }`
          );
          continue;
        }

        let paidAmount = readPaidAmount(queryResult);
        if (!paidAmount) {
          const localOrder = await prisma.order.findUnique({
            where: { orderNo: order.orderNo },
            select: { payableAmount: true }
          });

          if (!localOrder) {
            console.info(
              `[xunhupay-reconcile] skip order=${order.orderNo} reason=missing-fields providerOrderNo=${providerOrderNo} paidAmount=-`
            );
            continue;
          }

          paidAmount = localOrder.payableAmount.toString();
          console.info(
            `[xunhupay-reconcile] fallback amount order=${order.orderNo} paidAmount=${paidAmount} source=local-order`
          );
        }

        await orderService.settlePaidOrder({
          orderNo: order.orderNo,
          providerOrderNo,
          providerStatus,
          paidAmount
        });
        settledCount += 1;
        settledOrders.push(order.orderNo);
      } catch (error) {
        console.error(`[xunhupay-reconcile] Failed to reconcile order ${order.orderNo}`, error);
      }
    }

    if (settledCount > 0) {
      console.info(`[xunhupay-reconcile] settled=${settledCount} orders=${settledOrders.join(",")}`);
    } else {
      console.info("[xunhupay-reconcile] settled=0");
    }
  } finally {
    globalThis.__xunhupayOrderReconcileRunning = false;
  }
}

export function ensureXunhuPayOrderReconcileScheduler() {
  if (globalThis.__xunhupayOrderReconcileTimer) {
    return;
  }

  if (!isReconcileEnabled()) {
    return;
  }

  const config = readConfig();
  if (!config) {
    return;
  }

  const startTick = () => {
    reconcileTick(config).catch((error) => {
      console.error("[xunhupay-reconcile] Tick failed", error);
    });
  };

  console.info(`[xunhupay-reconcile] scheduler started interval=${POLL_INTERVAL_MS}ms queryUrl=${config.queryUrl}`);
  startTick();
  const timer = setInterval(startTick, POLL_INTERVAL_MS);
  if (typeof (timer as NodeJS.Timeout).unref === "function") {
    (timer as NodeJS.Timeout).unref();
  }
  globalThis.__xunhupayOrderReconcileTimer = timer;
}
