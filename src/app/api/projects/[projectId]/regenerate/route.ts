import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const repository = createProjectRepository(prisma);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true
    }
  });

  if (!project?.analysis || !project.preference) {
    return NextResponse.json({ error: "请先完成户型分析和偏好设置后再重新生成。" }, { status: 400 });
  }

  const remainingCredits = Math.max(0, project.generationCreditsPurchased - project.generationCreditsUsed);

  if (remainingCredits <= 0 || project.status === "AWAITING_PAYMENT" || project.status === "PAYMENT_PROCESSING") {
    if (remainingCredits <= 0 && project.status !== "AWAITING_PAYMENT" && project.status !== "PAYMENT_PROCESSING") {
      await repository.updateProjectStatus(projectId, "AWAITING_PAYMENT");
    }

    return NextResponse.json({
      nextPath: `/projects/${projectId}/payment`
    });
  }

  await repository.resetGeneratedOutputs(projectId);

  return NextResponse.json({
    nextPath: `/projects/${projectId}/generating`
  });
}
