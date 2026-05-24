import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { designPlanSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const designPlan = await prisma.designPlan.findUnique({ where: { projectId } });

  if (!designPlan) {
    return NextResponse.json({ error: "请先生成设计方案。" }, { status: 400 });
  }

  const plan = designPlanSchema.parse(designPlan.planJson);
  const provider = createAiProvider();
  const renderings = await Promise.all(
    plan.keySpaces.map(async (space) => {
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

  await prisma.project.update({ where: { id: projectId }, data: { status: "RENDERINGS_READY" } });
  return NextResponse.json({ renderings });
}
