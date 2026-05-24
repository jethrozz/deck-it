import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProjectRepository } from "@/lib/repositories/project-repository";

const shouldRun = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const describeIf = shouldRun ? describe : describe.skip;

describeIf("project repository supabase integration", () => {
  const repo = createProjectRepository(prisma);
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: {
          id: { in: createdProjectIds }
        }
      });
    }

    await prisma.$disconnect();
  });

  it("persists and updates a project through the existing repository layer", async () => {
    const project = await repo.createProject(`supabase-integration-${Date.now()}`);
    createdProjectIds.push(project.id);

    await repo.updateProjectStatus(project.id, "INTERVIEWING");

    const saved = await prisma.project.findUnique({
      where: { id: project.id }
    });

    expect(saved?.status).toBe("INTERVIEWING");
  });
});
