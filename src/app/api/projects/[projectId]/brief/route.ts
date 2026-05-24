import { NextResponse } from "next/server";
import { designPlanSchema, floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { renderBriefPdf } from "@/lib/pdf/render-brief";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, preference: true, designPlan: true, renderings: true, briefExports: true }
  });

  if (!project) {
    return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
  }

  if (!project.analysis || !project.preference || !project.designPlan) {
    return NextResponse.json({ error: "请先完成户型分析、偏好设置和方案生成。" }, { status: 400 });
  }

  const analysisResult = floorPlanAnalysisSchema.safeParse(project.analysis.analysisJson);
  const profileResult = preferenceProfileSchema.safeParse(project.preference.profileJson);
  const planResult = designPlanSchema.safeParse(project.designPlan.planJson);

  if (!analysisResult.success || !profileResult.success || !planResult.success) {
    return NextResponse.json(
      {
        error: "项目数据格式无效，无法生成 PDF。",
        details: [
          ...(analysisResult.success ? [] : analysisResult.error.issues),
          ...(profileResult.success ? [] : profileResult.error.issues),
          ...(planResult.success ? [] : planResult.error.issues)
        ]
      },
      { status: 422 }
    );
  }

  const pdf = await renderBriefPdf({
    projectName: project.name,
    analysis: analysisResult.data,
    profile: profileResult.data,
    plan: planResult.data,
    renderings: project.renderings.map((item) => ({ spaceType: item.spaceType, imageUrl: item.imageUrl }))
  });

  const nextVersion = project.briefExports.length + 1;
  const exportRecord = await prisma.briefExport.create({
    data: {
      projectId,
      status: "READY",
      version: nextVersion
    }
  });

  await prisma.project.update({ where: { id: projectId }, data: { status: "BRIEF_READY" } });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="renovation-brief-v${exportRecord.version}.pdf"`
    }
  });
}
