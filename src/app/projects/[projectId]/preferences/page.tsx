import { redirect } from "next/navigation";
import { PreferencesStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { preferenceProfileSchema } from "@/lib/domain/schemas";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function PreferencesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  if (canonicalRoute !== `/projects/${project.id}/preferences`) {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell currentStep="preferences">
      <PreferencesStep
        projectId={project.id}
        initialPreference={project.preference ? preferenceProfileSchema.parse(project.preference.profileJson) : null}
      />
    </WizardShell>
  );
}
