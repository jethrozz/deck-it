import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureBuiltInCoupons } from "@/lib/orders/bootstrap";
import { ORDER_BUNDLE_CREDITS, ORDER_BUNDLE_PRICE } from "@/lib/orders/constants";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

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

function makeOrderNo(projectId: string) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${projectId.slice(0, 6).toUpperCase()}-${suffix}`;
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function getOrCreateOpenOrder(projectId: string) {
  const repository = createProjectRepository(prisma);
  const maxRetries = 3;
  let lastSerializationError: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const txRepository = createProjectRepository(tx as never);
          const existing = await txRepository.findLatestOpenOrder(projectId);
          if (existing) {
            return existing;
          }

          const originalAmount = new Prisma.Decimal(ORDER_BUNDLE_PRICE.toFixed(2));
          return txRepository.createOrder({
            project: { connect: { id: projectId } },
            orderNo: makeOrderNo(projectId),
            title: "设计方案生成次数包（2次）",
            creditsGranted: ORDER_BUNDLE_CREDITS,
            originalAmount,
            discountAmount: new Prisma.Decimal("0.00"),
            payableAmount: originalAmount,
            status: "PENDING"
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        lastSerializationError = error;
        continue;
      }
      throw error;
    }
  }

  const fallback = await repository.findLatestOpenOrder(projectId);
  if (fallback) {
    return fallback;
  }

  throw lastSerializationError ?? new Error("Failed to prepare order due to transaction conflict");
}

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  try {
    await ensureBuiltInCoupons(prisma);

    const repository = createProjectRepository(prisma);
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

    const remainingCredits = Math.max(0, project.generationCreditsPurchased - project.generationCreditsUsed);
    if (remainingCredits > 0) {
      return NextResponse.json({
        order: null,
        remainingCredits,
        requiresPayment: false,
        nextPath: `/projects/${projectId}/generating`
      });
    }

    const order = await getOrCreateOpenOrder(projectId);

    if (project.status !== "AWAITING_PAYMENT") {
      await repository.updateProjectStatus(projectId, "AWAITING_PAYMENT");
    }

    return NextResponse.json({
      order: formatOrder(order),
      remainingCredits: 0,
      requiresPayment: true,
      nextPath: `/projects/${projectId}/payment`
    });
  } catch (error) {
    console.error("Failed to prepare order", error);
    return errorResponse(500, "订单准备失败，请稍后重试");
  }
}
