import { NextResponse } from "next/server";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";
import { createStorageProvider } from "@/lib/storage/provider-factory";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("floorPlan");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传户型图文件。" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  const imageDataUrl = `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  const stored = await createStorageProvider().saveProjectFile({
    projectId,
    fileName: file.name,
    contentType: mimeType,
    bytes
  });

  const provider = createAiProvider();
  const repo = createProjectRepository(prisma);
  const analysis = await provider.analyzeFloorPlan({
    imageUrl: stored.url,
    imageDataUrl
  });

  await repo.saveFloorPlanUrl(projectId, stored.url);
  await repo.saveFloorPlanAnalysis(projectId, analysis, false);

  return NextResponse.json({ imageUrl: stored.url, analysis });
}
