import { ProjectTransitionScreen } from "@/components/project-transition-screen";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectStep } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function TransitionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  return (
    <WizardShell currentStep={getProjectStep(project.status).key}>
      <ProjectTransitionScreen projectId={project.id} />
    </WizardShell>
  );
}
