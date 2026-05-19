import { redirect } from "next/navigation";
import { CompletedStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function CompletePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  if (project.status !== "BRIEF_READY") {
    redirect(`/projects/${project.id}/generating`);
  }

  return (
    <WizardShell currentStep="complete">
      <CompletedStep
        projectId={project.id}
        renderings={JSON.parse(JSON.stringify(project.renderings))}
        briefReady={project.briefExports.length > 0}
      />
    </WizardShell>
  );
}
