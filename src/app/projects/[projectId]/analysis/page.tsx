import { redirect } from "next/navigation";
import { AnalysisConfirmStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { floorPlanAnalysisSchema } from "@/lib/domain/schemas";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function AnalysisPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  const analysis = project.analysis ? floorPlanAnalysisSchema.parse(project.analysis.analysisJson) : null;

  if (!analysis) {
    redirect(`/projects/${project.id}/upload`);
  }

  if (canonicalRoute !== `/projects/${project.id}/analysis`) {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell currentStep="analysis">
      <AnalysisConfirmStep projectId={project.id} floorPlanUrl={project.floorPlanUrl} analysis={analysis} />
    </WizardShell>
  );
}
