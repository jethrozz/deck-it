import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureXunhuPayOrderReconcileScheduler } from "@/lib/payments/xunhupay-reconcile";

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
} | null) {
  if (!order) {
    return null;
  }

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

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  ensureXunhuPayOrderReconcileScheduler();
  const { projectId } = await context.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        generationCreditsPurchased: true,
        generationCreditsUsed: true
      }
    });

    if (!project) {
      return errorResponse(404, "项目不存在");
    }

    const order = await prisma.order.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });

    const remainingCredits = Math.max(0, project.generationCreditsPurchased - project.generationCreditsUsed);

    return NextResponse.json({
      projectStatus: project.status,
      remainingCredits,
      requiresPayment: remainingCredits <= 0,
      order: formatOrder(order)
    });
  } catch (error) {
    console.error("Failed to load current order", error);
    return errorResponse(500, "订单查询失败，请稍后重试");
  }
}
