import { redirect } from "next/navigation";
import { UploadStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  if (canonicalRoute !== `/projects/${project.id}/upload` && project.status !== "CREATED" && project.status !== "FLOOR_PLAN_UPLOADING") {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell currentStep="upload" footer="我们会自动识别房间、采光和空间关系。">
      <UploadStep projectId={project.id} />
    </WizardShell>
  );
}
