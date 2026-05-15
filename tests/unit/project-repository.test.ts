import { describe, expect, it, vi } from "vitest";
import { createProjectRepository } from "@/lib/repositories/project-repository";

describe("project repository", () => {
  it("creates a project with CREATED status", async () => {
    const prisma = {
      project: {
        create: vi.fn().mockResolvedValue({ id: "p1", name: "我的装修方案", status: "CREATED" })
      }
    };

    const repo = createProjectRepository(prisma as never);
    const project = await repo.createProject("我的装修方案");

    expect(project.id).toBe("p1");
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { name: "我的装修方案" }
    });
  });

  it("stores confirmed floor plan analysis", async () => {
    const prisma = {
      floorPlanAnalysis: {
        upsert: vi.fn().mockResolvedValue({ id: "a1", confirmed: true })
      },
      project: {
        update: vi.fn().mockResolvedValue({ id: "p1", status: "FLOOR_PLAN_ANALYZED" })
      }
    };

    const repo = createProjectRepository(prisma as never);
    await repo.saveFloorPlanAnalysis(
      "p1",
      { rooms: [], relationships: [], issues: [], uncertainItems: [], userCorrections: [] },
      true
    );

    expect(prisma.floorPlanAnalysis.upsert).toHaveBeenCalled();
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "FLOOR_PLAN_ANALYZED" }
    });
  });
});
