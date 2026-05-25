import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

export async function POST(request: Request) {
  const formData = await request.formData();
  const rawName = formData.get("name");
  const name = String(rawName ?? "我的装修方案").trim();

  const repo = createProjectRepository(prisma);
  const project = await repo.createProject(name || "我的装修方案");

  return Response.json(
    {
      projectId: project.id,
      nextPath: `/projects/${project.id}/upload`
    },
    { status: 201 }
  );
}
