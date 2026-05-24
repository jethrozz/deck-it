import { afterEach, describe, expect, it, vi } from "vitest";

const analyzeFloorPlan = vi.fn();
const updateProjectStatus = vi.fn();
const saveFloorPlanUrl = vi.fn();
const saveFloorPlanAnalysis = vi.fn();

vi.mock("@/lib/ai/provider-factory", () => ({
  createAiProvider: () => ({
    analyzeFloorPlan
  })
}));

vi.mock("@/lib/db", () => ({
  prisma: {}
}));

vi.mock("@/lib/repositories/project-repository", () => ({
  createProjectRepository: () => ({
    updateProjectStatus,
    saveFloorPlanUrl,
    saveFloorPlanAnalysis
  })
}));

describe("POST /api/projects/[projectId]/floor-plan", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("persists a displayable data url for the uploaded floor plan", async () => {
    analyzeFloorPlan.mockResolvedValue({
      rooms: [],
      relationships: [],
      issues: [],
      uncertainItems: [],
      userCorrections: []
    });

    const { POST } = await import("@/app/api/projects/[projectId]/floor-plan/route");
    const formData = new FormData();
    formData.append("floorPlan", new File(["png-bytes"], "plan.png", { type: "image/png" }));

    const response = await POST(new Request("http://localhost/api/projects/p1/floor-plan", { method: "POST", body: formData }), {
      params: Promise.resolve({ projectId: "p1" })
    });

    const payload = (await response.json()) as { imageUrl: string };

    expect(updateProjectStatus).toHaveBeenCalledWith("p1", "FLOOR_PLAN_ANALYZING");
    expect(analyzeFloorPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/)
      })
    );
    expect(saveFloorPlanUrl).toHaveBeenCalledWith("p1", expect.stringMatching(/^data:image\/png;base64,/));
    expect(payload.imageUrl).toMatch(/^data:image\/png;base64,/);
  });
});
