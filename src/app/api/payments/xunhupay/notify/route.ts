import { createOrderService } from "@/lib/orders/order-service";
import { prisma } from "@/lib/db";
import { verifyXunhuPayHash } from "@/lib/payments/xunhupay";

function successResponse() {
  return new Response("success", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

function failResponse() {
  return new Response("fail", {
    status: 500,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

function readString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = readString(value);
  }

  const appSecret = process.env.XUNHUPAY_APP_SECRET?.trim() ?? "";
  if (!appSecret || !verifyXunhuPayHash(payload, appSecret)) {
    return successResponse();
  }

  if (payload.status !== "OD") {
    return successResponse();
  }

  const orderNo = payload.trade_order_id;
  const providerOrderNo = payload.transaction_id || payload.pay_order_id || "";
  const paidAmount = payload.total_fee || payload.price || "";
  if (!orderNo || !providerOrderNo || !paidAmount) {
    return successResponse();
  }

  try {
    await createOrderService(prisma).settlePaidOrder({
      orderNo,
      providerOrderNo,
      providerStatus: payload.status,
      paidAmount
    });
  } catch (error) {
    console.error("Failed to settle XunhuPay callback", error);
    return failResponse();
  }

  return successResponse();
}
