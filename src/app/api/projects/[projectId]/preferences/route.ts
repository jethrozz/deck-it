import { NextResponse } from "next/server";
import { preferenceProfileSchema } from "@/lib/domain/schemas";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const body = await request.json();
  const profile = preferenceProfileSchema.parse(body);
  const repo = createProjectRepository(prisma);

  await repo.savePreferenceProfile(projectId, profile);
  await repo.updateProjectStatus(projectId, "INTERVIEWING");

  return NextResponse.json({ profile, nextPath: `/projects/${projectId}/interview` });
}
