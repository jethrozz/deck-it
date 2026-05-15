import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, preference: true, designPlan: true }
  });

  if (!project?.analysis || !project.preference || !project.designPlan) {
    return NextResponse.json({ error: "请先完成户型分析、偏好设置和方案生成。" }, { status: 400 });
  }

  const exportRecord = await prisma.briefExport.create({
    data: {
      projectId,
      status: "READY",
      fileUrl: `/api/projects/${projectId}/brief/download`
    }
  });

  await prisma.project.update({ where: { id: projectId }, data: { status: "BRIEF_READY" } });
  return NextResponse.json({ brief: exportRecord });
}
