import { redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/projects/load-project";
import { getProjectRoute } from "@/lib/projects/flow";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  redirect(getProjectRoute(project.id, project.status));
}
