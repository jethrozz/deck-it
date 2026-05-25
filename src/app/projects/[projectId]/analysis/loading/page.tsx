import { redirect } from "next/navigation";
import { AnalysisLoadingStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function AnalysisLoadingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  if (
    canonicalRoute !== `/projects/${project.id}/analysis/loading` &&
    project.status !== "CREATED" &&
    project.status !== "FLOOR_PLAN_UPLOADING"
  ) {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell
      currentStep="analysis"
      title="正在分析户型"
      description="系统正在识别房间布局、采光和空间关系。"
      footer="预计需要 30-60 秒，请稍候。"
    >
      <AnalysisLoadingStep projectId={project.id} currentStatus={project.status} />
    </WizardShell>
  );
}
