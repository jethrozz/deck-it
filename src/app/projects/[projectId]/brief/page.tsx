import { redirect } from "next/navigation";
import { BriefReport } from "@/components/brief-report";
import { designPlanSchema, floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function BriefPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  if (!project.analysis || !project.preference || !project.designPlan || project.status !== "BRIEF_READY") {
    redirect(`/projects/${project.id}`);
  }

  return (
    <BriefReport
      projectId={project.id}
      projectName={project.name}
      analysis={floorPlanAnalysisSchema.parse(project.analysis.analysisJson)}
      preference={preferenceProfileSchema.parse(project.preference.profileJson)}
      plan={designPlanSchema.parse(project.designPlan.planJson)}
      renderings={JSON.parse(JSON.stringify(project.renderings))}
    />
  );
}
