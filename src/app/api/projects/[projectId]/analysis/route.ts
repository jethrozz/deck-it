import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

const requestSchema = z.object({
  userCorrections: z.array(z.string().min(1)).default([])
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const body = requestSchema.parse(await request.json());

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true }
  });

  if (!project?.analysis) {
    return NextResponse.json({ error: "请先完成户型分析。" }, { status: 400 });
  }

  await createProjectRepository(prisma).confirmFloorPlanAnalysis(projectId, body.userCorrections);

  return NextResponse.json({
    confirmed: true,
    nextPath: `/projects/${projectId}/preferences`
  });
}
