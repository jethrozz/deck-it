import { prisma } from "@/lib/db";

export async function getProjectDetail(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true,
      conversations: { orderBy: { createdAt: "asc" } },
      orders: { orderBy: { createdAt: "desc" }, take: 1 },
      designPlan: true,
      renderings: { orderBy: { createdAt: "asc" } },
      briefExports: { orderBy: { createdAt: "desc" } }
    }
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;
