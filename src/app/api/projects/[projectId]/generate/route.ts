import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import {
  type GenerationStatus,
  designPlanSchema,
  floorPlanAnalysisSchema,
  generationStatusSchema,
  preferenceProfileSchema
} from "@/lib/domain/schemas";
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
    return NextResponse.json({ error: "请先完成户型分析、偏好设置和设计师咨询。" }, { status: 400 });
  }

  const repo = createProjectRepository(prisma);
  const provider = createAiProvider();
  const analysis = floorPlanAnalysisSchema.parse(project.analysis.analysisJson);
  const profile = preferenceProfileSchema.parse(project.preference.profileJson);
  const conversationSummary = project.conversations.map((message) => `${message.role}: ${message.content}`).join("\n");

  await repo.updateProjectStatus(projectId, "GENERATING_REQUIREMENT_PROFILE");

  const tasks: GenerationStatus["tasks"] = [
    { key: "requirement_profile", label: "整理需求画像", status: "done" },
    { key: "plan", label: "生成整体设计策略", status: "running" },
    { key: "spaces", label: "生成重点空间方案", status: "waiting" },
    { key: "renderings", label: "生成效果图", status: "waiting" },
    { key: "brief", label: "生成 PDF brief", status: "waiting" }
  ];

  await repo.updateProjectStatus(projectId, "GENERATING_PLAN");
  const plan = await provider.generateDesignPlan({ analysis, profile, conversationSummary });
  await repo.saveDesignPlan(projectId, plan);
  await repo.updateProjectStatus(projectId, "PLAN_READY");

  tasks[1].status = "done";
  tasks[2].status = "done";
  tasks[3].status = "running";

  await repo.updateProjectStatus(projectId, "GENERATING_RENDERINGS");
  const parsedPlan = designPlanSchema.parse(plan);
  const renderings = await Promise.all(
    parsedPlan.keySpaces.map(async (space) => {
      const created = await prisma.renderingAsset.create({
        data: {
          projectId,
          spaceType: space.spaceType,
          prompt: space.renderingPrompt,
          status: "RUNNING"
        }
      });

      try {
        const result = await provider.generateRendering({
          prompt: space.renderingPrompt,
          spaceTitle: space.title
        });

        return prisma.renderingAsset.update({
          where: { id: created.id },
          data: { imageUrl: result.imageUrl, status: "READY" }
        });
      } catch (error) {
        return prisma.renderingAsset.update({
          where: { id: created.id },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "效果图生成失败"
          }
        });
      }
    })
  );

  await repo.updateProjectStatus(projectId, "RENDERINGS_READY");
  tasks[3].status = renderings.some((item) => item.status === "FAILED") ? "failed" : "done";
  tasks[4].status = "running";

  await repo.updateProjectStatus(projectId, "GENERATING_BRIEF");
  const latestBrief = await prisma.briefExport.findFirst({
    where: { projectId },
    orderBy: { version: "desc" }
  });
  const brief = await prisma.briefExport.create({
    data: {
      projectId,
      status: "READY",
      version: (latestBrief?.version ?? 0) + 1
    }
  });
  await repo.updateProjectStatus(projectId, "BRIEF_READY");
  tasks[4].status = "done";

  return NextResponse.json({
    status: generationStatusSchema.parse({ tasks }),
    plan,
    renderings,
    brief,
    nextPath: `/projects/${projectId}/complete`
  });
}
