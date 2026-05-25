import { ProjectTransitionScreen } from "@/components/project-transition-screen";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectStep } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";
import { notFound } from "next/navigation";

export default async function TransitionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return (
    <WizardShell
      currentStep={getProjectStep(project.status).key}
      title="确认继续"
      description="确认后将进入下一步。"
    >
      <ProjectTransitionScreen projectId={project.id} />
    </WizardShell>
  );
}
