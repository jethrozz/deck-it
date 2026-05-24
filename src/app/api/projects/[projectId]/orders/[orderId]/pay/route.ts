import { randomUUID } from "node:crypto";
import { ContactType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBuiltInCoupons } from "@/lib/orders/bootstrap";
import { createOrderService } from "@/lib/orders/order-service";
import { buildXunhuPayHash } from "@/lib/payments/xunhupay";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

const requestBodySchema = z.object({
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  couponCode: z.string().trim().optional().default("")
});

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function toContactType(type: "email" | "phone") {
  return type === "email" ? ContactType.EMAIL : ContactType.PHONE;
}

function fromContactType(type: ContactType) {
  return type === ContactType.EMAIL ? "email" : "phone";
}

function toNumber(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : Number(value.toString());
}

function formatOrder(order: {
  id: string;
  orderNo: string;
  status: string;
  title: string;
  creditsGranted: number;
  originalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  payableAmount: Prisma.Decimal;
  contactType: string | null;
  contactValue: string | null;
  couponCodeSnapshot: string | null;
}) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    title: order.title,
    creditsGranted: order.creditsGranted,
    originalAmount: toNumber(order.originalAmount),
    discountAmount: toNumber(order.discountAmount),
    payableAmount: toNumber(order.payableAmount),
    contactType: order.contactType,
    contactValue: order.contactValue,
    couponCodeSnapshot: order.couponCodeSnapshot
  };
}

function resolvePaymentConfig(requestUrl: string, projectId: string) {
  const appId = process.env.XUNHUPAY_APP_ID?.trim();
  const appSecret = process.env.XUNHUPAY_APP_SECRET?.trim();
  const notifyUrl = process.env.XUNHUPAY_NOTIFY_URL?.trim();
  const paymentUrl = process.env.XUNHUPAY_PAYMENT_URL?.trim() ?? "https://api.xunhupay.com/payment/do.html";
  const plugin = process.env.XUNHUPAY_PLUGIN?.trim();

  const requestOrigin = new URL(requestUrl).origin;
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || requestOrigin;
  const returnUrl = process.env.XUNHUPAY_RETURN_URL?.trim() ?? `${publicBaseUrl}/projects/${projectId}/payment`;

  if (!appId || !appSecret || !notifyUrl) {
    return null;
  }

  return {
    appId,
    appSecret,
    notifyUrl,
    returnUrl,
    paymentUrl,
    plugin
  };
}

function toClientError(error: unknown) {
  const message = error instanceof Error ? error.message : "请求失败";

  if (message === "订单不存在") {
    return { status: 404, error: message };
  }

  if (message.includes("优惠码") || message.includes("邮箱") || message.includes("手机号") || message.includes("请填写")) {
    return { status: 400, error: message };
  }

  if (message.includes("订单状态")) {
    return { status: 409, error: message };
  }

  return { status: 500, error: "发起支付失败，请稍后重试" };
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string; orderId: string }> }) {
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(400, "请求体必须是 JSON");
  }

  const bodyResult = requestBodySchema.safeParse(requestBody);
  if (!bodyResult.success) {
    return errorResponse(400, "请求参数不正确");
  }

  const { projectId, orderId } = await context.params;
  const paymentConfig = resolvePaymentConfig(request.url, projectId);
  if (!paymentConfig) {
    return errorResponse(500, "支付配置不完整，请联系管理员");
  }

  try {
    await ensureBuiltInCoupons(prisma);

    const repository = createProjectRepository(prisma);
    const order = await repository.findOrderById(orderId);
    if (!order || order.projectId !== projectId) {
      return errorResponse(404, "订单不存在");
    }

    if (order.status === "PROCESSING") {
      if (!order.contactType || !order.contactValue) {
        return errorResponse(409, "订单支付处理中，请刷新状态。");
      }

      const processingPricing = {
        originalAmount: toNumber(order.originalAmount),
        discountAmount: toNumber(order.discountAmount),
        payableAmount: toNumber(order.payableAmount)
      };

      const processingContact = {
        type: fromContactType(order.contactType),
        value: order.contactValue
      } as const;

      const processingFields: Record<string, string> = {
        version: "1.1",
        appid: paymentConfig.appId,
        trade_order_id: order.orderNo,
        total_fee: processingPricing.payableAmount.toFixed(2),
        title: order.title,
        time: String(Math.floor(Date.now() / 1000)),
        notify_url: paymentConfig.notifyUrl,
        return_url: paymentConfig.returnUrl,
        nonce_str: randomUUID().replace(/-/g, "")
      };

      if (paymentConfig.plugin) {
        processingFields.plugins = paymentConfig.plugin;
      }

      const processingHash = buildXunhuPayHash(processingFields, paymentConfig.appSecret);

      return NextResponse.json({
        order: formatOrder(order),
        contact: processingContact,
        coupon: null,
        pricing: processingPricing,
        payment: {
          provider: "XUNHUPAY",
          method: "POST",
          endpoint: paymentConfig.paymentUrl,
          fields: {
            ...processingFields,
            hash: processingHash
          }
        }
      });
    }

    if (order.status === "PAID") {
      return errorResponse(409, "订单已支付");
    }

    if (order.status === "FAILED" || order.status === "EXPIRED" || order.status === "CANCELED") {
      return errorResponse(409, "订单状态不允许支付");
    }

    const orderService = createOrderService(prisma);
    const quote = await orderService.quoteOrder({
      projectId,
      orderId,
      email: bodyResult.data.email,
      phone: bodyResult.data.phone,
      couponCode: bodyResult.data.couponCode
    });

    const couponRate = quote.coupon
      ? await prisma.coupon.findUnique({
          where: { id: quote.coupon.id },
          select: { discountRate: true }
        })
      : null;

    const updateResult = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING"
      },
      data: {
        status: "PROCESSING",
        contactType: toContactType(quote.contact.type),
        contactValue: quote.contact.value,
        originalAmount: new Prisma.Decimal(quote.pricing.originalAmount.toFixed(2)),
        discountAmount: new Prisma.Decimal(quote.pricing.discountAmount.toFixed(2)),
        payableAmount: new Prisma.Decimal(quote.pricing.payableAmount.toFixed(2)),
        couponCodeSnapshot: quote.coupon?.code ?? null,
        discountRateSnapshot: couponRate?.discountRate ?? null,
        couponId: quote.coupon?.id ?? null
      }
    });

    if (updateResult.count === 0) {
      const latestOrder = await repository.findOrderById(order.id);
      if (!latestOrder) {
        return errorResponse(404, "订单不存在");
      }
      if (latestOrder.status === "PROCESSING") {
        return errorResponse(409, "订单支付处理中，请刷新后继续支付。");
      }
      if (latestOrder.status === "PAID") {
        return errorResponse(409, "订单已支付");
      }
      return errorResponse(409, "订单状态不允许支付");
    }

    const updated = await repository.findOrderById(order.id);
    if (!updated) {
      return errorResponse(404, "订单不存在");
    }

    await repository.updateProjectStatus(projectId, "PAYMENT_PROCESSING");

    const fields: Record<string, string> = {
      version: "1.1",
      appid: paymentConfig.appId,
      trade_order_id: updated.orderNo,
      total_fee: quote.pricing.payableAmount.toFixed(2),
      title: updated.title,
      time: String(Math.floor(Date.now() / 1000)),
      notify_url: paymentConfig.notifyUrl,
      return_url: paymentConfig.returnUrl,
      nonce_str: randomUUID().replace(/-/g, "")
    };

    if (paymentConfig.plugin) {
      fields.plugins = paymentConfig.plugin;
    }

    const hash = buildXunhuPayHash(fields, paymentConfig.appSecret);

    return NextResponse.json({
      order: formatOrder(updated),
      contact: quote.contact,
      coupon: quote.coupon,
      pricing: quote.pricing,
      payment: {
        provider: "XUNHUPAY",
        method: "POST",
        endpoint: paymentConfig.paymentUrl,
        fields: {
          ...fields,
          hash
        }
      }
    });
  } catch (error) {
    const clientError = toClientError(error);
    if (clientError.status === 500) {
      console.error("Failed to create payment payload", error);
    }
    return errorResponse(clientError.status, clientError.error);
  }
}
