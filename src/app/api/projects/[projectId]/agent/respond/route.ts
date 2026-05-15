import { NextResponse } from "next/server";
import { z } from "zod";
import { runNextAgentStep } from "@/lib/agent/workflow";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

const requestBodySchema = z.object({
  answer: z.string().optional().default("")
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const body = requestBodySchema.parse(await request.json());
  const userAnswer = body.answer.trim();
  const repo = createProjectRepository(prisma);

  if (userAnswer.length > 0) {
    await repo.addConversationMessage(projectId, "user", userAnswer);
  }

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

  const result = await runNextAgentStep({
    provider: createAiProvider(),
    analysis: floorPlanAnalysisSchema.parse(project.analysis.analysisJson),
    profile: preferenceProfileSchema.parse(project.preference.profileJson),
    conversation: project.conversations
      .filter((message) => message.role === "agent" || message.role === "user")
      .map((message) => ({ role: message.role as "agent" | "user", content: message.content }))
  });

  if (result.type === "question") {
    await repo.addConversationMessage(projectId, "agent", result.question.question, result.question);
    await prisma.project.update({ where: { id: projectId }, data: { status: "INTERVIEWING" } });
  }

  return NextResponse.json(result);
}
