import { ProjectWorkspace } from "@/components/project-workspace";
import { prisma } from "@/lib/db";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true,
      conversations: { orderBy: { createdAt: "asc" } },
      designPlan: true,
      renderings: { orderBy: { createdAt: "asc" } },
      briefExports: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  return <ProjectWorkspace project={JSON.parse(JSON.stringify(project))} />;
}
