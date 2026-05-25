import { redirect } from "next/navigation";
import { GeneratingStep } from "@/components/project-steps";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function GeneratingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  const allowPaymentSuccessEntry = project.status === "PAYMENT_SUCCEEDED";
  if (project.status === "BRIEF_READY") {
    redirect(`/projects/${project.id}/complete`);
  }
  if (!allowPaymentSuccessEntry && canonicalRoute !== `/projects/${project.id}/generating`) {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell
      currentStep="generating"
      title="正在生成方案"
      description="系统正在整理需求画像、生成方案、效果图与 PDF brief。"
      footer="生成过程中请不要关闭页面。"
    >
      <GeneratingStep projectId={project.id} status={project.status} renderings={JSON.parse(JSON.stringify(project.renderings))} />
    </WizardShell>
  );
}
