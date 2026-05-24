import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true,
      conversations: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!project?.analysis || !project.preference) {
    return NextResponse.json({ error: "请先完成户型分析和偏好设置。" }, { status: 400 });
  }

  const conversationSummary = project.conversations
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const provider = createAiProvider();
  const plan = await provider.generateDesignPlan({
    analysis: floorPlanAnalysisSchema.parse(project.analysis.analysisJson),
    profile: preferenceProfileSchema.parse(project.preference.profileJson),
    conversationSummary
  });

  await createProjectRepository(prisma).saveDesignPlan(projectId, plan);
  await prisma.project.update({ where: { id: projectId }, data: { status: "PLAN_READY" } });

  return NextResponse.json({ plan });
}
