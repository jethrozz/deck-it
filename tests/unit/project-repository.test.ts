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

  it("confirms floor plan analysis and stores user corrections", async () => {
    const prisma = {
      $transaction: vi.fn(async (operations: unknown[]) => operations),
      floorPlanAnalysis: {
        findUnique: vi.fn().mockResolvedValue({
          id: "a1",
          analysisJson: {
            rooms: [{ name: "次卧", type: "study", confidence: 0.72 }],
            relationships: ["客餐厅连接阳台"],
            issues: [],
            uncertainItems: [],
            userCorrections: []
          }
        }),
        update: vi.fn().mockResolvedValue({ id: "a1", confirmed: true })
      },
      project: {
        update: vi.fn().mockResolvedValue({ id: "p1", status: "ANALYSIS_CONFIRMED" })
      }
    };

    const repo = createProjectRepository(prisma as never);
    await repo.confirmFloorPlanAnalysis("p1", ["次卧需要作为书房"]);

    expect(prisma.floorPlanAnalysis.findUnique).toHaveBeenCalledWith({
      where: { projectId: "p1" }
    });
    expect(prisma.floorPlanAnalysis.update).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      data: {
        confirmed: true,
        analysisJson: {
          rooms: [{ name: "次卧", type: "study", confidence: 0.72 }],
          relationships: ["客餐厅连接阳台"],
          issues: [],
          uncertainItems: [],
          userCorrections: ["次卧需要作为书房"]
        }
      }
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "ANALYSIS_CONFIRMED" }
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("updates project status directly", async () => {
    const prisma = {
      project: {
        update: vi.fn().mockResolvedValue({ id: "p1", status: "INTERVIEWING" })
      }
    };

    const repo = createProjectRepository(prisma as never);
    await repo.updateProjectStatus("p1", "INTERVIEWING");

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "INTERVIEWING" }
    });
  });

  it("consumes one credit when project is eligible", async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          status: "PAYMENT_SUCCEEDED",
          generationCreditsPurchased: 2,
          generationCreditsUsed: 0
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    const repo = createProjectRepository(prisma as never);
    const consumed = await repo.consumeProjectCredit("p1");

    expect(consumed).toBe(true);
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: {
        id: "p1",
        status: { in: ["PAYMENT_SUCCEEDED", "BRIEF_READY", "INTERVIEW_COMPLETE"] },
        generationCreditsUsed: 0
      },
      data: {
        generationCreditsUsed: {
          increment: 1
        }
      }
    });
  });

  it("does not consume credit when quota is exhausted", async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          status: "PAYMENT_SUCCEEDED",
          generationCreditsPurchased: 1,
          generationCreditsUsed: 1
        }),
        updateMany: vi.fn()
      }
    };

    const repo = createProjectRepository(prisma as never);
    const consumed = await repo.consumeProjectCredit("p1");

    expect(consumed).toBe(false);
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
  });

  it("does not consume credit for ineligible project statuses", async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          status: "INTERVIEWING",
          generationCreditsPurchased: 2,
          generationCreditsUsed: 0
        }),
        updateMany: vi.fn()
      }
    };

    const repo = createProjectRepository(prisma as never);
    const consumed = await repo.consumeProjectCredit("p1");

    expect(consumed).toBe(false);
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
  });

  it("retries credit consumption on contention and succeeds on a later attempt", async () => {
    const prisma = {
      project: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            status: "PAYMENT_SUCCEEDED",
            generationCreditsPurchased: 3,
            generationCreditsUsed: 0
          })
          .mockResolvedValueOnce({
            status: "PAYMENT_SUCCEEDED",
            generationCreditsPurchased: 3,
            generationCreditsUsed: 1
          }),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })
      }
    };

    const repo = createProjectRepository(prisma as never);
    const consumed = await repo.consumeProjectCredit("p1");

    expect(consumed).toBe(true);
    expect(prisma.project.updateMany).toHaveBeenCalledTimes(2);
  });
});
