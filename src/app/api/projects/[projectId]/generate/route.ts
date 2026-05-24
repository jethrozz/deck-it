import { NextResponse } from "next/server";
import type { ProjectStatus } from "@prisma/client";
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

const paymentBlockedStatuses: ProjectStatus[] = ["AWAITING_PAYMENT", "PAYMENT_PROCESSING"];
const generationStartStatuses: ProjectStatus[] = ["INTERVIEW_COMPLETE", "PAYMENT_SUCCEEDED", "BRIEF_READY"];

function getRemainingCredits(purchased: number, used: number) {
  return Math.max(0, purchased - used);
}

function paymentRequiredResponse(projectId: string) {
  return NextResponse.json(
    {
      error: "当前生成额度已用完，请先完成支付后再生成。",
      nextPath: `/projects/${projectId}/payment`,
      requiresPayment: true
    },
    { status: 402 }
  );
}

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
  const remainingCredits = getRemainingCredits(project.generationCreditsPurchased, project.generationCreditsUsed);

  if (remainingCredits <= 0 || paymentBlockedStatuses.includes(project.status)) {
    if (remainingCredits <= 0 && !paymentBlockedStatuses.includes(project.status)) {
      await repo.updateProjectStatus(projectId, "AWAITING_PAYMENT");
    }
    return paymentRequiredResponse(projectId);
  }

  if (!generationStartStatuses.includes(project.status)) {
    return NextResponse.json({ error: "当前项目状态不允许开始生成，请稍后刷新页面重试。" }, { status: 409 });
  }

  let consumedCreditSnapshot: { usedAfter: number } | null = null;

  try {
    const consumeResult = await repo.consumeProjectCredit(projectId);
    if (!consumeResult.consumed) {
      if (consumeResult.reason === "exhausted") {
        await repo.updateProjectStatus(projectId, "AWAITING_PAYMENT");
        return paymentRequiredResponse(projectId);
      }

      const latestProject = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          status: true,
          generationCreditsPurchased: true,
          generationCreditsUsed: true
        }
      });

      if (!latestProject) {
        return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
      }

      const latestRemaining = getRemainingCredits(
        latestProject.generationCreditsPurchased,
        latestProject.generationCreditsUsed
      );

      if (latestRemaining <= 0 || paymentBlockedStatuses.includes(latestProject.status)) {
        if (latestRemaining <= 0 && !paymentBlockedStatuses.includes(latestProject.status)) {
          await repo.updateProjectStatus(projectId, "AWAITING_PAYMENT");
        }
        return paymentRequiredResponse(projectId);
      }

      return NextResponse.json({ error: "当前项目正在处理生成任务，请稍后重试。" }, { status: 409 });
    }

    consumedCreditSnapshot = { usedAfter: consumeResult.usedAfter };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Credit consumption contention")) {
      return NextResponse.json({ error: "生成请求较多，请稍后重试。" }, { status: 409 });
    }
    throw error;
  }

  try {
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
  } catch (error) {
    if (consumedCreditSnapshot) {
      try {
        const compensation = await prisma.project.updateMany({
          where: {
            id: projectId,
            generationCreditsUsed: consumedCreditSnapshot.usedAfter
          },
          data: {
            generationCreditsUsed: {
              decrement: 1
            },
            status: "PAYMENT_SUCCEEDED"
          }
        });

        if (compensation.count !== 1) {
          console.warn("Generation credit compensation missed target snapshot", {
            projectId,
            usedAfter: consumedCreditSnapshot.usedAfter
          });
        }
      } catch (compensationError) {
        console.warn("Generation credit compensation failed", {
          projectId,
          usedAfter: consumedCreditSnapshot.usedAfter,
          compensationError
        });
      }
    }

    console.error("Generation pipeline fatal error", error);
    return NextResponse.json({ error: "生成流程异常中断，已尝试恢复一次额度，请稍后重试。" }, { status: 500 });
  }
}
