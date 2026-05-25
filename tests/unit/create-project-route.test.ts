import { afterEach, describe, expect, it, vi } from "vitest";

const createProject = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {}
}));

vi.mock("@/lib/repositories/project-repository", () => ({
  createProjectRepository: () => ({
    createProject
  })
}));

describe("POST /api/projects", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the created project id and upload path for client-side navigation", async () => {
    createProject.mockResolvedValue({ id: "p1" });

    const { POST } = await import("@/app/api/projects/route");
    const formData = new FormData();
    formData.append("name", "温暖的小家");

    const response = await POST(new Request("http://localhost/api/projects", { method: "POST", body: formData }));
    const payload = (await response.json()) as { projectId: string; nextPath: string };

    expect(response.status).toBe(201);
    expect(createProject).toHaveBeenCalledWith("温暖的小家");
    expect(payload).toEqual({
      projectId: "p1",
      nextPath: "/projects/p1/upload"
    });
  });
});
