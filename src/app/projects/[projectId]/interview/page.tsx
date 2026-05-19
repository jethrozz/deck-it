import { redirect } from "next/navigation";
import { InterviewStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { floorPlanAnalysisSchema, preferenceProfileSchema } from "@/lib/domain/schemas";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function InterviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  if (!project.analysis || !project.preference) {
    redirect(getProjectRoute(project.id, project.status));
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  const allowRevisit = project.status === "BRIEF_READY";
  if (!allowRevisit && canonicalRoute !== `/projects/${project.id}/interview`) {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell currentStep="interview">
      <InterviewStep
        projectId={project.id}
        status={project.status}
        analysis={floorPlanAnalysisSchema.parse(project.analysis.analysisJson)}
        preference={preferenceProfileSchema.parse(project.preference.profileJson)}
        initialConversation={JSON.parse(JSON.stringify(project.conversations))}
      />
    </WizardShell>
  );
}
