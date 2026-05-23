import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBuiltInCoupons } from "@/lib/orders/bootstrap";
import { createOrderService } from "@/lib/orders/order-service";
import { prisma } from "@/lib/db";

const requestBodySchema = z.object({
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  couponCode: z.string().trim().optional().default("")
});

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function toClientError(error: unknown) {
  const message = error instanceof Error ? error.message : "请求失败";

  if (message === "订单不存在") {
    return { status: 404, error: message };
  }

  if (
    message.includes("优惠码") ||
    message.includes("邮箱") ||
    message.includes("手机号") ||
    message.includes("请填写") ||
    message.includes("格式不正确")
  ) {
    return { status: 400, error: message };
  }

  return { status: 500, error: "订单报价失败，请稍后重试" };
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

  try {
    await ensureBuiltInCoupons(prisma);

    const quote = await createOrderService(prisma).quoteOrder({
      projectId,
      orderId,
      email: bodyResult.data.email,
      phone: bodyResult.data.phone,
      couponCode: bodyResult.data.couponCode
    });

    return NextResponse.json(quote);
  } catch (error) {
    const clientError = toClientError(error);
    if (clientError.status === 500) {
      console.error("Failed to quote order", error);
    }
    return errorResponse(clientError.status, clientError.error);
  }
}
